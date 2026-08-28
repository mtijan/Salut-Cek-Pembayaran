from __future__ import annotations

import json
import secrets
import sqlite3
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from Backend.app import config
from Backend.app.domain.billing import (
    bill_row_to_dict,
    joined_bill_select,
    normalize_status_value,
    summarize_payment_status,
    validate_amount,
    validate_due_date_value,
    validate_paid_amount,
    validate_payment_metadata,
)
from Backend.app.domain.common import format_due_date, rupiah
from Backend.app.domain.files import sanitize_filename as sanitize_filename
from Backend.app.domain.students import student_row_to_dict, validate_academic_status, validate_nim_value
from Backend.app.security import digest, hash_password, token_hash, verify_password
from Backend.app.use_cases.reporting import ReportingService
from Backend.db import (
    connect,
    database_connection,
    database_transaction,
    migrate_database,
    parse_entry_registration,
)
from Backend.excel_reader import (
    clean_demographic_value,
    normalize_imported_name,
    normalize_name,
    normalize_nim,
    normalize_text,
)


def validate_runtime_configuration() -> None:
    if config.APP_ENV != "production":
        return
    if config.PROCESS_WORKERS != 1:
        raise RuntimeError(
            "Rate limiter in-memory hanya aman untuk satu worker. "
            "Gunakan WEB_CONCURRENCY=1/UVICORN_WORKERS=1 atau implementasikan shared limiter sebelum scale-out."
        )
    values = {
        "LOOKUP_HASH_SECRET": config.LOOKUP_HASH_SECRET.strip(),
        "ADMIN_BOOTSTRAP_EMAIL": config.ADMIN_BOOTSTRAP_EMAIL.strip(),
        "ADMIN_BOOTSTRAP_PASSWORD": config.ADMIN_BOOTSTRAP_PASSWORD,
    }
    missing = [name for name, value in values.items() if not value]
    if missing:
        raise RuntimeError(f"Konfigurasi production belum lengkap: {', '.join(missing)}")

    placeholder_markers = (
        "change-this",
        "ganti-dengan",
        "example.com",
        "adminsecurepassword",
        "password123",
        "your-",
    )
    weak = [name for name, value in values.items() if any(marker in value.casefold() for marker in placeholder_markers)]
    if len(values["LOOKUP_HASH_SECRET"]) < 32:
        weak.append("LOOKUP_HASH_SECRET")
    if len(values["ADMIN_BOOTSTRAP_PASSWORD"]) < 12:
        weak.append("ADMIN_BOOTSTRAP_PASSWORD")
    if "@" not in values["ADMIN_BOOTSTRAP_EMAIL"]:
        weak.append("ADMIN_BOOTSTRAP_EMAIL")
    if weak:
        raise RuntimeError(
            "Konfigurasi production memakai nilai placeholder atau lemah: " + ", ".join(sorted(set(weak)))
        )


def cleanup_stale_imports() -> int:
    removed_files = 0
    if not config.IMPORT_DIR.exists():
        return removed_files
    cutoff = time.time() - config.IMPORT_RETENTION_SECONDS
    for workbook in config.IMPORT_DIR.glob("*.xlsx"):
        if workbook.stat().st_mtime < cutoff:
            workbook.unlink(missing_ok=True)
            removed_files += 1
    with database_transaction(config.DB_PATH) as conn:
        conn.execute("delete from import_previews where expires_at <= datetime('now')")
    return removed_files


def cleanup_operational_data() -> dict[str, int]:
    """Prune only approved operational data; audit_logs are intentionally retained."""
    cleanup_stale_imports()
    with database_transaction(config.DB_PATH) as conn:
        deleted_sessions = conn.execute(
            "delete from admin_sessions where expires_at <= datetime('now', ?)",
            (f"-{config.SESSION_RETENTION_DAYS} days",),
        ).rowcount
        deleted_lookups = conn.execute(
            "delete from lookup_logs where created_at < datetime('now', ?)",
            (f"-{config.LOOKUP_LOG_RETENTION_DAYS} days",),
        ).rowcount
        deleted_issues = conn.execute(
            "delete from import_issues where created_at < datetime('now', ?)",
            (f"-{config.IMPORT_ISSUE_RETENTION_DAYS} days",),
        ).rowcount
    return {
        "expired_sessions": max(0, deleted_sessions),
        "lookup_logs": max(0, deleted_lookups),
        "import_issues": max(0, deleted_issues),
    }


def ensure_database() -> None:
    validate_runtime_configuration()
    migrate_database(config.DB_PATH)
    with database_transaction(config.DB_PATH) as conn:
        admin_total = conn.execute("select count(*) as total from admin_users").fetchone()["total"]
        if admin_total == 0:
            if not config.ADMIN_BOOTSTRAP_EMAIL or not config.ADMIN_BOOTSTRAP_PASSWORD:
                raise RuntimeError("Admin awal belum ada. Set ADMIN_BOOTSTRAP_EMAIL dan ADMIN_BOOTSTRAP_PASSWORD.")
            conn.execute(
                """
                insert into admin_users (id, email, password_hash, full_name, role)
                values (?, ?, ?, ?, 'super_admin')
                """,
                (
                    str(uuid.uuid4()),
                    config.ADMIN_BOOTSTRAP_EMAIL.strip().casefold(),
                    hash_password(config.ADMIN_BOOTSTRAP_PASSWORD),
                    "Admin SALUT",
                ),
            )


