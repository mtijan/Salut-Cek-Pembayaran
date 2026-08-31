"""Read-only workbook comparison, conflict analysis, and preview."""

from __future__ import annotations

import sqlite3
from collections import Counter
from pathlib import Path
from typing import Any, cast

from Backend.db import database_connection
from Backend.excel_reader import normalize_name, normalize_text, read_sheet
from Backend.importing.workbook import ImportLayout, _read_sync_rows, _require_headers


def _existing_bills(
    db_path: str | Path,
    nims: set[str],
    period: str,
    source_file: str,
) -> tuple[dict[str, list[sqlite3.Row]], dict[str, list[sqlite3.Row]], dict[int, sqlite3.Row]]:
    """Query existing database bills matching target NIMs, period, or workbook source filename."""
    if not nims:
        return {}, {}, {}

    placeholders = ",".join("?" for _ in nims)
    with database_connection(db_path) as conn:
        rows = conn.execute(
            f"""
            select b.id, b.student_id, b.briva, b.amount, b.period, b.status, b.source_file, b.source_row_number,
                   b.due_date, s.nim, s.full_name, s.program_study, s.initial_registration, s.phone_number
            from bills b
            join students s on s.id = b.student_id
            where (b.source_file = ? or b.period = ? or s.nim in ({placeholders}))
              and b.deleted_at is null
              and s.deleted_at is null
            """,
            (source_file, period, *sorted(nims)),
        ).fetchall()

    by_briva: dict[str, list[sqlite3.Row]] = {}
    by_nim: dict[str, list[sqlite3.Row]] = {}
    by_source_row: dict[int, sqlite3.Row] = {}
    for row in rows:
        by_briva.setdefault(str(row["briva"]), []).append(row)
        if row["period"] == period:
            by_nim.setdefault(str(row["nim"]), []).append(row)
        if row["source_file"] == source_file and row["source_row_number"] is not None:
            by_source_row[int(row["source_row_number"])] = row
    return by_briva, by_nim, by_source_row


def _append_limited(items: list[dict[str, object]], item: dict[str, object], limit: int = 12) -> None:
    """Append item to list if count is strictly below the limit threshold."""
    if len(items) < limit:
        items.append(item)


def _detect_in_file_conflicts(
    rows: list[dict[str, object]],
    layout: ImportLayout,
    errors: list[dict[str, object]],
) -> tuple[int, int, int]:
    """Check for in-file conflicts (duplicate BRIVA across different NIMs or multiple bills per NIM)."""
    briva_counts = Counter(str(row["briva"]) for row in rows)
    nim_counts = Counter(str(row["nim"]) for row in rows)
    duplicate_briva_conflict_rows = 0
    multiple_bill_rows = 0
    critical_in_file = 0

    for row in rows:
        rows_with_same_briva = [candidate for candidate in rows if candidate["briva"] == row["briva"]]
        nims_for_same_briva = {str(candidate["nim"]) for candidate in rows_with_same_briva}
        if briva_counts[str(row["briva"])] > 1 and len(nims_for_same_briva) > 1:
            duplicate_briva_conflict_rows += 1
            critical_in_file += 1
            _append_limited(
                errors,
                {
                    "sheet": layout.data_sheet,
                    "row_number": row["row_number"],
                    "severity": "critical",
                    "message": "BRIVA yang sama muncul untuk NIM berbeda dalam file.",
                },
            )
        if nim_counts[str(row["nim"])] > 1:
            multiple_bill_rows += 1
            _append_limited(
                errors,
                {
                    "sheet": layout.data_sheet,
                    "row_number": row["row_number"],
                    "severity": "warning",
                    "message": "NIM muncul lebih dari satu kali. Sistem akan menyimpan sebagai beberapa tagihan.",
                },
            )

    return duplicate_briva_conflict_rows, multiple_bill_rows, critical_in_file


