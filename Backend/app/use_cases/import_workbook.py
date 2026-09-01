"""Transactional use case for committing an analyzed Excel workbook."""

from __future__ import annotations

import sqlite3
import uuid
from pathlib import Path
from typing import Any, cast

from Backend.app.repositories.imports import ImportRepository
from Backend.app.repositories.students import StudentRepository
from Backend.db import database_transaction, ensure_academic_period, parse_entry_registration, resolve_study_program_id
from Backend.excel_reader import (
    clean_demographic_value,
    clean_excel_text,
    normalize_imported_name,
    normalize_name,
    normalize_nim,
)
from Backend.importing.workbook import DEFAULT_INSTRUCTIONS


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


def commit_analyzed_workbook(
    workbook: Path,
    db_path: str | Path,
    analysis: dict[str, object],
    *,
    source_file: str,
    bill_type: str,
    actor_id: str | None,
    import_token: str | None,
    file_sha256: str,
    period_code: str,
    period_label: str,
    billing_year: int | None,
    semester_type: str | None,
) -> dict[str, object]:
    """Commit analyzed actions, issues, and audit metadata in one transaction."""
    issues = 0
    created = 0
    updated = 0
    issue_details: list[dict[str, object]] = []
    batch_id = f"batch_{uuid.uuid4().hex}"
    all_issues = cast(list[dict[str, object]], analysis.get("_issues") or [])
    warning_count = sum(1 for issue in all_issues if issue.get("severity") == "warning")
    critical_count = sum(1 for issue in all_issues if issue.get("severity") == "critical")
    quarantined = int(cast(Any, analysis.get("quarantined_rows") or 0))
    expected_created = int(cast(Any, analysis.get("new_rows") or 0))
    expected_updated = int(cast(Any, analysis.get("update_rows") or 0))
    unchanged = int(cast(Any, analysis.get("unchanged_rows") or 0))
    if expected_created + expected_updated == 0 and unchanged == 0:
        batch_status = "issues_only"
    elif all_issues:
        batch_status = "completed_with_issues"
    else:
        batch_status = "completed"

    with database_transaction(db_path) as conn:
        repository = ImportRepository(conn)
        ensure_academic_period(conn, period_code, default_name=period_label)
        batch_admin_id = actor_id
        if batch_admin_id and not repository.admin_exists(batch_admin_id):
            batch_admin_id = None
        repository.create_batch(
            batch_id=batch_id,
            import_token=import_token,
            admin_id=batch_admin_id,
            source_file=source_file,
            file_sha256=file_sha256,
            period_code=period_code,
            period_label=period_label,
            billing_year=billing_year,
            semester_type=semester_type,
            status=batch_status,
            created=expected_created,
            updated=expected_updated,
            unchanged=unchanged,
            quarantined=quarantined,
            warning_count=warning_count,
            critical_count=critical_count,
        )
        for issue in all_issues:
            repository.store_issue(issue, source_file, batch_id=batch_id, period_code=period_code)
            issues += 1
            if len(issue_details) < 5:
                issue_details.append(
                    {
                        "sheet": issue.get("sheet_name") or issue.get("sheet"),
                        "row_number": issue["row_number"],
                        "severity": issue.get("severity") or "warning",
                        "issue_code": issue.get("issue_code") or "IMPORT_VALIDATION_ISSUE",
                        "nim": issue.get("nim") or "",
                        "full_name": issue.get("full_name") or "",
                        "briva": issue.get("briva") or "",
                        "amount": issue.get("amount") or "",
                        "note": issue.get("note") or issue.get("message"),
                    }
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
                    import_batch_id=batch_id,
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
                    import_batch_id=batch_id,
                )
                updated += 1

        if actor_id:
            from Backend.app.services import audit as _audit

            _audit.write_audit(
                conn,
                actor_id,
                "import.commit",
                "import_batch",
                batch_id,
                {
                    "file_name": source_file,
                    "file_sha256": file_sha256,
                    "period_code": period_code,
                    "status": batch_status,
                    "created": created,
                    "updated": updated,
                    "unchanged": unchanged,
                    "quarantined": quarantined,
                    "warning_count": warning_count,
                    "critical_count": critical_count,
                },
            )

    return {
        "batch_id": batch_id,
        "status": batch_status,
        "period": {"code": period_code, "label": period_label},
        "imported": created + updated,
        "created": created,
        "updated": updated,
        "unchanged": unchanged,
        "issues": issues,
        "quarantined": quarantined,
        "warning_count": warning_count,
        "critical_count": critical_count,
        "issue_details": issue_details,
    }