def ensure_student(
    conn: sqlite3.Connection,
    nim: object,
    full_name: object,
    program_study: object = None,
    study_program_id: object = None,
    academic_status: object = None,
    entry_year: object = None,
    email: object = None,
    address: object = None,
    phone_number: object = None,
    no_ktp: object = None,
    tempat_lahir: object = None,
    tanggal_lahir: object = None,
    nama_ibu_kandung: object = None,
    initial_registration: object = None,
    entry_semester: object = None,
    entry_period: object = None,
) -> sqlite3.Row:
    normalized_nim = validate_nim_value(nim)
    normalized_name = normalize_imported_name(full_name)
    if not normalized_nim:
        raise ValueError("NIM wajib diisi.")
    if not normalized_name:
        raise ValueError("Nama mahasiswa wajib diisi.")

    norm_prodi = clean_demographic_value(program_study)
    norm_prodi_id = normalize_text(study_program_id) or None
    if norm_prodi_id:
        sp_row = conn.execute(
            "select name from study_programs where id = ? or upper(code) = ?", (norm_prodi_id, norm_prodi_id.upper())
        ).fetchone()
        if sp_row and not norm_prodi:
            norm_prodi = str(sp_row["name"])
    elif norm_prodi:
        from Backend.db import resolve_study_program_id

        norm_prodi_id = resolve_study_program_id(conn, norm_prodi)

    norm_status = validate_academic_status(academic_status) if academic_status is not None else None
    norm_email = clean_demographic_value(email)
    norm_address = clean_demographic_value(address)
    norm_phone = normalize_nim(phone_number) if phone_number and clean_demographic_value(phone_number) else None
    norm_ktp = clean_demographic_value(no_ktp)
    norm_tempat = clean_demographic_value(tempat_lahir)
    norm_tgl = clean_demographic_value(tanggal_lahir)
    norm_ibu = clean_demographic_value(nama_ibu_kandung)
    norm_reg = clean_demographic_value(initial_registration)

    parsed_year, parsed_sem, parsed_period = parse_entry_registration(norm_reg)
    try:
        norm_year = (
            int(str(entry_year).strip())
            if entry_year is not None and str(entry_year).strip().isdigit()
            else parsed_year
        )
    except (ValueError, TypeError):
        norm_year = parsed_year
    norm_sem = clean_demographic_value(entry_semester) or parsed_sem
    norm_period = clean_demographic_value(entry_period) or parsed_period

    # NIM is unique for the lifetime of the database.  If a previously
    # soft-deleted student is imported/created again, restore that same record
    # instead of attempting a second INSERT (which would violate the unique
    # constraint and leaves operators with no recovery path).
    row = conn.execute(
        "select id, nim, full_name, deleted_at from students where nim = ?", (normalized_nim,)
    ).fetchone()
    if row:
        updates = ["full_name = ?", "name_norm = ?", "updated_at = datetime('now')"]
        params: list[object] = [normalized_name, normalize_name(normalized_name)]
        if row["deleted_at"] is not None:
            updates.extend(["deleted_at = null", "deleted_by = null", "delete_reason = null"])
        if norm_prodi:
            updates.append("program_study = ?")
            params.append(norm_prodi)
        if norm_prodi_id:
            updates.append("study_program_id = ?")
            params.append(norm_prodi_id)
        if norm_status is not None:
            updates.append("academic_status = ?")
            params.append(norm_status)
        if norm_year is not None:
            updates.append("entry_year = ?")
            params.append(norm_year)
        if norm_sem:
            updates.append("entry_semester = ?")
            params.append(norm_sem)
        if norm_period:
            updates.append("entry_period = ?")
            params.append(norm_period)
        if norm_email:
            updates.append("email = ?")
            params.append(norm_email)
        if norm_address:
            updates.append("address = ?")
            params.append(norm_address)
        if norm_phone:
            updates.append("phone_number = ?")
            params.append(norm_phone)
        if norm_ktp:
            updates.append("no_ktp = ?")
            params.append(norm_ktp)
        if norm_tempat:
            updates.append("tempat_lahir = ?")
            params.append(norm_tempat)
        if norm_tgl:
            updates.append("tanggal_lahir = ?")
            params.append(norm_tgl)
        if norm_ibu:
            updates.append("nama_ibu_kandung = ?")
            params.append(norm_ibu)
        if norm_reg:
            updates.append("initial_registration = ?")
            params.append(norm_reg)
        params.append(row["id"])
        conn.execute(f"update students set {', '.join(updates)} where id = ?", params)
        return conn.execute("select id, nim, full_name from students where id = ?", (row["id"],)).fetchone()

    student_id = f"stu_{uuid.uuid4().hex[:12]}"
    conn.execute(
        """
        insert into students (
            id, nim, full_name, name_norm,
            no_ktp, tempat_lahir, tanggal_lahir, nama_ibu_kandung,
            program_study, study_program_id, academic_status, entry_year, entry_semester, entry_period,
            email, address, phone_number, initial_registration
        )
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            student_id,
            normalized_nim,
            normalized_name,
            normalize_name(normalized_name),
            norm_ktp,
            norm_tempat,
            norm_tgl,
            norm_ibu,
            norm_prodi,
            norm_prodi_id,
            norm_status or "aktif",
            norm_year,
            norm_sem,
            norm_period,
            norm_email,
            norm_address,
            norm_phone,
            norm_reg,
        ),
    )
    return conn.execute("select id, nim, full_name from students where id = ?", (student_id,)).fetchone()


def list_students(
    db_path: str | Path = config.DB_PATH,
    query: str = "",
    limit: int = 2000,
    study_program_id: str = "",
    academic_status: str = "",
    entry_year: int | None = None,
    entry_period: str = "",
    sort_by: str = "",
) -> list[dict[str, object]]:
    search = normalize_text(query)
    limit = max(1, min(int(limit or 2000), 5000))
    params: list[object] = []
    where_clauses = ["s.deleted_at is null"]
    if search:
        where_clauses.append(
            "(s.nim like ? or s.full_name like ? or s.program_study like ? or sp.name like ? or sp.code like ? or s.no_ktp like ? or s.email like ? or s.phone_number like ?)"
        )
        params.extend(
            [
                f"%{search}%",
                f"%{search}%",
                f"%{search}%",
                f"%{search}%",
                f"%{search}%",
                f"%{search}%",
                f"%{search}%",
                f"%{search}%",
            ]
        )
    if study_program_id:
        where_clauses.append(
            "(s.study_program_id = ? or sp.code = ? or lower(s.program_study) = lower(?) or lower(sp.name) = lower(?))"
        )
        params.extend(
            [study_program_id.strip(), study_program_id.strip(), study_program_id.strip(), study_program_id.strip()]
        )
    if academic_status:
        where_clauses.append("s.academic_status = ?")
        params.append(academic_status.lower().strip())
    if entry_year is not None and str(entry_year).isdigit():
        where_clauses.append("s.entry_year = ?")
        params.append(int(entry_year))
    if entry_period:
        where_clauses.append("(s.entry_period = ? or s.initial_registration like ?)")
        params.extend([entry_period.strip(), f"%{entry_period.strip()}%"])

    order_by = "order by s.nim asc"
    if sort_by == "entry_period_asc":
        order_by = "order by s.entry_period asc nulls last, s.nim asc"
    elif sort_by == "entry_period_desc":
        order_by = "order by s.entry_period desc nulls last, s.nim asc"
    elif sort_by == "name_asc":
        order_by = "order by s.full_name asc"
    elif sort_by == "updated_at_desc":
        order_by = "order by s.updated_at desc"

    where = "where " + " and ".join(where_clauses)
    with database_connection(db_path) as conn:
        rows = conn.execute(
            f"""
            select s.id, s.nim, s.full_name, s.no_ktp, s.tempat_lahir, s.tanggal_lahir, s.nama_ibu_kandung,
                   s.program_study, s.study_program_id, s.academic_status,
                   s.entry_year, s.entry_semester, s.entry_period,
                   s.email, s.address, s.phone_number, s.initial_registration,
                   sp.name as study_program_name, sp.code as study_program_code,
                   count(b.id) as bill_count, coalesce(sum(b.amount), 0) as total_amount
            from students s
            left join study_programs sp on sp.id = s.study_program_id
            left join bills b on b.student_id = s.id and b.deleted_at is null
            {where}
            group by s.id, s.nim, s.full_name, s.no_ktp, s.tempat_lahir, s.tanggal_lahir, s.nama_ibu_kandung,
                     s.program_study, s.study_program_id, s.academic_status, s.entry_year, s.entry_semester, s.entry_period,
                     s.email, s.address, s.phone_number, s.initial_registration, sp.name, sp.code
            {order_by}
            limit ?
            """,
            (*params, limit),
        ).fetchall()
    return [student_row_to_dict(row) for row in rows]


def get_student_detail(db_path: str | Path, student_id: str) -> dict[str, object] | None:
    with database_connection(db_path) as conn:
        student = conn.execute(
            """
            select s.id, s.nim, s.full_name, s.no_ktp, s.tempat_lahir, s.tanggal_lahir, s.nama_ibu_kandung,
                   s.program_study, s.study_program_id, s.academic_status,
                   s.entry_year, s.entry_semester, s.entry_period,
                   s.email, s.address, s.phone_number, s.initial_registration, s.created_at,
                   sp.name as study_program_name, sp.code as study_program_code, sp.degree as study_program_degree
            from students s
            left join study_programs sp on sp.id = s.study_program_id
            where s.id = ? and s.deleted_at is null
            """,
            (student_id,),
        ).fetchone()
        if not student:
            return None

        bills = conn.execute(
            f"""
            {joined_bill_select()}
            where b.student_id = ? and b.deleted_at is null
            order by b.created_at desc, b.period desc
            """,
            (student_id,),
        ).fetchall()

    bill_list = [bill_row_to_dict(b) for b in bills]
    total_amount = sum(int(b["amount"]) for b in bill_list)
    total_paid = sum(
        int(b["amount"]) if b["status"] == "paid" else (int(b.get("paid_amount", 0)) if b["status"] == "partial" else 0)
        for b in bill_list
    )
    total_outstanding = max(0, total_amount - total_paid)
    overall_status = summarize_payment_status([b["status"] for b in bill_list])

    tx_res = list_payment_transactions(db_path, student_id=student_id, limit=50, offset=0)

    return {
        "student": student_row_to_dict(student),
        "bills": bill_list,
        "payment_history": tx_res["transactions"],
        "payment_history_pagination": tx_res["pagination"],
        "summary": {
            "total_bills": len(bill_list),
            "total_amount": total_amount,
            "total_amount_formatted": rupiah(total_amount),
            "total_paid": total_paid,
            "total_paid_formatted": rupiah(total_paid),
            "total_outstanding": total_outstanding,
            "total_outstanding_formatted": rupiah(total_outstanding),
            "overall_status": overall_status,
        },
    }


def create_student(
    db_path: str | Path,
    nim_or_payload: object = None,
    full_name: object = None,
    payload: dict[str, object] | None = None,
    actor_id: str | None = None,
) -> sqlite3.Row:
    if isinstance(nim_or_payload, dict):
        data = nim_or_payload
    elif isinstance(payload, dict):
        data = payload
    else:
        data = {"nim": nim_or_payload, "full_name": full_name}

    conn = connect(db_path)
    try:
        with conn:
            student = ensure_student(
                conn,
                nim=data.get("nim"),
                full_name=data.get("full_name"),
                program_study=data.get("program_study"),
                study_program_id=data.get("study_program_id"),
                academic_status=data.get("academic_status") or "aktif",
                entry_year=data.get("entry_year"),
                email=data.get("email"),
                address=data.get("address"),
                phone_number=data.get("phone_number"),
                no_ktp=data.get("no_ktp"),
                tempat_lahir=data.get("tempat_lahir"),
                tanggal_lahir=data.get("tanggal_lahir"),
                nama_ibu_kandung=data.get("nama_ibu_kandung"),
                initial_registration=data.get("initial_registration"),
                entry_semester=data.get("entry_semester"),
                entry_period=data.get("entry_period"),
            )
            if actor_id:
                write_audit(conn, actor_id, "student.create", "student", student["id"], {"nim": student["nim"]})
    finally:
        conn.close()
    return student


def require_delete_reason(reason: str) -> str:
    cleaned = normalize_text(reason)
    if not cleaned:
        raise ValueError("Alasan penghapusan wajib diisi.")
    return cleaned


def update_student(
    db_path: str | Path, student_id: str, payload: dict[str, object], actor_id: str | None = None
) -> sqlite3.Row | None:
    normalized_nim = validate_nim_value(payload.get("nim"))
    normalized_name = normalize_imported_name(payload.get("full_name"))
    if not normalized_nim:
        raise ValueError("NIM wajib diisi.")
    if not normalized_name:
        raise ValueError("Nama mahasiswa wajib diisi.")

    prodi = clean_demographic_value(payload.get("program_study"))
    prodi_id = normalize_text(payload.get("study_program_id")) or None
    status = validate_academic_status(payload.get("academic_status"))
    email = clean_demographic_value(payload.get("email"))
    address = clean_demographic_value(payload.get("address"))
    phone = (
        normalize_nim(payload.get("phone_number"))
        if payload.get("phone_number") and clean_demographic_value(payload.get("phone_number"))
        else None
    )
    no_ktp = clean_demographic_value(payload.get("no_ktp"))
    tempat = clean_demographic_value(payload.get("tempat_lahir"))
    tgl = clean_demographic_value(payload.get("tanggal_lahir"))
    ibu = clean_demographic_value(payload.get("nama_ibu_kandung"))
    reg = clean_demographic_value(payload.get("initial_registration"))

    parsed_year, parsed_sem, parsed_period = parse_entry_registration(reg)
    try:
        year = (
            int(str(payload.get("entry_year")).strip())
            if payload.get("entry_year") is not None and str(payload.get("entry_year")).strip().isdigit()
            else parsed_year
        )
    except (ValueError, TypeError):
        year = parsed_year
    sem = clean_demographic_value(payload.get("entry_semester")) or parsed_sem
    period = clean_demographic_value(payload.get("entry_period")) or parsed_period

    conn = connect(db_path)
    try:
        with conn:
            existing = conn.execute("select id from students where id = ?", (student_id,)).fetchone()
            if not existing:
                return None
            duplicate = conn.execute(
                "select id from students where nim = ? and id <> ?", (normalized_nim, student_id)
            ).fetchone()
            if duplicate:
                raise ValueError("NIM sudah digunakan mahasiswa lain.")
            conn.execute(
                """
                update students
                set nim = ?, full_name = ?, name_norm = ?, no_ktp = ?, tempat_lahir = ?, tanggal_lahir = ?, nama_ibu_kandung = ?,
                    program_study = ?, study_program_id = ?, academic_status = ?, entry_year = ?, entry_semester = ?, entry_period = ?,
                    email = ?, address = ?, phone_number = ?, initial_registration = ?,
                    updated_at = datetime('now')
                where id = ?
                """,
                (
                    normalized_nim,
                    normalized_name,
                    normalize_name(normalized_name),
                    no_ktp,
                    tempat,
                    tgl,
                    ibu,
                    prodi,
                    prodi_id,
                    status,
                    year,
                    sem,
                    period,
                    email,
                    address,
                    phone,
                    reg,
                    student_id,
                ),
            )
            student = conn.execute("select * from students where id = ?", (student_id,)).fetchone()
            if actor_id:
                write_audit(conn, actor_id, "student.update", "student", student_id, {"nim": student["nim"]})
            return student
    finally:
        conn.close()


def delete_student(
    db_path: str | Path, student_id: str, actor_id: str | None = None, reason: str = ""
) -> sqlite3.Row | None:
    reason = require_delete_reason(reason)
    conn = connect(db_path)
    try:
        with conn:
            row = conn.execute(
                "select id, nim, full_name from students where id = ? and deleted_at is null", (student_id,)
            ).fetchone()
            if row:
                conn.execute(
                    """
                    update students
                    set deleted_at = datetime('now'), deleted_by = ?, delete_reason = ?, updated_at = datetime('now')
                    where id = ?
                    """,
                    (actor_id, reason, student_id),
                )
                if actor_id:
                    write_audit(
                        conn, actor_id, "student.delete", "student", student_id, {"nim": row["nim"], "reason": reason}
                    )
                conn.execute(
                    """
                    update bills
                    set deleted_at = datetime('now'), deleted_by = ?, delete_reason = ?, updated_at = datetime('now')
                    where student_id = ? and deleted_at is null
                    """,
                    (actor_id, reason, student_id),
                )
        return row
    finally:
        conn.close()


def bill_filter_clause(
    query: str = "",
    status: str = "",
    source: str = "",
    study_program_id: str = "",
    period: str = "",
    bill_type: str = "",
    entry_period: str = "",
) -> tuple[str, list[object]]:
    search = normalize_text(query)
    normalized_status = normalize_text(status).lower()
    normalized_source = normalize_text(source).lower()
    normalized_prodi = normalize_text(study_program_id)
    normalized_period = normalize_text(period)
    normalized_type = normalize_text(bill_type)
    normalized_entry_period = normalize_text(entry_period)
    params: list[object] = []
    where_clauses = ["b.deleted_at is null", "s.deleted_at is null"]
    if search:
        where_clauses.append(
            "(s.nim like ? or s.full_name like ? or b.briva like ? or b.period like ? or b.bill_type like ?)"
        )
        params.extend([f"%{search}%", f"%{search}%", f"%{search}%", f"%{search}%", f"%{search}%"])
    if normalized_status:
        where_clauses.append("b.status = ?")
        params.append(normalized_status)
    if normalized_source == "manual":
        where_clauses.append("lower(trim(b.source_file)) in ('manual', 'manual admin')")
    elif normalized_source == "import":
        where_clauses.append("lower(trim(b.source_file)) not in ('manual', 'manual admin')")
    if normalized_prodi:
        where_clauses.append("s.study_program_id = ?")
        params.append(normalized_prodi)
    if normalized_period:
        where_clauses.append("b.period = ?")
        params.append(normalized_period)
    if normalized_type:
        where_clauses.append("b.bill_type = ?")
        params.append(normalized_type)
    if normalized_entry_period:
        where_clauses.append("(s.entry_period = ? or s.initial_registration like ?)")
        params.extend([normalized_entry_period, f"%{normalized_entry_period}%"])
    return "where " + " and ".join(where_clauses), params


def list_bills(
    db_path: str | Path = config.DB_PATH,
    query: str = "",
    limit: int = 2000,
    offset: int = 0,
    status: str = "",
    source: str = "",
    study_program_id: str = "",
    period: str = "",
    bill_type: str = "",
    sort_by: str = "",
    entry_period: str = "",
) -> list[dict[str, object]]:
    limit = max(1, min(int(limit or 2000), 5000))
    offset = max(0, int(offset or 0))
    where, params = bill_filter_clause(
        query=query,
        status=status,
        source=source,
        study_program_id=study_program_id,
        period=period,
        bill_type=bill_type,
        entry_period=entry_period,
    )

    sort_order_map = {
        "updated_desc": "order by b.updated_at desc, b.created_at desc",
        "updated_asc": "order by b.updated_at asc, b.created_at asc",
        "created_desc": "order by b.created_at desc, b.rowid desc",
        "created_asc": "order by b.created_at asc, b.rowid asc",
        "amount_desc": "order by b.amount desc",
        "amount_asc": "order by b.amount asc",
        "due_date_asc": "order by case when b.due_date is null or b.due_date = '' then 1 else 0 end, b.due_date asc",
        "due_date_desc": "order by b.due_date desc",
        "nim_asc": "order by s.nim asc",
        "name_asc": "order by s.full_name asc",
    }
    order_clause = sort_order_map.get(sort_by, "order by b.updated_at desc, b.created_at desc")

    with database_connection(db_path) as conn:
        rows = conn.execute(
            f"""
            {joined_bill_select()}
            {where}
            {order_clause}
            limit ? offset ?
            """,
            (*params, limit, offset),
        ).fetchall()
    return [bill_row_to_dict(row) for row in rows]


def count_bills(
    db_path: str | Path = config.DB_PATH,
    query: str = "",
    status: str = "",
    source: str = "",
    study_program_id: str = "",
    period: str = "",
    bill_type: str = "",
    entry_period: str = "",
) -> int:
    where, params = bill_filter_clause(
        query=query,
        status=status,
        source=source,
        study_program_id=study_program_id,
        period=period,
        bill_type=bill_type,
        entry_period=entry_period,
    )
    with database_connection(db_path) as conn:
        row = conn.execute(
            f"""
            select count(*) as total
            from bills b
            join students s on s.id = b.student_id
            {where}
            """,
            params,
        ).fetchone()
    return int(row["total"] if row else 0)


def get_bills_summary(
    db_path: str | Path = config.DB_PATH,
    query: str = "",
    status: str = "",
    source: str = "",
    study_program_id: str = "",
    period: str = "",
    bill_type: str = "",
    entry_period: str = "",
) -> dict[str, int]:
    where, params = bill_filter_clause(
        query=query,
        status=status,
        source=source,
        study_program_id=study_program_id,
        period=period,
        bill_type=bill_type,
        entry_period=entry_period,
    )
    with database_connection(db_path) as conn:
        row = conn.execute(
            f"""
            select
                count(b.id) as total_count,
                count(distinct b.student_id) as student_count,
                coalesce(sum(b.amount), 0) as total_amount,
                coalesce(sum(b.paid_amount), 0) as total_paid,
                coalesce(sum(case when b.status = 'paid' then 1 else 0 end), 0) as paid_count,
                coalesce(sum(case when b.status = 'partial' then 1 else 0 end), 0) as partial_count,
                coalesce(sum(case when b.status = 'unpaid' then 1 else 0 end), 0) as unpaid_count
            from bills b
            join students s on s.id = b.student_id
            {where}
            """,
            params,
        ).fetchone()

    if not row:
        return {
            "total_count": 0,
            "student_count": 0,
            "total_amount": 0,
            "total_paid": 0,
            "total_remaining": 0,
            "paid_count": 0,
            "partial_count": 0,
            "unpaid_count": 0,
        }

    total_amount = int(row["total_amount"] or 0)
    total_paid = int(row["total_paid"] or 0)
    return {
        "total_count": int(row["total_count"] or 0),
        "student_count": int(row["student_count"] or 0),
        "total_amount": total_amount,
        "total_paid": total_paid,
        "total_remaining": max(0, total_amount - total_paid),
        "paid_count": int(row["paid_count"] or 0),
        "partial_count": int(row["partial_count"] or 0),
        "unpaid_count": int(row["unpaid_count"] or 0),
    }


def list_import_issues(db_path: str | Path = config.DB_PATH, limit: int = 500) -> list[dict[str, object]]:
    limit = max(1, min(int(limit or 500), 2000))
    with database_connection(db_path) as conn:
        rows = conn.execute(
            """
            select id, source_file, sheet_name, row_number, nim, full_name, briva, amount, note, created_at
            from import_issues
            order by created_at desc, source_file asc, row_number asc
            limit ?
            """,
            (limit,),
        ).fetchall()
    return [dict(row) for row in rows]


def create_bill(db_path: str | Path, payload: dict[str, object], actor_id: str | None = None) -> sqlite3.Row:
    briva = normalize_text(payload.get("briva"))
    raw_period = normalize_text(payload.get("period"))
    bill_type = normalize_text(payload.get("bill_type")) or "UKT"
    payment_method = normalize_text(payload.get("payment_method")) or "BRIVA"
    if not briva:
        raise ValueError("Nomor BRIVA wajib diisi.")
    if not raw_period:
        raise ValueError("Periode pembayaran wajib diisi.")
    amount = validate_amount(payload.get("amount"))
    status = normalize_status_value(payload.get("status"))
    paid_amount = validate_paid_amount(payload.get("paid_amount"), amount, status)
    due_date = validate_due_date_value(payload.get("due_date"))
    instructions = (
        normalize_text(payload.get("instructions")) or "Bayar melalui BRIVA BRI dengan nomor BRIVA yang tampil."
    )
    payment_date, reference_number, notes = validate_payment_metadata(
        payload.get("payment_date"), payload.get("reference_number"), payload.get("notes")
    )

    conn = connect(db_path)
    try:
        with conn:
            from Backend.db import ensure_academic_period

            period = ensure_academic_period(conn, raw_period) or raw_period

            student_id = normalize_text(payload.get("student_id"))
            if student_id:
                student = conn.execute(
                    "select id, nim, full_name from students where id = ? and deleted_at is null", (student_id,)
                ).fetchone()
                if not student:
                    raise ValueError("Mahasiswa yang dipilih tidak ditemukan.")
            else:
                student = ensure_student(conn, payload.get("nim"), payload.get("full_name"))

            bill_id = str(uuid.uuid4())
            conn.execute(
                """
                insert into bills
                  (id, student_id, briva, amount, paid_amount, period, bill_type, status, payment_method, instructions, due_date, source_file)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    bill_id,
                    student["id"],
                    briva,
                    amount,
                    paid_amount,
                    period,
                    bill_type,
                    status,
                    payment_method,
                    instructions,
                    due_date,
                    "Manual Admin",
                ),
            )
            if status != "unpaid":
                record_payment_transaction(
                    conn,
                    bill_id,
                    student["id"],
                    "unpaid",
                    status,
                    0,
                    paid_amount,
                    recorded_by=actor_id,
                    payment_method=payment_method,
                    payment_date=payment_date,
                    reference_number=reference_number,
                    notes=notes,
                    source="manual",
                )
            bill = conn.execute(f"{joined_bill_select()} where b.id = ?", (bill_id,)).fetchone()
            if actor_id:
                write_audit(
                    conn, actor_id, "bill.create", "bill", bill_id, {"nim": bill["nim"], "briva": bill["briva"]}
                )
            return bill
    finally:
        conn.close()


