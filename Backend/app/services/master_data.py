"""Master data slice – study programs and academic periods CRUD with repository delegation."""

from __future__ import annotations

from pathlib import Path

from Backend.app import config
from Backend.app.domain.billing import validate_due_date_value
from Backend.app.domain.common import format_due_date
from Backend.app.repositories.master_data import AcademicPeriodRepository, StudyProgramRepository
from Backend.app.services.audit import write_audit
from Backend.db import connect, database_connection
from Backend.excel_reader import normalize_text


def list_study_programs(db_path: str | Path = config.DB_PATH) -> list[dict[str, object]]:
    """List all active study programs with aggregate student counts."""
    with database_connection(db_path) as conn:
        rows = StudyProgramRepository(conn).list_all_active_with_counts()
    return [
        {
            "id": r["id"],
            "code": r["code"],
            "name": r["name"],
            "degree": r["degree"],
            "faculty": r["faculty"] or "",
            "is_active": int(r["is_active"]),
            "student_count": int(r["student_count"]),
            "created_at": str(r["created_at"]),
            "updated_at": str(r["updated_at"]),
        }
        for r in rows
    ]


def create_study_program(
    db_path: str | Path, payload: dict[str, object], actor_id: str | None = None
) -> dict[str, object]:
    """Create a new study program record with validation and audit logging."""
    code = normalize_text(payload.get("code")).upper()
    name = normalize_text(payload.get("name"))
    degree = normalize_text(payload.get("degree")) or "S1"
    faculty = normalize_text(payload.get("faculty")) or None
    is_active = 1 if payload.get("is_active", 1) else 0

    if not code:
        raise ValueError("Kode program studi wajib diisi.")
    if len(code) != 4 or not code.isalnum():
        raise ValueError(
            "Kode program studi harus terdiri dari 4 karakter alfanumerik huruf kapital (contoh: HKUM, MANJ, SIFO)."
        )
    if not name:
        raise ValueError("Nama program studi wajib diisi.")

    conn = connect(db_path)
    try:
        with conn:
            repo = StudyProgramRepository(conn)
            if repo.find_by_code(code):
                raise ValueError(f"Program studi dengan kode '{code}' sudah ada.")
            row = repo.create(code=code, name=name, degree=degree, faculty=faculty, is_active=is_active)
            program = dict(row)
            if actor_id:
                write_audit(
                    conn, actor_id, "study_program.create", "study_program", program["id"], {"code": code, "name": name}
                )
            return program
    finally:
        conn.close()


def update_study_program(
    db_path: str | Path, program_id: str, payload: dict[str, object], actor_id: str | None = None
) -> dict[str, object] | None:
    """Update an existing study program code, title, degree, or faculty with audit logging."""
    code = normalize_text(payload.get("code")).upper() if payload.get("code") is not None else None
    name = normalize_text(payload.get("name")) if payload.get("name") is not None else None
    degree = normalize_text(payload.get("degree")) if payload.get("degree") is not None else None
    faculty = normalize_text(payload.get("faculty")) if payload.get("faculty") is not None else None
    is_active = (1 if payload.get("is_active") else 0) if payload.get("is_active") is not None else None

    conn = connect(db_path)
    try:
        with conn:
            repo = StudyProgramRepository(conn)
            current = repo.find_by_id(program_id)
            if not current:
                return None

            new_code = code if code is not None else current["code"]
            new_name = name if name is not None else current["name"]
            new_degree = degree if degree is not None else current["degree"]
            new_faculty = faculty if faculty is not None else current["faculty"]
            new_active = is_active if is_active is not None else current["is_active"]

            if not new_code:
                raise ValueError("Kode program studi tidak boleh kosong.")
            if len(new_code) != 4 or not new_code.isalnum():
                raise ValueError(
                    "Kode program studi harus terdiri dari 4 karakter alfanumerik huruf kapital (contoh: HKUM, MANJ, SIFO)."
                )
            if not new_name:
                raise ValueError("Nama program studi tidak boleh kosong.")

            if repo.find_by_code(new_code, exclude_id=program_id):
                raise ValueError(f"Program studi dengan kode '{new_code}' sudah ada.")

            row = repo.update(
                program_id=program_id,
                code=new_code,
                name=new_name,
                degree=new_degree,
                faculty=new_faculty,
                is_active=new_active,
            )
            assert row is not None
            program = dict(row)
            if actor_id:
                write_audit(
                    conn,
                    actor_id,
                    "study_program.update",
                    "study_program",
                    program_id,
                    {"code": program["code"], "name": program["name"]},
                )
            return program
    finally:
        conn.close()


def delete_study_program(db_path: str | Path, program_id: str, actor_id: str | None = None) -> bool:
    """Soft deactivate a study program to preserve foreign key integrity on historical records."""
    conn = connect(db_path)
    try:
        with conn:
            repo = StudyProgramRepository(conn)
            current = repo.find_by_id(program_id)
            if not current or current["is_active"] != 1:
                return False
            deleted = repo.soft_deactivate(program_id)
            if deleted and actor_id:
                write_audit(conn, actor_id, "study_program.delete", "study_program", program_id, {})
            return deleted
    finally:
        conn.close()


