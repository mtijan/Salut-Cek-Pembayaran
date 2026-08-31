"""Students slice – ensure_student, list, get_detail, create, update, delete."""

from __future__ import annotations

import sqlite3
import uuid
from pathlib import Path
from typing import cast

from Backend.app import config
from Backend.app.domain.billing import bill_row_to_dict, joined_bill_select, summarize_payment_status
from Backend.app.domain.common import rupiah
from Backend.app.domain.students import student_row_to_dict, validate_academic_status, validate_nim_value
from Backend.app.services import audit as _audit
from Backend.app.services.audit import list_payment_transactions
from Backend.db import connect, database_connection, parse_entry_registration
from Backend.excel_reader import (
    clean_demographic_value,
    normalize_imported_name,
    normalize_name,
    normalize_nim,
    normalize_text,
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
    """Insert a new student record or restore/update an existing profile matching the unique NIM."""
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
    """List active students filtered by search term, study program, academic status, and entry cohort."""
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
    """Fetch complete Student 360 profile, including billing summary and transaction history."""
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
    total_amount = sum(cast(int, bill["amount"]) for bill in bill_list)
    total_paid = sum(
        cast(int, bill["amount"])
        if bill["status"] == "paid"
        else (cast(int, bill.get("paid_amount", 0)) if bill["status"] == "partial" else 0)
        for bill in bill_list
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
    """Create a new student master record with validation and audit logging."""
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
                _audit.write_audit(conn, actor_id, "student.create", "student", student["id"], {"nim": student["nim"]})
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
    """Update student biographical and academic profile fields with audit logging."""
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
                _audit.write_audit(conn, actor_id, "student.update", "student", student_id, {"nim": student["nim"]})
            return student
    finally:
        conn.close()


def delete_student(
    db_path: str | Path, student_id: str, actor_id: str | None = None, reason: str = ""
) -> sqlite3.Row | None:
    """Soft delete a student and cascade soft deletion to all associated active bills."""
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
                    _audit.write_audit(
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
