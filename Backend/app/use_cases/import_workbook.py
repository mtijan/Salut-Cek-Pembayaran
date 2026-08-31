"""Transactional use case for committing an analyzed Excel workbook."""

from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any, cast

from Backend.app.repositories.imports import ImportRepository
from Backend.app.repositories.students import StudentRepository
from Backend.db import database_transaction, parse_entry_registration, resolve_study_program_id
from Backend.excel_reader import (
    clean_demographic_value,
    clean_excel_text,
    normalize_imported_name,
    normalize_name,
    normalize_nim,
    read_sheet,
)
from Backend.importing.workbook import DEFAULT_INSTRUCTIONS, _normalize_briva, _require_headers


def _import_student_profile(row: dict[str, object]) -> dict[str, object]:
    initial_registration = clean_demographic_value(row.get("initial_registration"))
    entry_year = row.get("entry_year")
    entry_semester = row.get("entry_semester")
    entry_period = row.get("entry_period")
    if entry_year is None or entry_semester is None or entry_period is None:
        parsed_year, parsed_semester, parsed_period = parse_entry_registration(initial_registration)
        entry_year = entry_year or parsed_year
        entry_semester = entry_semester or parsed_semester
        entry_period = entry_period or parsed_period

    full_name = normalize_imported_name(row["full_name"])
    return {
        "nim": str(row["nim"]),
        "full_name": full_name,
        "name_norm": normalize_name(full_name),
        "no_ktp": clean_demographic_value(row.get("no_ktp")),
        "tempat_lahir": clean_demographic_value(row.get("tempat_lahir")),
        "tanggal_lahir": clean_demographic_value(row.get("tanggal_lahir")),
        "nama_ibu_kandung": clean_demographic_value(row.get("nama_ibu_kandung")),
        "program_study": clean_demographic_value(row.get("program_study")),
        "initial_registration": initial_registration,
        "entry_year": entry_year,
        "entry_semester": entry_semester,
        "entry_period": entry_period,
        "phone_number": normalize_nim(row.get("phone_number")) if row.get("phone_number") else None,
        "email": clean_demographic_value(row.get("email")),
    }


def _upsert_import_student(conn: sqlite3.Connection, row: dict[str, object]) -> str:
    profile = _import_student_profile(row)
    student_repo = StudentRepository(conn)
    student_id = student_repo.upsert_import_profile(profile)
    program_study = profile.get("program_study")
    if program_study:
        study_program_id = resolve_study_program_id(conn, str(program_study))
        if study_program_id:
            student_repo.set_study_program(student_id, study_program_id)
    return student_id


def _issue_from_sheet(record: dict[str, str], sheet_name: str) -> dict[str, object]:
    return {
        "sheet_name": sheet_name,
        "row_number": int(record.get("_row_number") or 0),
        "nim": normalize_nim(record.get("NIM")),
        "full_name": clean_excel_text(record.get("Nama Mahasiswa")),
        "briva": _normalize_briva(record.get("BRIVA")),
        "amount": clean_excel_text(record.get("Jumlah")),
        "note": clean_excel_text(record.get("Keterangan")) or "Data belum lengkap.",
    }


def commit_analyzed_workbook(
    workbook: Path,
    db_path: str | Path,
    analysis: dict[str, object],
    *,
    source_file: str,
    bill_type: str,
    actor_id: str | None,
) -> dict[str, object]:
    """Commit analyzed actions, issues, and audit metadata in one transaction."""
    issues = 0
    created = 0
    updated = 0
    issue_details: list[dict[str, object]] = []

    with database_transaction(db_path) as conn:
        repository = ImportRepository(conn)
        repository.clear_issues(source_file)
        for issue in cast(list[dict[str, object]], analysis["_skipped_issues"]):
            repository.store_issue(issue, source_file)
            issues += 1
            if len(issue_details) < 5:
                issue_details.append(
                    {"sheet": issue["sheet_name"], "row_number": issue["row_number"], "note": issue["note"]}
                )

        for action in cast(list[dict[str, object]], analysis["actions"]):
            action_type = str(action["type"])
            if action_type == "unchanged":
                continue
            row = cast(dict[str, object], action["row"])
            student_id = _upsert_import_student(conn, row)
            briva = str(row["briva"])
            amount = int(cast(Any, row["amount"]))
            period = str(row["period"])
            due_date = clean_excel_text(row.get("due_date")) or None
            row_number = int(cast(Any, row["row_number"]))
            if action_type == "new":
                repository.create_bill(
                    student_id=student_id,
                    briva=briva,
                    amount=amount,
                    period=period,
                    bill_type=bill_type,
                    instructions=DEFAULT_INSTRUCTIONS,
                    due_date=due_date,
                    source_file=source_file,
                    row_number=row_number,
                )
                created += 1
            else:
                existing = cast(sqlite3.Row, action["existing"])
                repository.update_bill(
                    str(existing["id"]),
                    student_id=student_id,
                    briva=briva,
                    amount=amount,
                    period=period,
                    bill_type=bill_type,
                    due_date=due_date,
                    source_file=source_file,
                    row_number=row_number,
                )
                updated += 1

        layout = _require_headers(workbook)
        if layout.issue_sheet:
            for record in read_sheet(workbook, layout.issue_sheet):
                issues += 1
                issue = _issue_from_sheet(record, layout.issue_sheet)
                repository.store_issue(issue, source_file)
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