def update_bill(
    db_path: str | Path, bill_id: str, payload: dict[str, object], actor_id: str | None = None
) -> sqlite3.Row | None:
    briva = normalize_text(payload.get("briva"))
    raw_period = normalize_text(payload.get("period"))
    bill_type = normalize_text(payload.get("bill_type")) or "UKT"
    payment_method = normalize_text(payload.get("payment_method")) or "BRIVA"
    if not briva:
        raise ValueError("Nomor BRIVA wajib diisi.")
    if not raw_period:
        raise ValueError("Periode pembayaran wajib diisi.")
    amount = validate_amount(payload.get("amount"))
    status = normalize_status_value(payload.get("status"))
    paid_amount = validate_paid_amount(payload.get("paid_amount"), amount, status)
    due_date = validate_due_date_value(payload.get("due_date"))
    instructions = (
        normalize_text(payload.get("instructions")) or "Bayar melalui BRIVA BRI dengan nomor BRIVA yang tampil."
    )
    payment_date, reference_number, notes = validate_payment_metadata(
        payload.get("payment_date"), payload.get("reference_number"), payload.get("notes")
    )

    conn = connect(db_path)
    try:
        with conn:
            current = conn.execute(
                "select id, student_id, status, paid_amount, payment_method from bills where id = ? and deleted_at is null",
                (bill_id,),
            ).fetchone()
            if not current:
                return None

            old_status = str(current["status"] or "unpaid")
            old_paid = int(current["paid_amount"] or 0)
            student_id = str(current["student_id"])

            from Backend.db import ensure_academic_period

            period = ensure_academic_period(conn, raw_period) or raw_period

            conn.execute(
                """
                update bills
                set briva = ?, amount = ?, paid_amount = ?, period = ?, bill_type = ?, status = ?,
                    payment_method = ?, instructions = ?, due_date = ?, updated_at = datetime('now')
                where id = ?
                """,
                (
                    briva,
                    amount,
                    paid_amount,
                    period,
                    bill_type,
                    status,
                    payment_method,
                    instructions,
                    due_date,
                    bill_id,
                ),
            )

            record_payment_transaction(
                conn,
                bill_id=bill_id,
                student_id=student_id,
                old_status=old_status,
                new_status=status,
                old_paid=old_paid,
                new_paid=paid_amount,
                recorded_by=actor_id,
                payment_method=payment_method,
                payment_date=payment_date,
                reference_number=reference_number,
                notes=notes,
                source="manual",
            )

            bill = conn.execute(f"{joined_bill_select()} where b.id = ?", (bill_id,)).fetchone()
            if actor_id:
                write_audit(
                    conn, actor_id, "bill.update", "bill", bill_id, {"nim": bill["nim"], "briva": bill["briva"]}
                )
            return bill
    finally:
        conn.close()


