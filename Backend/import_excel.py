from __future__ import annotations

import argparse
import sqlite3
import uuid
from collections import Counter
from pathlib import Path

from db import DEFAULT_DB_PATH, connect, init_db
from excel_reader import normalize_name, normalize_nim, normalize_text, read_sheet

DEFAULT_WORKBOOK = Path(__file__).resolve().parents[1] / "Data_Sinkron_BRIVA_UKT_2023_1_sd_2025_2.xlsx"
DEFAULT_PERIOD = "UKT 2023.1 s/d 2025.2"
DEFAULT_BILL_TYPE = "UKT BRIVA"
DEFAULT_INSTRUCTIONS = (
    "Bayar melalui BRIVA BRI dengan nomor VA yang tampil. "
    "Pastikan nama dan nominal sesuai sebelum menyelesaikan pembayaran."
)


def _amount_to_int(value: str) -> int | None:
    cleaned = normalize_text(value).replace(".", "").replace(",", "")
    if not cleaned or not cleaned.isdigit():
        return None
    return int(cleaned)


def _get_existing_id(conn: sqlite3.Connection, table: str, column: str, value: str) -> str | None:
    row = conn.execute(f"select id from {table} where {column} = ?", (value,)).fetchone()
    return str(row["id"]) if row else None


def _read_sync_rows(workbook: Path) -> tuple[list[dict[str, object]], list[dict[str, object]], list[dict[str, object]]]:
    rows: list[dict[str, object]] = []
    errors: list[dict[str, object]] = []
    sample: list[dict[str, object]] = []

    for record in read_sheet(workbook, "Data Sinkron"):
        nim = normalize_nim(record.get("NIM"))
        full_name = normalize_text(record.get("Nama Mahasiswa"))
        briva = normalize_text(record.get("BRIVA"))
        amount = _amount_to_int(record.get("Jumlah", ""))
        row_number = int(record.get("_row_number") or 0)
        if not nim or not full_name or not briva or amount is None:
            errors.append(
                {
                    "sheet": "Data Sinkron",
                    "row_number": row_number,
                    "severity": "critical",
                    "message": "Data wajib kosong atau nominal tidak valid.",
                }
            )
            continue
        row = {"nim": nim, "full_name": full_name, "briva": briva, "amount": amount, "row_number": row_number}
        rows.append(row)
        if len(sample) < 5:
            sample.append({key: row[key] for key in ("nim", "full_name", "briva", "amount")})

    return rows, errors, sample


def _existing_bills(db_path: str | Path, nims: set[str], period: str) -> tuple[dict[str, sqlite3.Row], dict[str, list[sqlite3.Row]]]:
    if not nims:
        return {}, {}

    conn = connect(db_path)
    init_db(conn)
    placeholders = ",".join("?" for _ in nims)
    rows = conn.execute(
        f"""
        select b.id, b.student_id, b.briva, b.amount, b.period, b.status, s.nim, s.full_name
        from bills b
        join students s on s.id = b.student_id
        where b.period = ? or s.nim in ({placeholders})
        """,
        (period, *sorted(nims)),
    ).fetchall()
    conn.close()

    by_briva = {str(row["briva"]): row for row in rows}
    by_nim: dict[str, list[sqlite3.Row]] = {}
    for row in rows:
        if row["period"] == period:
            by_nim.setdefault(str(row["nim"]), []).append(row)
    return by_briva, by_nim


def _append_limited(items: list[dict[str, object]], item: dict[str, object], limit: int = 12) -> None:
    if len(items) < limit:
        items.append(item)