def _evaluate_row_diff(
    row: dict[str, object],
    effective_period: str,
    layout: ImportLayout,
    nim_counts: Counter[str],
    by_briva: dict[str, list[sqlite3.Row]],
    by_nim: dict[str, list[sqlite3.Row]],
    by_source_row: dict[int, sqlite3.Row],
    used_existing_bill_ids: set[str],
    errors: list[dict[str, object]],
    changes: list[dict[str, object]],
    actions: list[dict[str, object]],
    counters: dict[str, int],
) -> None:
    """Compare a single spreadsheet row against database state and classify action."""
    nim = str(row["nim"])
    briva = str(row["briva"])
    amount = int(cast(Any, row["amount"]))
    row_number = int(cast(Any, row["row_number"]))
    existing_source_row = by_source_row.get(row_number)
    matching_briva_rows = [
        candidate
        for candidate in by_briva.get(briva, [])
        if candidate["nim"] == nim
        and candidate["period"] == effective_period
        and str(candidate["id"]) not in used_existing_bill_ids
    ]
    conflicting_briva_rows = [candidate for candidate in by_briva.get(briva, []) if candidate["nim"] != nim]
    existing_briva = matching_briva_rows[0] if matching_briva_rows else None
    current_bills = [
        candidate for candidate in by_nim.get(nim, []) if str(candidate["id"]) not in used_existing_bill_ids
    ]

    if existing_source_row:
        if existing_source_row["nim"] != nim:
            counters["critical_rows"] += 1
            counters["conflict_rows"] += 1
            _append_limited(
                errors,
                {
                    "sheet": layout.data_sheet,
                    "row_number": row["row_number"],
                    "severity": "critical",
                    "message": "Baris sumber file ini sebelumnya terdaftar untuk NIM lain.",
                },
            )
            return
        if str(existing_source_row["id"]) not in used_existing_bill_ids:
            existing_briva = existing_source_row

    if conflicting_briva_rows:
        counters["critical_rows"] += 1
        counters["conflict_rows"] += 1
        _append_limited(
            errors,
            {
                "sheet": layout.data_sheet,
                "row_number": row["row_number"],
                "severity": "critical",
                "message": "BRIVA sudah terdaftar untuk NIM lain.",
            },
        )
        return

    if existing_briva:
        if existing_briva["period"] != effective_period:
            counters["critical_rows"] += 1
            counters["conflict_rows"] += 1
            _append_limited(
                errors,
                {
                    "sheet": layout.data_sheet,
                    "row_number": row["row_number"],
                    "severity": "critical",
                    "message": "BRIVA sudah terdaftar pada periode lain.",
                },
            )
            return

        amount_changed = int(existing_briva["amount"]) != amount
        name_changed = normalize_name(str(existing_briva["full_name"])) != normalize_name(str(row["full_name"]))
        program_changed = normalize_text(existing_briva["program_study"]) != normalize_text(row["program_study"])
        registration_changed = normalize_text(existing_briva["initial_registration"]) != normalize_text(
            row["initial_registration"]
        )
        phone_changed = normalize_text(existing_briva["phone_number"]) != normalize_text(row["phone_number"])
        due_date_changed = normalize_text(existing_briva["due_date"]) != normalize_text(row["due_date"])
        if existing_briva["status"] != "unpaid" and amount_changed:
            counters["critical_rows"] += 1
            counters["conflict_rows"] += 1
            _append_limited(
                errors,
                {
                    "sheet": layout.data_sheet,
                    "row_number": row["row_number"],
                    "severity": "critical",
                    "message": "Nominal tagihan yang sudah lunas atau dicicil tidak boleh diubah melalui import.",
                },
            )
            return

        if not any(
            (amount_changed, name_changed, program_changed, registration_changed, phone_changed, due_date_changed)
        ):
            counters["unchanged_rows"] += 1
            actions.append({"type": "unchanged", "row": row, "existing": existing_briva})
            used_existing_bill_ids.add(str(existing_briva["id"]))
            return

        counters["update_rows"] += 1
        if amount_changed:
            counters["amount_change_rows"] += 1
            counters["requires_update_confirmation"] = 1
        action = "update_amount" if amount_changed else "update_profile"
        actions.append({"type": action, "row": row, "existing": existing_briva})
        used_existing_bill_ids.add(str(existing_briva["id"]))
        if len(changes) < 10:
            changes.append(
                {
                    "row_number": row["row_number"],
                    "nim": nim,
                    "full_name": row["full_name"],
                    "change_type": "nominal" if amount_changed else "nama",
                    "old_briva": existing_briva["briva"],
                    "new_briva": briva,
                    "old_amount": existing_briva["amount"],
                    "new_amount": amount,
                }
            )
        return

    has_multiple_rows_for_nim = nim_counts[nim] > 1
    if len(current_bills) == 0 or has_multiple_rows_for_nim or len(current_bills) > 1:
        counters["new_rows"] += 1
        actions.append({"type": "new", "row": row, "existing": None})
        return

    existing = current_bills[0]
    if existing["status"] != "unpaid":
        counters["critical_rows"] += 1
        counters["conflict_rows"] += 1
        _append_limited(
            errors,
            {
                "sheet": layout.data_sheet,
                "row_number": row["row_number"],
                "severity": "critical",
                "message": "BRIVA tagihan yang sudah lunas atau dicicil tidak boleh diganti melalui import.",
            },
        )
        return

    counters["update_rows"] += 1
    counters["briva_change_rows"] += 1
    counters["requires_update_confirmation"] = 1
    if int(existing["amount"]) != amount:
        counters["amount_change_rows"] += 1
    actions.append({"type": "replace_briva", "row": row, "existing": existing})
    used_existing_bill_ids.add(str(existing["id"]))
    if len(changes) < 10:
        changes.append(
            {
                "row_number": row["row_number"],
                "nim": nim,
                "full_name": row["full_name"],
                "change_type": "BRIVA dan nominal" if int(existing["amount"]) != amount else "BRIVA",
                "old_briva": existing["briva"],
                "new_briva": briva,
                "old_amount": existing["amount"],
                "new_amount": amount,
            }
        )