# ==========================================
# MASTER DATA: ACADEMIC PERIODS
# ==========================================


def list_academic_periods(db_path: str | Path = config.DB_PATH) -> list[dict[str, object]]:
    """List all registered academic periods ordered by code descending."""
    with database_connection(db_path) as conn:
        rows = AcademicPeriodRepository(conn).list_all()
    return [
        {
            "id": r["id"],
            "code": r["code"],
            "name": r["name"],
            "semester_type": r["semester_type"],
            "is_active": int(r["is_active"]),
            "default_due_date": r["default_due_date"] or "",
            "default_due_date_formatted": format_due_date(r["default_due_date"]),
            "created_at": str(r["created_at"]),
            "updated_at": str(r["updated_at"]),
        }
        for r in rows
    ]


def create_academic_period(
    db_path: str | Path, payload: dict[str, object], actor_id: str | None = None
) -> dict[str, object]:
    """Create a new academic period definition and set as active if requested."""
    code = normalize_text(payload.get("code"))
    name = normalize_text(payload.get("name"))
    semester_type = normalize_text(payload.get("semester_type")).lower() or "ganjil"
    is_active = 1 if payload.get("is_active") else 0
    default_due_date = validate_due_date_value(payload.get("default_due_date"))

    if not code:
        raise ValueError("Kode periode akademik wajib diisi.")
    if not name:
        raise ValueError("Nama periode akademik wajib diisi.")
    if semester_type not in {"ganjil", "genap", "pendek"}:
        raise ValueError("Tipe semester harus ganjil, genap, atau pendek.")

    conn = connect(db_path)
    try:
        with conn:
            repo = AcademicPeriodRepository(conn)
            if repo.find_by_code(code):
                raise ValueError(f"Periode akademik dengan kode '{code}' sudah ada.")
            row = repo.create(
                code=code,
                name=name,
                semester_type=semester_type,
                is_active=is_active,
                default_due_date=default_due_date,
            )
            period = dict(row)
            if actor_id:
                write_audit(
                    conn,
                    actor_id,
                    "academic_period.create",
                    "academic_period",
                    period["id"],
                    {"code": code, "name": name},
                )
            return period
    finally:
        conn.close()


def update_academic_period(
    db_path: str | Path, period_id: str, payload: dict[str, object], actor_id: str | None = None
) -> dict[str, object] | None:
    """Update an existing academic period code, name, semester type, active status, or default due date."""
    code = normalize_text(payload.get("code")) if payload.get("code") is not None else None
    name = normalize_text(payload.get("name")) if payload.get("name") is not None else None
    semester_type = (
        normalize_text(payload.get("semester_type")).lower() if payload.get("semester_type") is not None else None
    )
    is_active = (1 if payload.get("is_active") else 0) if payload.get("is_active") is not None else None
    default_due_date = (
        validate_due_date_value(payload.get("default_due_date")) if "default_due_date" in payload else None
    )

    conn = connect(db_path)
    try:
        with conn:
            repo = AcademicPeriodRepository(conn)
            current = repo.find_by_id(period_id)
            if not current:
                return None

            new_code = code if code is not None else current["code"]
            new_name = name if name is not None else current["name"]
            new_type = semester_type if semester_type is not None else current["semester_type"]
            new_active = is_active if is_active is not None else current["is_active"]
            new_due = default_due_date if "default_due_date" in payload else current["default_due_date"]

            if not new_code:
                raise ValueError("Kode periode tidak boleh kosong.")
            if not new_name:
                raise ValueError("Nama periode tidak boleh kosong.")
            if new_type not in {"ganjil", "genap", "pendek"}:
                raise ValueError("Tipe semester harus ganjil, genap, atau pendek.")

            if repo.find_by_code(new_code, exclude_id=period_id):
                raise ValueError(f"Periode akademik dengan kode '{new_code}' sudah ada.")

            row = repo.update(
                period_id=period_id,
                code=new_code,
                name=new_name,
                semester_type=new_type,
                is_active=new_active,
                default_due_date=new_due,
            )
            assert row is not None
            period = dict(row)
            if actor_id:
                write_audit(
                    conn,
                    actor_id,
                    "academic_period.update",
                    "academic_period",
                    period_id,
                    {"code": period["code"], "name": period["name"]},
                )
            return period
    finally:
        conn.close()


# ==========================================
# REPORTING COMPAT WRAPPERS
# ==========================================


def get_dashboard_stats(db_path: str | Path = config.DB_PATH) -> dict[str, object]:
    """Compatibility wrapper for callers that still import the legacy service module."""
    from Backend.app.use_cases.reporting import ReportingService

    return ReportingService(db_path).dashboard_stats()


def get_financial_summary(
    db_path: str | Path = config.DB_PATH,
    period: str = "",
    study_program_id: str = "",
    entry_period: str = "",
) -> dict[str, object]:
    """Compatibility wrapper for callers that still import the legacy service module."""
    from Backend.app.use_cases.reporting import ReportingService

    return ReportingService(db_path).financial_summary(
        period=period,
        study_program_id=study_program_id,
        entry_period=entry_period,
    )
