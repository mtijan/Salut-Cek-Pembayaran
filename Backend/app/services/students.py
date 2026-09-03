"""Students slice – ensure_student, list, get_detail, create, update, delete with repository delegation."""

from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import cast

from Backend.app import config
from Backend.app.domain.billing import bill_row_to_dict, summarize_payment_status
from Backend.app.domain.common import rupiah
from Backend.app.domain.students import student_row_to_dict, validate_academic_status, validate_nim_value
from Backend.app.repositories.students import StudentRepository
from Backend.app.services import audit as _audit
from Backend.app.services.audit import list_payment_transactions
from Backend.db import connect, database_connection, parse_entry_registration, resolve_study_program_id
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
        resolved_program_name = StudentRepository(conn).find_study_program_name(norm_prodi_id)
        if resolved_program_name and not norm_prodi:
            norm_prodi = resolved_program_name
    elif norm_prodi:
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

    repo = StudentRepository(conn)
    row = repo.find_by_nim(normalized_nim)
    if row:
        optional_fields: dict[str, object] = {}
        if norm_prodi:
            optional_fields["program_study"] = norm_prodi
        if norm_prodi_id:
            optional_fields["study_program_id"] = norm_prodi_id
        if norm_status is not None:
            optional_fields["academic_status"] = norm_status
        if norm_year is not None:
            optional_fields["entry_year"] = norm_year
        if norm_sem:
            optional_fields["entry_semester"] = norm_sem
        if norm_period:
            optional_fields["entry_period"] = norm_period
        if norm_email:
            optional_fields["email"] = norm_email
        if norm_address:
            optional_fields["address"] = norm_address
        if norm_phone:
            optional_fields["phone_number"] = norm_phone
        if norm_ktp:
            optional_fields["no_ktp"] = norm_ktp
        if norm_tempat:
            optional_fields["tempat_lahir"] = norm_tempat
        if norm_tgl:
            optional_fields["tanggal_lahir"] = norm_tgl
        if norm_ibu:
            optional_fields["nama_ibu_kandung"] = norm_ibu
        if norm_reg:
            optional_fields["initial_registration"] = norm_reg
        return repo.update_or_restore_by_nim(
            str(row["id"]),
            full_name=normalized_name,
            name_norm=normalize_name(normalized_name),
            deleted=row["deleted_at"] is not None,
            optional_fields=optional_fields,
        )

    return repo.create_profile(
        {
            "nim": normalized_nim,
            "full_name": normalized_name,
            "name_norm": normalize_name(normalized_name),
            "no_ktp": norm_ktp,
            "tempat_lahir": norm_tempat,
            "tanggal_lahir": norm_tgl,
            "nama_ibu_kandung": norm_ibu,
            "program_study": norm_prodi,
            "study_program_id": norm_prodi_id,
            "academic_status": norm_status or "aktif",
            "entry_year": norm_year,
            "entry_semester": norm_sem,
            "entry_period": norm_period,
            "email": norm_email,
            "address": norm_address,
            "phone_number": norm_phone,
            "initial_registration": norm_reg,
        }
    )


def list_students(
    db_path: str | Path = config.DB_PATH,
    query: str = "",
    limit: int = 2000,
    offset: int = 0,
    study_program_id: str = "",
    academic_status: str = "",
    entry_year: int | None = None,
    entry_period: str = "",
    sort_by: str = "",
) -> list[dict[str, object]]:
    """List active students filtered by search term, study program, academic status, and entry cohort."""
    with database_connection(db_path) as conn:
        rows = StudentRepository(conn).list_admin(
            query=query,
            limit=limit,
            offset=offset,
            study_program_id=study_program_id,
            academic_status=academic_status,
            entry_year=entry_year,
            entry_period=entry_period,
            sort_by=sort_by,
        )
    return [student_row_to_dict(row) for row in rows]


def get_student_detail(db_path: str | Path, student_id: str) -> dict[str, object] | None:
    """Fetch complete Student 360 profile, including billing summary and transaction history."""
    with database_connection(db_path) as conn:
        repo = StudentRepository(conn)
        student = repo.find_by_id(student_id)
        if not student:
            return None

        bills = repo.get_bills_for_student(student_id)

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
            repo = StudentRepository(conn)
            existing = repo.find_by_id(student_id)
            if not existing:
                return None
            duplicate = repo.find_duplicate_nim(normalized_nim, exclude_id=student_id)
            if duplicate:
                raise ValueError("NIM sudah digunakan mahasiswa lain.")
            student = repo.update_profile(
                student_id,
                {
                    "nim": normalized_nim,
                    "full_name": normalized_name,
                    "name_norm": normalize_name(normalized_name),
                    "no_ktp": no_ktp,
                    "tempat_lahir": tempat,
                    "tanggal_lahir": tgl,
                    "nama_ibu_kandung": ibu,
                    "program_study": prodi,
                    "study_program_id": prodi_id,
                    "academic_status": status,
                    "entry_year": year,
                    "entry_semester": sem,
                    "entry_period": period,
                    "email": email,
                    "address": address,
                    "phone_number": phone,
                    "initial_registration": reg,
                },
            )
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
            repo = StudentRepository(conn)
            row = repo.soft_delete(student_id, actor_id=actor_id, reason=reason)
            if row and actor_id:
                _audit.write_audit(
                    conn, actor_id, "student.delete", "student", student_id, {"nim": row["nim"], "reason": reason}
                )
        return row
    finally:
        conn.close()