def get_bill_detail(db_path: str | Path, bill_id: str) -> dict[str, object] | None:
    with database_connection(db_path) as conn:
        row = conn.execute(
            f"{joined_bill_select()} where b.id = ? and b.deleted_at is null and s.deleted_at is null",
            (bill_id,),
        ).fetchone()
        if not row:
            return None

        student_id = str(row["student_id"])
        student = conn.execute(
            """
            select s.id, s.nim, s.full_name, s.no_ktp, s.tempat_lahir, s.tanggal_lahir, s.nama_ibu_kandung,
                   s.program_study, s.study_program_id, s.academic_status,
                   s.entry_year, s.entry_semester, s.entry_period,
                   s.email, s.address, s.phone_number, s.initial_registration, s.created_at,
                   sp.name as study_program_name, sp.code as study_program_code
            from students s
            left join study_programs sp on sp.id = s.study_program_id
            where s.id = ? and s.deleted_at is null
            """,
            (student_id,),
        ).fetchone()

    bill_dict = bill_row_to_dict(row)
    tx_res = list_payment_transactions(db_path, bill_id=bill_id, limit=50, offset=0)

    return {
        "bill": bill_dict,
        "student": student_row_to_dict(student) if student else None,
        "transactions": tx_res["transactions"],
        "pagination": tx_res["pagination"],
    }