def _analyze_workbook(
    workbook_path: str | Path,
    db_path: str | Path | None = None,
    period: str | None = None,
    source_file_name: str | None = None,
) -> dict[str, object]:
    """Execute deep diff comparison between spreadsheet rows and existing database state."""
    workbook = Path(workbook_path)
    if not workbook.exists():
        raise FileNotFoundError(f"File Excel tidak ditemukan: {workbook}")

    layout = _require_headers(workbook)
    effective_period = period or layout.default_period
    source_file = source_file_name or workbook.name
    rows, errors, sample, identity_conflict_rows, skipped_issues = _read_sync_rows(workbook, layout, effective_period)
    valid_rows = len(rows)

    dup_briva, multi_bill, crit_in_file = _detect_in_file_conflicts(rows, layout, errors)

    by_briva: dict[str, list[sqlite3.Row]] = {}
    by_nim: dict[str, list[sqlite3.Row]] = {}
    by_source_row: dict[int, sqlite3.Row] = {}
    if db_path is not None:
        by_briva, by_nim, by_source_row = _existing_bills(
            db_path, {str(row["nim"]) for row in rows}, effective_period, source_file
        )

    counters: dict[str, int] = {
        "critical_rows": sum(1 for e in errors if e["severity"] == "critical"),
        "new_rows": 0,
        "unchanged_rows": 0,
        "update_rows": 0,
        "amount_change_rows": 0,
        "briva_change_rows": 0,
        "conflict_rows": 0,
        "requires_update_confirmation": 0,
    }
    changes: list[dict[str, object]] = []
    actions: list[dict[str, object]] = []
    used_existing_bill_ids: set[str] = set()
    nim_counts = Counter(str(row["nim"]) for row in rows)

    for row in rows:
        _evaluate_row_diff(
            row=row,
            effective_period=effective_period,
            layout=layout,
            nim_counts=nim_counts,
            by_briva=by_briva,
            by_nim=by_nim,
            by_source_row=by_source_row,
            used_existing_bill_ids=used_existing_bill_ids,
            errors=errors,
            changes=changes,
            actions=actions,
            counters=counters,
        )

    issue_rows = len(errors)
    if layout.issue_sheet:
        for record in read_sheet(workbook, layout.issue_sheet):
            issue_rows += 1
            _append_limited(
                errors,
                {
                    "sheet": layout.issue_sheet,
                    "row_number": int(record.get("_row_number") or 0),
                    "severity": "warning",
                    "message": normalize_text(record.get("Keterangan")) or "Data belum lengkap.",
                },
            )

    return {
        "valid_rows": valid_rows,
        "critical_rows": counters["critical_rows"],
        "issue_rows": issue_rows,
        "new_rows": counters["new_rows"],
        "unchanged_rows": counters["unchanged_rows"],
        "update_rows": counters["update_rows"],
        "amount_change_rows": counters["amount_change_rows"],
        "briva_change_rows": counters["briva_change_rows"],
        "duplicate_briva_conflict_rows": dup_briva,
        "multiple_bill_rows": multi_bill,
        "identity_conflict_rows": identity_conflict_rows,
        "skipped_rows": len(skipped_issues),
        "conflict_rows": counters["conflict_rows"],
        "requires_update_confirmation": bool(counters["requires_update_confirmation"]),
        "sample": sample,
        "changes": changes,
        "errors": errors,
        "_skipped_issues": skipped_issues,
        "actions": actions,
    }


def preview_workbook(
    workbook_path: str | Path,
    db_path: str | Path | None = None,
    period: str | None = None,
    source_file_name: str | None = None,
) -> dict[str, object]:
    """Generate user-facing preview response payload for Excel workbook import."""
    analysis = _analyze_workbook(workbook_path, db_path, period, source_file_name)
    return {key: value for key, value in analysis.items() if key not in {"actions", "_skipped_issues"}}