def _analyze_workbook(
    workbook_path: str | Path,
    db_path: str | Path | None = None,
    period: str = DEFAULT_PERIOD,
) -> dict[str, object]:
    workbook = Path(workbook_path)
    if not workbook.exists():
        raise FileNotFoundError(f"File Excel tidak ditemukan: {workbook}")

    rows, errors, sample = _read_sync_rows(workbook)
    valid_rows = len(rows)
    issue_rows = len(errors)
    critical_rows = len(errors)
    briva_counts = Counter(str(row["briva"]) for row in rows)
    nim_counts = Counter(str(row["nim"]) for row in rows)
    duplicate_briva_rows = 0
    duplicate_nim_rows = 0

    for row in rows:
        if briva_counts[str(row["briva"])] > 1:
            duplicate_briva_rows += 1
            critical_rows += 1
            issue_rows += 1
            _append_limited(
                errors,
                {
                    "sheet": "Data Sinkron",
                    "row_number": row["row_number"],
                    "severity": "critical",
                    "message": "BRIVA duplikat dalam file. Setiap BRIVA hanya boleh muncul satu kali.",
                },
            )
        if nim_counts[str(row["nim"])] > 1:
            duplicate_nim_rows += 1
            critical_rows += 1
            issue_rows += 1
            _append_limited(
                errors,
                {
                    "sheet": "Data Sinkron",
                    "row_number": row["row_number"],
                    "severity": "critical",
                    "message": "NIM duplikat dalam file untuk periode yang sama.",
                },
            )

    by_briva: dict[str, sqlite3.Row] = {}
    by_nim: dict[str, list[sqlite3.Row]] = {}
    if db_path is not None:
        by_briva, by_nim = _existing_bills(db_path, {str(row["nim"]) for row in rows}, period)

    new_rows = 0
    unchanged_rows = 0
    update_rows = 0
    amount_change_rows = 0
    briva_change_rows = 0
    conflict_rows = 0
    requires_update_confirmation = False
    changes: list[dict[str, object]] = []
    actions: list[dict[str, object]] = []

    for row in rows:
        nim = str(row["nim"])
        briva = str(row["briva"])
        amount = int(row["amount"])
        existing_briva = by_briva.get(briva)
        current_bills = by_nim.get(nim, [])

        if existing_briva:
            if existing_briva["nim"] != nim:
                critical_rows += 1
                issue_rows += 1
                conflict_rows += 1
                _append_limited(
                    errors,
                    {
                        "sheet": "Data Sinkron",
                        "row_number": row["row_number"],
                        "severity": "critical",
                        "message": "BRIVA sudah terdaftar untuk NIM lain.",
                    },
                )
                continue
            if existing_briva["period"] != period:
                critical_rows += 1
                issue_rows += 1
                conflict_rows += 1
                _append_limited(
                    errors,
                    {
                        "sheet": "Data Sinkron",
                        "row_number": row["row_number"],
                        "severity": "critical",
                        "message": "BRIVA sudah terdaftar pada periode lain.",
                    },
                )
                continue

            amount_changed = int(existing_briva["amount"]) != amount
            name_changed = normalize_name(str(existing_briva["full_name"])) != normalize_name(str(row["full_name"]))
            if existing_briva["status"] == "paid" and amount_changed:
                critical_rows += 1
                issue_rows += 1
                conflict_rows += 1
                _append_limited(
                    errors,
                    {
                        "sheet": "Data Sinkron",
                        "row_number": row["row_number"],
                        "severity": "critical",
                        "message": "Nominal tagihan yang sudah lunas tidak boleh diubah melalui import.",
                    },
                )
                continue

            if not amount_changed and not name_changed:
                unchanged_rows += 1
                actions.append({"type": "unchanged", "row": row, "existing": existing_briva})
                continue

            update_rows += 1
            if amount_changed:
                amount_change_rows += 1
                requires_update_confirmation = True
            action = "update_amount" if amount_changed else "update_name"
            actions.append({"type": action, "row": row, "existing": existing_briva})
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
            continue

        if len(current_bills) == 0:
            new_rows += 1
            actions.append({"type": "new", "row": row, "existing": None})
            continue

        if len(current_bills) > 1:
            critical_rows += 1
            issue_rows += 1
            conflict_rows += 1
            _append_limited(
                errors,
                {
                    "sheet": "Data Sinkron",
                    "row_number": row["row_number"],
                    "severity": "critical",
                    "message": "Mahasiswa sudah memiliki lebih dari satu tagihan pada periode ini. Perlu koreksi manual.",
                },
            )
            continue

        existing = current_bills[0]
        if existing["status"] == "paid":
            critical_rows += 1
            issue_rows += 1
            conflict_rows += 1
            _append_limited(
                errors,
                {
                    "sheet": "Data Sinkron",
                    "row_number": row["row_number"],
                    "severity": "critical",
                    "message": "BRIVA tagihan yang sudah lunas tidak boleh diganti melalui import.",
                },
            )
            continue

        update_rows += 1
        briva_change_rows += 1
        requires_update_confirmation = True
        if int(existing["amount"]) != amount:
            amount_change_rows += 1
        actions.append({"type": "replace_briva", "row": row, "existing": existing})
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

    for record in read_sheet(workbook, "Data Belum Lengkap"):
        issue_rows += 1
        _append_limited(
            errors,
            {
                "sheet": "Data Belum Lengkap",
                "row_number": int(record.get("_row_number") or 0),
                "severity": "warning",
                "message": normalize_text(record.get("Keterangan")) or "Data belum lengkap.",
            },
        )

    return {
        "valid_rows": valid_rows,
        "critical_rows": critical_rows,
        "issue_rows": issue_rows,
        "new_rows": new_rows,
        "unchanged_rows": unchanged_rows,
        "update_rows": update_rows,
        "amount_change_rows": amount_change_rows,
        "briva_change_rows": briva_change_rows,
        "duplicate_briva_rows": duplicate_briva_rows,
        "duplicate_nim_rows": duplicate_nim_rows,
        "conflict_rows": conflict_rows,
        "requires_update_confirmation": requires_update_confirmation,
        "sample": sample,
        "changes": changes,
        "errors": errors,
        "actions": actions,
    }