def record_bill_payment(
    db_path: str | Path,
    bill_id: str,
    payload: dict[str, object],
    actor_id: str | None = None,
) -> dict[str, object]:
    conn = connect(db_path)
    try:
        with conn:
            row = conn.execute(
                f"{joined_bill_select()} where b.id = ? and b.deleted_at is null and s.deleted_at is null",
                (bill_id,),
            ).fetchone()
            if not row:
                raise ValueError("Tagihan tidak ditemukan.")

            amount = int(row["amount"])
            old_paid = int(row["paid_amount"] or 0)
            old_status = str(row["status"] or "unpaid")
            student_id = str(row["student_id"])
            remaining = max(0, amount - old_paid)

            if remaining <= 0 or old_status == "paid":
                raise ValueError("Tagihan ini sudah lunas.")

            raw_payment_amount = payload.get("payment_amount")
            if raw_payment_amount is None or str(raw_payment_amount).strip() == "":
                raise ValueError("Nominal pembayaran transaksi wajib diisi.")

            payment_amount = validate_amount(raw_payment_amount)
            if payment_amount <= 0:
                raise ValueError("Nominal pembayaran transaksi harus lebih dari 0.")
            if payment_amount > remaining:
                raise ValueError(
                    f"Nominal pembayaran ({rupiah(payment_amount)}) melebihi sisa tagihan ({rupiah(remaining)})."
                )

            new_paid = old_paid + payment_amount
            new_status = "paid" if new_paid >= amount else "partial"

            payment_date, reference_number, notes = validate_payment_metadata(
                payload.get("payment_date"), payload.get("reference_number"), payload.get("notes")
            )
            payment_method = normalize_text(payload.get("payment_method")) or str(row["payment_method"] or "BRIVA")

            conn.execute(
                "update bills set status = ?, paid_amount = ?, updated_at = datetime('now') where id = ?",
                (new_status, new_paid, bill_id),
            )

            record_payment_transaction(
                conn,
                bill_id=bill_id,
                student_id=student_id,
                old_status=old_status,
                new_status=new_status,
                old_paid=old_paid,
                new_paid=new_paid,
                recorded_by=actor_id,
                payment_method=payment_method,
                payment_date=payment_date,
                reference_number=reference_number,
                notes=notes,
                source="manual",
            )

            updated = conn.execute(
                f"{joined_bill_select()} where b.id = ? and b.deleted_at is null and s.deleted_at is null",
                (bill_id,),
            ).fetchone()

            if actor_id:
                write_audit(
                    conn,
                    actor_id,
                    "bill.payment",
                    "bill",
                    bill_id,
                    {
                        "payment_amount": payment_amount,
                        "old_paid": old_paid,
                        "new_paid": new_paid,
                        "status": new_status,
                        "briva": updated["briva"],
                        "nim": updated["nim"],
                        "payment_method": payment_method,
                        "reference_number": reference_number,
                    },
                )
    finally:
        conn.close()

    tx_res = list_payment_transactions(db_path, bill_id=bill_id, limit=50, offset=0)
    return {
        "bill": bill_row_to_dict(updated),
        "transactions": tx_res["transactions"],
    }


