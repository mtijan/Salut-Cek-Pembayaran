"""Measured, backup-gated, and reversible normalization for historical bill due dates."""

from __future__ import annotations

import argparse
import json
import re
import uuid
from collections import Counter
from datetime import date, datetime, timezone
from pathlib import Path
from typing import NamedTuple

from Backend.backup_sqlite import backup_database
from Backend.db import LATEST_SCHEMA_VERSION, database_connection, database_transaction


MONTHS_ID = {
    "januari": 1,
    "februari": 2,
    "maret": 3,
    "april": 4,
    "mei": 5,
    "juni": 6,
    "juli": 7,
    "agustus": 8,
    "september": 9,
    "oktober": 10,
    "november": 11,
    "desember": 12,
}


class DueDateCandidate(NamedTuple):
    """Internal row-level plan; never emitted by the CLI report."""

    bill_id: str
    old_due_date: str
    new_due_date: str
    old_updated_at: str
    format_name: str


def normalize_historical_due_date(value: object) -> tuple[str | None, str]:
    """Return a conservative ISO normalization and a privacy-safe format category."""
    raw = str(value or "")
    cleaned = raw.strip()
    if not cleaned:
        return None, "empty"

    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", cleaned):
        try:
            parsed = date.fromisoformat(cleaned)
        except ValueError:
            return None, "invalid_iso"
        normalized = parsed.isoformat()
        return (normalized if raw != normalized else None), "iso"

    iso_datetime = re.fullmatch(r"(\d{4}-\d{2}-\d{2})(?:[ T].+)", cleaned)
    if iso_datetime:
        try:
            return date.fromisoformat(iso_datetime.group(1)).isoformat(), "iso_datetime"
        except ValueError:
            return None, "invalid_iso_datetime"

    indonesian = re.fullmatch(
        r"(\d{1,2})\s+(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+(\d{4})(?:\s+Pukul\s+.+)?",
        cleaned,
        flags=re.IGNORECASE,
    )
    if indonesian:
        try:
            parsed = date(
                int(indonesian.group(3)),
                MONTHS_ID[indonesian.group(2).casefold()],
                int(indonesian.group(1)),
            )
            return parsed.isoformat(), "indonesian_text"
        except ValueError:
            return None, "invalid_indonesian_text"

    day_first = re.fullmatch(r"(\d{1,2})([./-])(\d{1,2})\2(\d{4})(?:\s+.*)?", cleaned)
    if day_first:
        try:
            parsed = date(int(day_first.group(4)), int(day_first.group(3)), int(day_first.group(1)))
            return parsed.isoformat(), "day_first_numeric"
        except ValueError:
            return None, "invalid_day_first_numeric"

    return None, "unrecognized"


def _schema_version(db_path: Path) -> int:
    with database_connection(db_path) as conn:
        row = conn.execute("select max(version) from schema_migrations").fetchone()
    return int(row[0]) if row and row[0] is not None else 0


def _collect_due_date_plan(db_path: Path) -> tuple[dict[str, object], list[DueDateCandidate]]:
    format_counts: Counter[str] = Counter()
    candidates: list[DueDateCandidate] = []
    already_iso = 0
    unresolved = 0
    with database_connection(db_path) as conn:
        rows = conn.execute(
            """
            select id, due_date, updated_at
            from bills
            where due_date is not null and trim(due_date) <> ''
            order by id
            """
        ).fetchall()
    for row in rows:
        old_due_date = str(row["due_date"])
        normalized, format_name = normalize_historical_due_date(old_due_date)
        format_counts[format_name] += 1
        if format_name == "iso" and normalized is None:
            already_iso += 1
        elif normalized is not None:
            candidates.append(
                DueDateCandidate(
                    str(row["id"]),
                    old_due_date,
                    normalized,
                    str(row["updated_at"]),
                    format_name,
                )
            )
        else:
            unresolved += 1
    report: dict[str, object] = {
        "schema_version": _schema_version(db_path),
        "non_empty_due_dates": len(rows),
        "already_iso": already_iso,
        "normalizable": len(candidates),
        "unresolved": unresolved,
        "format_counts": dict(sorted(format_counts.items())),
    }
    return report, candidates


def inventory_due_dates(db_path: Path) -> dict[str, object]:
    """Return aggregate format counts without bill, student, or payment identifiers."""
    report, _ = _collect_due_date_plan(db_path)
    return report


def _require_current_schema(db_path: Path) -> None:
    version = _schema_version(db_path)
    if version != LATEST_SCHEMA_VERSION:
        raise RuntimeError(
            f"Schema database harus version {LATEST_SCHEMA_VERSION} sebelum backfill; ditemukan version {version}."
        )


