"""Master data slice – study programs and academic periods CRUD."""

from __future__ import annotations

import uuid
from pathlib import Path

from Backend.app import config
from Backend.app.domain.billing import validate_due_date_value
from Backend.app.domain.common import format_due_date
from Backend.app.services.audit import write_audit
from Backend.db import connect, database_connection


def list_study_programs(db_path: str | Path = config.DB_PATH) -> list[dict[str, object]]:
    """List all active study programs with aggregate student counts."""
    with database_connection(db_path) as conn:
        rows = conn.execute(
            """
            select sp.id, sp.code, sp.name, sp.degree, sp.faculty, sp.is_active, sp.created_at, sp.updated_at,
                   count(distinct s.id) as student_count
            from study_programs sp
            left join students s on (
                s.study_program_id = sp.id
                or (
                    s.study_program_id is null
                    and trim(coalesce(s.program_study, '')) <> ''
                    and lower(trim(s.program_study)) = lower(trim(sp.name))
                )
            ) and s.deleted_at is null
            where sp.is_active = 1
            group by sp.id, sp.code, sp.name, sp.degree, sp.faculty, sp.is_active, sp.created_at, sp.updated_at
            order by sp.name asc
            """
        ).fetchall()
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
    from Backend.excel_reader import normalize_text

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
            existing = conn.execute("select id from study_programs where upper(code) = ?", (code,)).fetchone()
            if existing:
                raise ValueError(f"Program studi dengan kode '{code}' sudah ada.")
            program_id = f"sp_{uuid.uuid4().hex[:12]}"
            conn.execute(
                """
                insert into study_programs (id, code, name, degree, faculty, is_active)
                values (?, ?, ?, ?, ?, ?)
                """,
                (program_id, code, name, degree, faculty, is_active),
            )
            row = conn.execute("select * from study_programs where id = ?", (program_id,)).fetchone()
            program = dict(row)
            if actor_id:
                write_audit(
                    conn, actor_id, "study_program.create", "study_program", program_id, {"code": code, "name": name}
                )
            return program
    finally:
        conn.close()


def update_study_program(
    db_path: str | Path, program_id: str, payload: dict[str, object], actor_id: str | None = None
) -> dict[str, object] | None:
    """Update an existing study program code, title, degree, or faculty with audit logging."""
    from Backend.excel_reader import normalize_text

    code = normalize_text(payload.get("code")).upper() if payload.get("code") is not None else None
    name = normalize_text(payload.get("name")) if payload.get("name") is not None else None
    degree = normalize_text(payload.get("degree")) if payload.get("degree") is not None else None
    faculty = normalize_text(payload.get("faculty")) if payload.get("faculty") is not None else None
    is_active = (1 if payload.get("is_active") else 0) if payload.get("is_active") is not None else None

    conn = connect(db_path)
    try:
        with conn:
            current = conn.execute("select * from study_programs where id = ?", (program_id,)).fetchone()
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

            duplicate = conn.execute(
                "select id from study_programs where upper(code) = ? and id <> ?", (new_code, program_id)
            ).fetchone()
            if duplicate:
                raise ValueError(f"Program studi dengan kode '{new_code}' sudah ada.")

            conn.execute(
                """
                update study_programs
                set code = ?, name = ?, degree = ?, faculty = ?, is_active = ?, updated_at = datetime('now')
                where id = ?
                """,
                (new_code, new_name, new_degree, new_faculty, new_active, program_id),
            )
            row = conn.execute("select * from study_programs where id = ?", (program_id,)).fetchone()
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
            current = conn.execute(
                "select id from study_programs where id = ? and is_active = 1", (program_id,)
            ).fetchone()
            if not current:
                return False
            # Keep the record for FK integrity and auditability.  It can be
            # reactivated through the existing update endpoint if required.
            conn.execute(
                "update study_programs set is_active = 0, updated_at = datetime('now') where id = ?",
                (program_id,),
            )
            if actor_id:
                write_audit(conn, actor_id, "study_program.delete", "study_program", program_id, {})
            return True
    finally:
        conn.close()


# ==========================================
# MASTER DATA: ACADEMIC PERIODS
# ==========================================


def list_academic_periods(db_path: str | Path = config.DB_PATH) -> list[dict[str, object]]:
    """List all registered academic periods ordered by code descending."""
    with database_connection(db_path) as conn:
        rows = conn.execute(
            """
            select id, code, name, semester_type, is_active, default_due_date, created_at, updated_at
            from academic_periods
            order by code desc
            """
        ).fetchall()
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
    from Backend.excel_reader import normalize_text

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
            existing = conn.execute("select id from academic_periods where code = ?", (code,)).fetchone()
            if existing:
                raise ValueError(f"Periode akademik dengan kode '{code}' sudah ada.")
            period_id = f"prd_{uuid.uuid4().hex[:12]}"
            if is_active == 1:
                conn.execute("update academic_periods set is_active = 0")
            conn.execute(
                """
                insert into academic_periods (id, code, name, semester_type, is_active, default_due_date)
                values (?, ?, ?, ?, ?, ?)
                """,
                (period_id, code, name, semester_type, is_active, default_due_date),
            )
            row = conn.execute("select * from academic_periods where id = ?", (period_id,)).fetchone()
            period = dict(row)
            if actor_id:
                write_audit(
                    conn, actor_id, "academic_period.create", "academic_period", period_id, {"code": code, "name": name}
                )
            return period
    finally:
        conn.close()


def update_academic_period(
    db_path: str | Path, period_id: str, payload: dict[str, object], actor_id: str | None = None
) -> dict[str, object] | None:
    """Update an existing academic period code, name, semester type, active status, or default due date."""
    from Backend.excel_reader import normalize_text

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
            current = conn.execute("select * from academic_periods where id = ?", (period_id,)).fetchone()
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

            duplicate = conn.execute(
                "select id from academic_periods where code = ? and id <> ?", (new_code, period_id)
            ).fetchone()
            if duplicate:
                raise ValueError(f"Periode akademik dengan kode '{new_code}' sudah ada.")

            if new_active == 1:
                conn.execute("update academic_periods set is_active = 0 where id <> ?", (period_id,))

            conn.execute(
                """
                update academic_periods
                set code = ?, name = ?, semester_type = ?, is_active = ?, default_due_date = ?, updated_at = datetime('now')
                where id = ?
                """,
                (new_code, new_name, new_type, new_active, new_due, period_id),
            )
            row = conn.execute("select * from academic_periods where id = ?", (period_id,)).fetchone()
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
