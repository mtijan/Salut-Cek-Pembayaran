from __future__ import annotations

import argparse
import sqlite3
import sys
import uuid
from pathlib import Path
from typing import Any, cast

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


from Backend.db import (
    DEFAULT_DB_PATH,
    database_transaction,
    migrate_database,
    parse_entry_registration,
    resolve_study_program_id,
)
from Backend.excel_reader import (
    clean_demographic_value,
    clean_excel_text,
    normalize_imported_name,
    normalize_name,
    normalize_nim,
    read_sheet,
)

from Backend.importing.analysis import _analyze_workbook, preview_workbook
from Backend.importing.workbook import (
    DEFAULT_BILL_TYPE,
    DEFAULT_INSTRUCTIONS,
    DEFAULT_WORKBOOK,
    _normalize_briva,
    _require_headers,
    generate_master_data_template,
)

__all__ = ["generate_master_data_template", "import_workbook", "preview_workbook"]


def _get_existing_id(conn: sqlite3.Connection, table: str, column: str, value: str) -> str | None:
    row = conn.execute(f"select id from {table} where {column} = ?", (value,)).fetchone()
    return str(row["id"]) if row else None


def _upsert_student(conn: sqlite3.Connection, row: dict[str, object]) -> str:
    nim = str(row["nim"])
    full_name = normalize_imported_name(row["full_name"])
    student_id = _get_existing_id(conn, "students", "nim", nim) or str(uuid.uuid4())

    no_ktp = clean_demographic_value(row.get("no_ktp"))
    tempat_lahir = clean_demographic_value(row.get("tempat_lahir"))
    tanggal_lahir = clean_demographic_value(row.get("tanggal_lahir"))
    nama_ibu_kandung = clean_demographic_value(row.get("nama_ibu_kandung"))
    email = clean_demographic_value(row.get("email"))
    phone_number = normalize_nim(row.get("phone_number")) if row.get("phone_number") else None
    initial_reg = clean_demographic_value(row.get("initial_registration"))
    program_study = clean_demographic_value(row.get("program_study"))

    entry_year = row.get("entry_year")
    entry_semester = row.get("entry_semester")
    entry_period = row.get("entry_period")
    if entry_year is None or entry_semester is None or entry_period is None:
        y, s, p = parse_entry_registration(initial_reg)
        entry_year = entry_year or y
        entry_semester = entry_semester or s
        entry_period = entry_period or p

    conn.execute(
        """
        insert into students (
            id, nim, full_name, name_norm, no_ktp, tempat_lahir, tanggal_lahir, nama_ibu_kandung,
            program_study, initial_registration, entry_year, entry_semester, entry_period,
            phone_number, email, academic_status, updated_at
        )
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aktif', datetime('now'))
        on conflict(nim) do update set
          full_name = excluded.full_name,
          name_norm = excluded.name_norm,
          deleted_at = null,
          deleted_by = null,
          delete_reason = null,
          no_ktp = case when excluded.no_ktp is not null and excluded.no_ktp <> '' then excluded.no_ktp else students.no_ktp end,
          tempat_lahir = case when excluded.tempat_lahir is not null and excluded.tempat_lahir <> '' then excluded.tempat_lahir else students.tempat_lahir end,
          tanggal_lahir = case when excluded.tanggal_lahir is not null and excluded.tanggal_lahir <> '' then excluded.tanggal_lahir else students.tanggal_lahir end,
          nama_ibu_kandung = case when excluded.nama_ibu_kandung is not null and excluded.nama_ibu_kandung <> '' then excluded.nama_ibu_kandung else students.nama_ibu_kandung end,
          program_study = case when excluded.program_study is not null and excluded.program_study <> '' then excluded.program_study else students.program_study end,
          initial_registration = case when excluded.initial_registration is not null and excluded.initial_registration <> '' then excluded.initial_registration else students.initial_registration end,
          entry_year = case when excluded.entry_year is not null then excluded.entry_year else students.entry_year end,
          entry_semester = case when excluded.entry_semester is not null then excluded.entry_semester else students.entry_semester end,
          entry_period = case when excluded.entry_period is not null then excluded.entry_period else students.entry_period end,
          phone_number = case when excluded.phone_number is not null and excluded.phone_number <> '' then excluded.phone_number else students.phone_number end,
          email = case when excluded.email is not null and excluded.email <> '' then excluded.email else students.email end,
          updated_at = datetime('now')
        """,
        (
            student_id,
            nim,
            full_name,
            normalize_name(full_name),
            no_ktp,
            tempat_lahir,
            tanggal_lahir,
            nama_ibu_kandung,
            program_study,
            initial_reg,
            entry_year,
            entry_semester,
            entry_period,
            phone_number,
            email,
        ),
    )
    if program_study:
        sp_id = resolve_study_program_id(conn, program_study)
        if sp_id:
            conn.execute("update students set study_program_id = ? where id = ?", (sp_id, student_id))
    return student_id