def delete_bill(db_path: str | Path, bill_id: str, actor_id: str | None = None, reason: str = "") -> sqlite3.Row | None:
    reason = require_delete_reason(reason)
    conn = connect(db_path)
    try:
        with conn:
            row = conn.execute(f"{joined_bill_select()} where b.id = ? and b.deleted_at is null", (bill_id,)).fetchone()
            if row:
                conn.execute(
                    """
                    update bills
                    set deleted_at = datetime('now'), deleted_by = ?, delete_reason = ?, updated_at = datetime('now')
                    where id = ?
                    """,
                    (actor_id, reason, bill_id),
                )
                if actor_id:
                    write_audit(
                        conn,
                        actor_id,
                        "bill.delete",
                        "bill",
                        bill_id,
                        {"nim": row["nim"], "briva": row["briva"], "reason": reason},
                    )
        return row
    finally:
        conn.close()


def list_imported_bill_groups(db_path: str | Path = config.DB_PATH) -> list[dict[str, object]]:
    with database_connection(db_path) as conn:
        rows = conn.execute(
            """
            select b.id, b.briva, b.amount, b.period, b.bill_type, b.status, b.payment_method, b.due_date, b.created_at,
                   b.source_file, b.source_row_number, s.nim, s.full_name
            from bills b
            join students s on s.id = b.student_id
            where b.deleted_at is null
              and s.deleted_at is null
              and lower(trim(b.source_file)) not in ('manual', 'manual admin')
            order by b.source_file desc, s.nim asc, b.source_row_number asc, b.created_at asc, b.briva asc
            """
        ).fetchall()

    groups: list[dict[str, object]] = []
    by_file: dict[str, dict[str, object]] = {}
    for row in rows:
        source_file = str(row["source_file"])
        group = by_file.get(source_file)
        if group is None:
            group = {
                "file_name": source_file,
                "total": 0,
                "student_count": 0,
                "total_amount": 0,
                "imported_at": str(row["created_at"]),
                "paid": 0,
                "partial": 0,
                "unpaid": 0,
                "bills": [],
                "_student_nims": set(),
            }
            by_file[source_file] = group
            groups.append(group)
        bills = group["bills"]
        assert isinstance(bills, list)
        bills.append(bill_row_to_dict(row))
        group["total"] = int(group["total"]) + 1
        group["total_amount"] = int(group["total_amount"]) + int(row["amount"])
        imported_at = str(row["created_at"])
        if imported_at < str(group["imported_at"]):
            group["imported_at"] = imported_at
        student_nims = group["_student_nims"]
        assert isinstance(student_nims, set)
        student_nims.add(str(row["nim"]))
        if row["status"] == "paid":
            group["paid"] = int(group["paid"]) + 1
        elif row["status"] == "partial":
            group["partial"] = int(group["partial"]) + 1
        else:
            group["unpaid"] = int(group["unpaid"]) + 1
    for group in groups:
        student_nims = group.pop("_student_nims")
        assert isinstance(student_nims, set)
        group["student_count"] = len(student_nims)
    groups.sort(key=lambda group: str(group["imported_at"]), reverse=True)
    return groups


def delete_imported_bill_group(
    db_path: str | Path,
    source_file: object,
    actor_id: str | None = None,
    reason: str = "",
) -> dict[str, object] | None:
    file_name = normalize_text(source_file)
    if not file_name:
        raise ValueError("Nama file wajib diisi.")
    if file_name.casefold() in {"manual", "manual admin"}:
        raise ValueError("Data Manual Admin bukan data import per file.")
    delete_reason = require_delete_reason(reason)

    conn = connect(db_path)
    try:
        with conn:
            rows = conn.execute(
                """
                select id
                from bills
                where source_file = ? and deleted_at is null
                """,
                (file_name,),
            ).fetchall()
            if not rows:
                return None
            conn.execute(
                """
                update bills
                set deleted_at = datetime('now'), deleted_by = ?, delete_reason = ?, updated_at = datetime('now')
                where source_file = ? and deleted_at is null
                """,
                (actor_id, delete_reason, file_name),
            )
            conn.execute("delete from import_issues where source_file = ?", (file_name,))
            if actor_id:
                write_audit(
                    conn,
                    actor_id,
                    "import_file.delete",
                    "import_file",
                    file_name,
                    {"reason": delete_reason, "deleted_bills": len(rows)},
                )
        return {"file_name": file_name, "deleted_bills": len(rows)}
    finally:
        conn.close()