def preview_workbook(
    workbook_path: str | Path,
    db_path: str | Path | None = None,
    period: str = DEFAULT_PERIOD,
) -> dict[str, object]:
    analysis = _analyze_workbook(workbook_path, db_path, period)
    return {key: value for key, value in analysis.items() if key != "actions"}


def _upsert_student(conn: sqlite3.Connection, nim: str, full_name: str) -> str:
    student_id = _get_existing_id(conn, "students", "nim", nim) or str(uuid.uuid4())
    conn.execute(
        """
        insert into students (id, nim, full_name, name_norm, updated_at)
        values (?, ?, ?, ?, datetime('now'))
        on conflict(nim) do update set
          full_name = excluded.full_name,
          name_norm = excluded.name_norm,
          updated_at = datetime('now')
        """,
        (student_id, nim, full_name, normalize_name(full_name)),
    )
    return student_id


def import_workbook(
    workbook_path: str | Path = DEFAULT_WORKBOOK,
    db_path: str | Path = DEFAULT_DB_PATH,
    period: str = DEFAULT_PERIOD,
    bill_type: str = DEFAULT_BILL_TYPE,
    source_file_name: str | None = None,
    confirm_updates: bool = False,
) -> dict[str, int]:
    workbook = Path(workbook_path)
    analysis = _analyze_workbook(workbook, db_path, period)
    if analysis["critical_rows"]:
        raise ValueError("Import dibatalkan karena ada duplikasi atau konflik kritis.")
    if analysis["requires_update_confirmation"] and not confirm_updates:
        raise ValueError("Perubahan nominal atau BRIVA memerlukan konfirmasi admin.")

    conn = connect(db_path)
    init_db(conn)
    source_file = source_file_name or workbook.name
    issues = 0
    created = 0
    updated = 0

    with conn:
        conn.execute("delete from import_issues where source_file = ?", (source_file,))
        for action in analysis["actions"]:
            action_type = str(action["type"])
            if action_type == "unchanged":
                continue
            row = action["row"]
            assert isinstance(row, dict)
            nim = str(row["nim"])
            full_name = str(row["full_name"])
            briva = str(row["briva"])
            amount = int(row["amount"])
            student_id = _upsert_student(conn, nim, full_name)

            if action_type == "new":
                conn.execute(
                    """
                    insert into bills
                      (id, student_id, briva, amount, period, bill_type, status, instructions, source_file, updated_at)
                    values (?, ?, ?, ?, ?, ?, 'unpaid', ?, ?, datetime('now'))
                    """,
                    (str(uuid.uuid4()), student_id, briva, amount, period, bill_type, DEFAULT_INSTRUCTIONS, source_file),
                )
                created += 1
                continue

            existing = action["existing"]
            assert isinstance(existing, sqlite3.Row)
            if action_type == "replace_briva":
                conn.execute(
                    """
                    update bills set student_id = ?, briva = ?, amount = ?, bill_type = ?, source_file = ?, updated_at = datetime('now')
                    where id = ?
                    """,
                    (student_id, briva, amount, bill_type, source_file, existing["id"]),
                )
            else:
                conn.execute(
                    """
                    update bills set student_id = ?, amount = ?, bill_type = ?, source_file = ?, updated_at = datetime('now')
                    where id = ?
                    """,
                    (student_id, amount, bill_type, source_file, existing["id"]),
                )
            updated += 1

        for record in read_sheet(workbook, "Data Belum Lengkap"):
            issues += 1
            conn.execute(
                """
                insert into import_issues
                  (id, sheet_name, row_number, nim, full_name, briva, amount, note, source_file)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(uuid.uuid4()),
                    "Data Belum Lengkap",
                    int(record.get("_row_number") or 0),
                    normalize_nim(record.get("NIM")),
                    normalize_text(record.get("Nama Mahasiswa")),
                    normalize_text(record.get("BRIVA")),
                    normalize_text(record.get("Jumlah")),
                    normalize_text(record.get("Keterangan")) or "Data belum lengkap.",
                    source_file,
                ),
            )

    conn.close()
    return {
        "imported": created + updated,
        "created": created,
        "updated": updated,
        "unchanged": int(analysis["unchanged_rows"]),
        "issues": issues,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Import data BRIVA UKT ke SQLite.")
    parser.add_argument("--file", default=str(DEFAULT_WORKBOOK), help="Path file .xlsx")
    parser.add_argument("--db", default=str(DEFAULT_DB_PATH), help="Path file SQLite")
    parser.add_argument("--period", default=DEFAULT_PERIOD)
    parser.add_argument("--confirm-updates", action="store_true", help="Setujui perubahan nominal atau BRIVA.")
    args = parser.parse_args()

    result = import_workbook(args.file, args.db, args.period, confirm_updates=args.confirm_updates)
    print(f"Changed rows: {result['imported']}")
    print(f"Unchanged rows: {result['unchanged']}")
    print(f"Issue rows: {result['issues']}")
    print(f"Database: {Path(args.db).resolve()}")


if __name__ == "__main__":
    main()