def _store_import_issue(conn: sqlite3.Connection, issue: dict[str, object], source_file: str) -> None:
    conn.execute(
        """
        insert into import_issues
          (id, sheet_name, row_number, nim, full_name, briva, amount, note, source_file)
        values (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            str(uuid.uuid4()),
            str(issue["sheet_name"]),
            int(cast(Any, issue["row_number"])),
            str(issue.get("nim") or ""),
            str(issue.get("full_name") or ""),
            str(issue.get("briva") or ""),
            str(issue.get("amount") or ""),
            str(issue["note"]),
            source_file,
        ),
    )


def import_workbook(
    workbook_path: str | Path = DEFAULT_WORKBOOK,
    db_path: str | Path = DEFAULT_DB_PATH,
    period: str | None = None,
    bill_type: str = DEFAULT_BILL_TYPE,
    source_file_name: str | None = None,
    confirm_updates: bool = False,
    actor_id: str | None = None,
) -> dict[str, object]:
    workbook = Path(workbook_path)
    source_file = source_file_name or workbook.name
    analysis = _analyze_workbook(workbook, db_path, period, source_file)
    if analysis["critical_rows"]:
        raise ValueError("Import dibatalkan karena ada duplikasi atau konflik kritis.")
    if analysis["requires_update_confirmation"] and not confirm_updates:
        raise ValueError("Perubahan nominal atau BRIVA memerlukan konfirmasi admin.")

    issues = 0
    created = 0
    updated = 0
    issue_details: list[dict[str, object]] = []

    with database_transaction(db_path) as conn:
        conn.execute("delete from import_issues where source_file = ?", (source_file,))
        for issue in cast(list[dict[str, object]], analysis["_skipped_issues"]):
            assert isinstance(issue, dict)
            _store_import_issue(conn, issue, source_file)
            issues += 1
            if len(issue_details) < 5:
                issue_details.append(
                    {"sheet": issue["sheet_name"], "row_number": issue["row_number"], "note": issue["note"]}
                )
        for action in cast(list[dict[str, object]], analysis["actions"]):
            action_type = str(action["type"])
            if action_type == "unchanged":
                continue
            row = action["row"]
            assert isinstance(row, dict)
            briva = str(row["briva"])
            amount = int(row["amount"])
            row_number = int(row["row_number"])
            due_date = clean_excel_text(row.get("due_date")) or None
            student_id = _upsert_student(conn, row)

            if action_type == "new":
                conn.execute(
                    """
                    insert into bills
                      (id, student_id, briva, amount, period, bill_type, status, instructions, due_date, source_file, source_row_number, updated_at)
                    values (?, ?, ?, ?, ?, ?, 'unpaid', ?, ?, ?, ?, datetime('now'))
                    """,
                    (
                        str(uuid.uuid4()),
                        student_id,
                        briva,
                        amount,
                        str(row["period"]),
                        bill_type,
                        DEFAULT_INSTRUCTIONS,
                        due_date,
                        source_file,
                        row_number,
                    ),
                )
                created += 1
                continue

            existing = action["existing"]
            assert isinstance(existing, sqlite3.Row)
            conn.execute(
                """
                update bills set student_id = ?, briva = ?, amount = ?, period = ?, bill_type = ?, due_date = ?,
                    source_file = ?, source_row_number = ?, updated_at = datetime('now')
                where id = ?
                """,
                (
                    student_id,
                    briva,
                    amount,
                    str(row["period"]),
                    bill_type,
                    due_date,
                    source_file,
                    row_number,
                    existing["id"],
                ),
            )
            updated += 1

        layout = _require_headers(workbook)
        if layout.issue_sheet:
            for record in read_sheet(workbook, layout.issue_sheet):
                issues += 1
                issue = {
                    "sheet_name": layout.issue_sheet,
                    "row_number": int(record.get("_row_number") or 0),
                    "nim": normalize_nim(record.get("NIM")),
                    "full_name": clean_excel_text(record.get("Nama Mahasiswa")),
                    "briva": _normalize_briva(record.get("BRIVA")),
                    "amount": clean_excel_text(record.get("Jumlah")),
                    "note": clean_excel_text(record.get("Keterangan")) or "Data belum lengkap.",
                }
                _store_import_issue(conn, issue, source_file)
                if len(issue_details) < 5:
                    issue_details.append(
                        {"sheet": issue["sheet_name"], "row_number": issue["row_number"], "note": issue["note"]}
                    )

        if actor_id:
            from Backend.app.services import audit as _audit

            _audit.write_audit(
                conn,
                actor_id,
                "import.commit",
                "excel_import",
                source_file,
                {"file_name": source_file, "created": created, "updated": updated, "issues": issues},
            )

    return {
        "imported": created + updated,
        "created": created,
        "updated": updated,
        "unchanged": int(cast(Any, analysis["unchanged_rows"])),
        "issues": issues,
        "issue_details": issue_details,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Import data BRIVA UKT ke SQLite.")
    parser.add_argument("--file", default=str(DEFAULT_WORKBOOK), help="Path file .xlsx")
    parser.add_argument("--db", default=str(DEFAULT_DB_PATH), help="Path file SQLite")
    parser.add_argument("--period", help="Opsional. Default mengikuti struktur workbook.")
    parser.add_argument("--confirm-updates", action="store_true", help="Setujui perubahan nominal atau BRIVA.")
    args = parser.parse_args()

    migrate_database(args.db)
    result = import_workbook(args.file, args.db, args.period, confirm_updates=args.confirm_updates)
    print(f"Changed rows: {result['imported']}")
    print(f"Unchanged rows: {result['unchanged']}")
    print(f"Issue rows: {result['issues']}")
    print(f"Database: {Path(args.db).resolve()}")


if __name__ == "__main__":
    main()