def update_bill_status(
    db_path: str | Path,
    bill_id: str,
    status: str,
    paid_amount: object = None,
    recorded_by: str | None = None,
    payment_date: object = None,
    reference_number: object = None,
    notes: object = None,
) -> sqlite3.Row | None:
    if status not in {"paid", "partial", "unpaid"}:
        raise ValueError("Status hanya boleh paid, partial, atau unpaid.")
    payment_date, reference_number, notes = validate_payment_metadata(payment_date, reference_number, notes)

    conn = connect(db_path)
    try:
        with conn:
            row = conn.execute(
                f"{joined_bill_select()} where b.id = ? and b.deleted_at is null and s.deleted_at is null",
                (bill_id,),
            ).fetchone()
            if not row:
                updated = None
            else:
                old_status = str(row["status"])
                old_paid = int(row["paid_amount"] or 0)
                amount = int(row["amount"])
                student_id = str(row["student_id"])
                if status == "paid":
                    new_paid = amount
                elif status == "unpaid":
                    new_paid = 0
                else:
                    new_paid = validate_paid_amount(paid_amount, amount, "partial")

                conn.execute(
                    "update bills set status = ?, paid_amount = ?, updated_at = datetime('now') where id = ?",
                    (status, new_paid, bill_id),
                )

                record_payment_transaction(
                    conn,
                    bill_id=bill_id,
                    student_id=student_id,
                    old_status=old_status,
                    new_status=status,
                    old_paid=old_paid,
                    new_paid=new_paid,
                    recorded_by=recorded_by,
                    payment_method=str(row["payment_method"] or ""),
                    payment_date=payment_date,
                    reference_number=reference_number,
                    notes=notes,
                    source="manual",
                )

                updated = conn.execute(
                    f"{joined_bill_select()} where b.id = ? and b.deleted_at is null and s.deleted_at is null",
                    (bill_id,),
                ).fetchone()
                if recorded_by:
                    write_audit(
                        conn,
                        recorded_by,
                        "bill.status_update",
                        "bill",
                        bill_id,
                        {
                            "status": status,
                            "paid_amount": updated["paid_amount"],
                            "briva": updated["briva"],
                            "nim": updated["nim"],
                        },
                    )
    finally:
        conn.close()
    return updated


def update_bill_due_date(
    db_path: str | Path, bill_ids: list[str], due_date: str | None, actor_id: str | None = None
) -> list[sqlite3.Row]:
    if not bill_ids:
        return []
    due_date_str = str(due_date or "").strip()
    if due_date_str:
        parts = due_date_str.split("-")
        if len(parts) != 3 or not all(p.isdigit() for p in parts):
            raise ValueError("Format tanggal harus YYYY-MM-DD.")

    with database_transaction(db_path) as conn:
        placeholders = ",".join("?" for _ in bill_ids)
        conn.execute(
            f"update bills set due_date = ?, updated_at = datetime('now') where deleted_at is null and id in ({placeholders})",
            (due_date_str or None, *bill_ids),
        )
        updated = conn.execute(
            f"""
            select b.id, b.briva, b.amount, b.period, b.bill_type, b.status, b.payment_method, b.due_date,
                   b.source_file, b.source_row_number, s.nim, s.full_name
            from bills b
            join students s on s.id = b.student_id
            where b.deleted_at is null and s.deleted_at is null and b.id in ({placeholders})
            """,
            (*bill_ids,),
        ).fetchall()
        if actor_id:
            for row in updated:
                write_audit(
                    conn,
                    actor_id,
                    "bill.due_date_update",
                    "bill",
                    row["id"],
                    {"due_date": row["due_date"], "briva": row["briva"], "nim": row["nim"]},
                )
    return list(updated)


def write_lookup_log(nim: str, name: str, result_type: str) -> None:
    with database_transaction(config.DB_PATH) as conn:
        conn.execute(
            """
            insert into lookup_logs (id, nim_hash, name_hash, result_type)
            values (?, ?, ?, ?)
            """,
            (str(uuid.uuid4()), digest(nim), digest(name), result_type),
        )


def write_audit(
    conn: sqlite3.Connection,
    actor_id: str | None,
    action: str,
    entity_type: str,
    entity_id: str | None,
    metadata: dict[str, object] | None = None,
) -> None:
    # Service-level callers (imports/tests/system jobs) may not have an
    # admin_users row. Preserve the audit event as a system event instead of
    # failing and rolling back an otherwise valid transaction on FK checking.
    if actor_id and not conn.execute("select 1 from admin_users where id = ?", (actor_id,)).fetchone():
        actor_id = None
    conn.execute(
        """
        insert into audit_logs (id, actor_id, action, entity_type, entity_id, metadata)
        values (?, ?, ?, ?, ?, ?)
        """,
        (str(uuid.uuid4()), actor_id, action, entity_type, entity_id, json.dumps(metadata or {}, ensure_ascii=False)),
    )