def apply_due_date_backfill(
    db_path: Path,
    backup_directory: Path,
    *,
    allow_unresolved: bool = False,
) -> dict[str, object]:
    """Back up the database and atomically apply a reversible due-date normalization plan."""
    _require_current_schema(db_path)
    report, candidates = _collect_due_date_plan(db_path)
    unresolved_value = report["unresolved"]
    if not isinstance(unresolved_value, int):
        raise RuntimeError("Inventory due date menghasilkan tipe unresolved yang tidak valid.")
    unresolved = unresolved_value
    if unresolved and not allow_unresolved:
        raise RuntimeError(
            f"Backfill ditolak karena {unresolved} due date tidak dikenali; review dry-run atau gunakan --allow-unresolved."
        )
    if not candidates:
        return {"mode": "apply", "status": "no_changes", **report}

    backup_archive = backup_database(db_path, backup_directory)
    run_id = f"ddb_{uuid.uuid4().hex}"
    backfill_timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S.%f")
    with database_transaction(db_path) as conn:
        conn.execute(
            """
            insert into due_date_backfill_runs
              (id, status, backup_archive, candidate_count, normalized_count, unresolved_count)
            values (?, 'applied', ?, ?, ?, ?)
            """,
            (
                run_id,
                backup_archive.name,
                len(candidates) + unresolved,
                len(candidates),
                unresolved,
            ),
        )
        for candidate in candidates:
            cursor = conn.execute(
                """
                update bills
                set due_date = ?, updated_at = ?
                where id = ? and due_date = ? and updated_at = ?
                """,
                (
                    candidate.new_due_date,
                    backfill_timestamp,
                    candidate.bill_id,
                    candidate.old_due_date,
                    candidate.old_updated_at,
                ),
            )
            if cursor.rowcount != 1:
                raise RuntimeError("Due date berubah selama backfill; seluruh transaksi dibatalkan.")
            conn.execute(
                """
                insert into due_date_backfill_changes
                  (run_id, bill_id, old_due_date, new_due_date, old_updated_at, new_updated_at)
                values (?, ?, ?, ?, ?, ?)
                """,
                (
                    run_id,
                    candidate.bill_id,
                    candidate.old_due_date,
                    candidate.new_due_date,
                    candidate.old_updated_at,
                    backfill_timestamp,
                ),
            )
    return {
        "mode": "apply",
        "status": "applied",
        "run_id": run_id,
        "backup_archive": str(backup_archive),
        **report,
    }


def rollback_due_date_backfill(db_path: Path, backup_directory: Path, run_id: str) -> dict[str, object]:
    """Back up current state, then atomically restore old values for one backfill run."""
    _require_current_schema(db_path)
    rollback_backup = backup_database(db_path, backup_directory)
    with database_transaction(db_path) as conn:
        run = conn.execute(
            "select id, status from due_date_backfill_runs where id = ?",
            (run_id,),
        ).fetchone()
        if not run:
            raise ValueError("Run backfill tidak ditemukan.")
        if run["status"] != "applied":
            raise ValueError("Run backfill sudah di-rollback atau tidak dapat di-rollback.")
        changes = conn.execute(
            """
            select bill_id, old_due_date, new_due_date, old_updated_at, new_updated_at
            from due_date_backfill_changes
            where run_id = ?
            order by bill_id
            """,
            (run_id,),
        ).fetchall()
        for change in changes:
            cursor = conn.execute(
                """
                update bills
                set due_date = ?, updated_at = ?
                where id = ? and due_date = ? and updated_at = ?
                """,
                (
                    change["old_due_date"],
                    change["old_updated_at"],
                    change["bill_id"],
                    change["new_due_date"],
                    change["new_updated_at"],
                ),
            )
            if cursor.rowcount != 1:
                raise RuntimeError("Rollback ditolak karena due date telah berubah setelah backfill.")
        conn.execute(
            """
            update due_date_backfill_runs
            set status = 'rolled_back', rollback_backup_archive = ?, rolled_back_at = datetime('now')
            where id = ?
            """,
            (rollback_backup.name, run_id),
        )
    return {
        "mode": "rollback",
        "status": "rolled_back",
        "run_id": run_id,
        "restored": len(changes),
        "backup_archive": str(rollback_backup),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Inventaris dan normalisasi reversible due date historis.")
    parser.add_argument("--database", required=True, help="Path database SQLite yang sudah dimigrasikan.")
    action = parser.add_mutually_exclusive_group()
    action.add_argument("--apply", action="store_true", help="Backup lalu terapkan normalisasi yang terukur.")
    action.add_argument("--rollback-run", help="Backup lalu rollback satu run ID backfill.")
    parser.add_argument("--backup-directory", help="Folder backup wajib untuk apply atau rollback.")
    parser.add_argument(
        "--allow-unresolved",
        action="store_true",
        help="Izinkan apply untuk format yang dikenali sambil mempertahankan format unresolved.",
    )
    args = parser.parse_args()
    database = Path(args.database)
    if not database.is_file():
        raise FileNotFoundError(f"Database tidak ditemukan: {database}")

    if args.apply or args.rollback_run:
        if not args.backup_directory:
            parser.error("--backup-directory wajib untuk --apply atau --rollback-run.")
        backup_directory = Path(args.backup_directory)
        if args.apply:
            result = apply_due_date_backfill(
                database,
                backup_directory,
                allow_unresolved=args.allow_unresolved,
            )
        else:
            result = rollback_due_date_backfill(database, backup_directory, str(args.rollback_run))
    else:
        result = {"mode": "dry-run", "status": "planned", **inventory_due_dates(database)}
    print(json.dumps(result, ensure_ascii=True, sort_keys=True))


if __name__ == "__main__":
    main()