def record_payment_transaction(
    conn: sqlite3.Connection,
    bill_id: str,
    student_id: str,
    old_status: str,
    new_status: str,
    old_paid: int,
    new_paid: int,
    recorded_by: str | None = None,
    payment_method: str | None = None,
    payment_date: str | None = None,
    reference_number: str | None = None,
    notes: str | None = None,
    source: str = "manual",
) -> None:
    """Record a payment state change as an append-only transaction log entry."""
    delta = new_paid - old_paid
    if delta == 0 and old_status == new_status:
        return  # No actual change, skip recording

    if delta > 0:
        tx_type = "payment"
    elif delta < 0:
        tx_type = "reversal"
    else:
        tx_type = "correction"

    # WIB is UTC+07:00 year-round, so an explicit fixed offset avoids relying
    # on OS/tzdata availability while keeping server-independent dates.
    today = payment_date or datetime.now(timezone(timedelta(hours=7))).date().isoformat()
    admin_id_val = recorded_by
    if admin_id_val:
        row = conn.execute("select id from admin_users where id = ?", (admin_id_val,)).fetchone()
        if not row:
            admin_id_val = None

    conn.execute(
        """
        insert into payment_transactions
            (id, bill_id, student_id, transaction_type, amount, running_paid_total,
             previous_status, new_status, payment_date, payment_method,
             reference_number, notes, recorded_by, source)
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            str(uuid.uuid4()),
            bill_id,
            student_id,
            tx_type,
            delta,
            new_paid,
            old_status,
            new_status,
            today,
            payment_method,
            reference_number,
            notes,
            admin_id_val,
            source,
        ),
    )


def list_payment_transactions(
    db_path: str | Path,
    bill_id: str | None = None,
    student_id: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, object]:
    """Retrieve paginated payment transactions filtered by bill_id or student_id."""
    conditions = []
    params: list[object] = []
    if bill_id:
        conditions.append("pt.bill_id = ?")
        params.append(bill_id)
    if student_id:
        conditions.append("(pt.student_id = ? or b.student_id = ?)")
        params.extend([student_id, student_id])

    where = f"where {' and '.join(conditions)}" if conditions else ""

    with database_connection(db_path) as conn:
        count_row = conn.execute(
            f"select count(*) as cnt from payment_transactions pt left join bills b on b.id = pt.bill_id {where}",
            params,
        ).fetchone()
        total = int(count_row["cnt"]) if count_row else 0

        rows = conn.execute(
            f"""
            select pt.id, pt.bill_id, coalesce(pt.student_id, b.student_id) as student_id,
                   pt.transaction_type, pt.amount,
                   pt.running_paid_total, pt.previous_status, pt.new_status,
                   pt.payment_date, pt.payment_method, pt.reference_number, pt.notes,
                   pt.recorded_by, pt.source, pt.created_at,
                   au.full_name as recorded_by_name,
                   b.briva, s.nim, s.full_name as student_name
            from payment_transactions pt
            left join admin_users au on au.id = pt.recorded_by
            left join bills b on b.id = pt.bill_id
            left join students s on s.id = coalesce(pt.student_id, b.student_id)
            {where}
            order by pt.created_at desc, pt.rowid desc
            limit ? offset ?
            """,
            (*params, limit, offset),
        ).fetchall()

    transactions = []
    for r in rows:
        tx = {
            "id": r["id"],
            "bill_id": r["bill_id"],
            "student_id": r["student_id"],
            "transaction_type": r["transaction_type"],
            "amount": r["amount"],
            "amount_formatted": rupiah(abs(r["amount"])),
            "running_paid_total": r["running_paid_total"],
            "running_paid_total_formatted": rupiah(r["running_paid_total"]),
            "previous_status": r["previous_status"],
            "new_status": r["new_status"],
            "payment_date": r["payment_date"],
            "payment_method": r["payment_method"],
            "reference_number": r["reference_number"],
            "notes": r["notes"],
            "recorded_by": r["recorded_by"],
            "recorded_by_name": r["recorded_by_name"],
            "source": r["source"],
            "created_at": r["created_at"],
            "briva": r["briva"],
            "nim": r["nim"],
            "student_name": r["student_name"],
        }
        transactions.append(tx)

    return {
        "transactions": transactions,
        "pagination": {"total": total, "limit": limit, "offset": offset},
    }


def payment_transaction_target_exists(
    db_path: str | Path,
    bill_id: str | None = None,
    student_id: str | None = None,
) -> bool:
    """Return whether the active bill or student requested by a history route exists."""
    if bool(bill_id) == bool(student_id):
        raise ValueError("Tentukan tepat satu target riwayat pembayaran.")

    with database_connection(db_path) as conn:
        if bill_id:
            row = conn.execute(
                "select 1 from bills where id = ? and deleted_at is null",
                (bill_id,),
            ).fetchone()
        else:
            row = conn.execute(
                "select 1 from students where id = ? and deleted_at is null",
                (student_id,),
            ).fetchone()
        return row is not None


def store_import_preview(token: str, admin_id: str, file_name: str, stored_path: str | Path) -> None:
    with database_transaction(config.DB_PATH) as conn:
        conn.execute(
            """
            insert into import_previews (token, admin_id, file_name, stored_path, expires_at)
            values (?, ?, ?, ?, datetime('now', ?))
            on conflict(token) do update set
              admin_id = excluded.admin_id,
              file_name = excluded.file_name,
              stored_path = excluded.stored_path,
              expires_at = excluded.expires_at
            """,
            (token, admin_id, file_name, str(stored_path), f"+{config.IMPORT_RETENTION_SECONDS} seconds"),
        )


def get_import_preview_for_admin(token: str, admin: sqlite3.Row) -> sqlite3.Row | None:
    with database_connection(config.DB_PATH) as conn:
        row = conn.execute(
            """
            select token, admin_id, file_name, stored_path, expires_at
            from import_previews
            where token = ?
              and expires_at > datetime('now')
              and (? = 'super_admin' or admin_id = ?)
            """,
            (token, admin["role"], admin["id"]),
        ).fetchone()
    return row


def delete_import_preview(token: str) -> None:
    with database_transaction(config.DB_PATH) as conn:
        conn.execute("delete from import_previews where token = ?", (token,))


def authenticate_admin(email: str, password: str) -> sqlite3.Row | None:
    with database_connection(config.DB_PATH) as conn:
        admin = conn.execute(
            """
            select id, email, password_hash, full_name, role, is_active
            from admin_users
            where email = ?
            """,
            (email,),
        ).fetchone()
    if not admin or not admin["is_active"] or not verify_password(password, admin["password_hash"]):
        return None
    return admin


def create_admin_session(admin: sqlite3.Row) -> str:
    token = secrets.token_urlsafe(32)
    session_id = str(uuid.uuid4())
    with database_transaction(config.DB_PATH) as conn:
        conn.execute(
            """
            insert into admin_sessions (id, admin_id, token_hash, expires_at)
            values (?, ?, ?, datetime('now', ?))
            """,
            (session_id, admin["id"], token_hash(token), f"+{config.SESSION_TTL_HOURS} hours"),
        )
        write_audit(conn, admin["id"], "admin.login", "admin_session", session_id, {"email": admin["email"]})
    return token


def delete_admin_session(token: str | None, admin: sqlite3.Row | None) -> None:
    with database_transaction(config.DB_PATH) as conn:
        if token:
            conn.execute("delete from admin_sessions where token_hash = ?", (token_hash(token),))
        if admin:
            write_audit(conn, admin["id"], "admin.logout", "admin_session", None, {"email": admin["email"]})


def find_admin_by_session(token: str | None) -> sqlite3.Row | None:
    if not token:
        return None
    with database_connection(config.DB_PATH) as conn:
        admin = conn.execute(
            """
            select u.id, u.email, u.full_name, u.role
            from admin_sessions s
            join admin_users u on u.id = s.admin_id
            where s.token_hash = ?
              and s.expires_at > datetime('now')
              and u.is_active = 1
            """,
            (token_hash(token),),
        ).fetchone()
    return admin


# ==========================================
# MASTER DATA: STUDY PROGRAMS
# ==========================================


def list_study_programs(db_path: str | Path = config.DB_PATH) -> list[dict[str, object]]:
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
# DASHBOARD STATS & FINANCIAL REPORTS
# ==========================================


def get_dashboard_stats(db_path: str | Path = config.DB_PATH) -> dict[str, object]:
    """Compatibility wrapper for callers that still import the legacy service module."""
    return ReportingService(db_path).dashboard_stats()


def get_financial_summary(
    db_path: str | Path = config.DB_PATH,
    period: str = "",
    study_program_id: str = "",
    entry_period: str = "",
) -> dict[str, object]:
    """Compatibility wrapper for callers that still import the legacy service module."""
    return ReportingService(db_path).financial_summary(
        period=period,
        study_program_id=study_program_id,
        entry_period=entry_period,
    )
