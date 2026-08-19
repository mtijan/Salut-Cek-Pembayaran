from __future__ import annotations

import json
import secrets
import sqlite3
import time
import uuid
from pathlib import Path

from Backend.app import config
from Backend.app.security import digest, hash_password, token_hash, verify_password
from Backend.db import connect, init_db, parse_entry_registration
from Backend.excel_reader import (
    clean_demographic_value,
    normalize_imported_name,
    normalize_name,
    normalize_nim,
    normalize_text,
)


MONTH_NAMES_ID = [
    "",
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
]


def rupiah(value: int) -> str:
    return "Rp " + f"{value:,}".replace(",", ".")


def format_due_date(due_date_str: str | None) -> str:
    if not due_date_str:
        return ""
    cleaned = str(due_date_str).strip()
    try:
        parts = cleaned.split("-")
        if len(parts) == 3:
            year, month, day = int(parts[0]), int(parts[1]), int(parts[2])
            if 1 <= month <= 12 and 1 <= day <= 31:
                return f"{day} {MONTH_NAMES_ID[month]} {year}"
    except (ValueError, IndexError):
        pass
    return cleaned


def format_entry_period(entry_period: str | None, entry_semester: str | None = None) -> str:
    if not entry_period:
        return ""
    p = str(entry_period).strip()
    if "." in p:
        parts = p.split(".")
        sem_num = parts[1] if len(parts) > 1 else ""
        sem_name = "Ganjil" if sem_num == "1" else "Genap" if sem_num == "2" else f"Semester {sem_num}"
        return f"{p} ({sem_name})"
    if entry_semester:
        sem_name = "Ganjil" if str(entry_semester).lower() == "ganjil" else "Genap" if str(entry_semester).lower() == "genap" else str(entry_semester).title()
        return f"{p} ({sem_name})"
    return p


def sanitize_filename(filename: str) -> str:
    cleaned = "".join(ch for ch in filename if ch.isalnum() or ch in "._- ")
    return cleaned.strip() or "import.xlsx"


def validate_runtime_configuration() -> None:
    if config.APP_ENV != "production":
        return
    missing = [
        name
        for name, value in {
            "LOOKUP_HASH_SECRET": config.LOOKUP_HASH_SECRET,
            "ADMIN_BOOTSTRAP_EMAIL": config.ADMIN_BOOTSTRAP_EMAIL,
            "ADMIN_BOOTSTRAP_PASSWORD": config.ADMIN_BOOTSTRAP_PASSWORD,
        }.items()
        if not value
    ]
    if missing:
        raise RuntimeError(f"Konfigurasi production belum lengkap: {', '.join(missing)}")


def cleanup_stale_imports() -> None:
    if not config.IMPORT_DIR.exists():
        return
    cutoff = time.time() - config.IMPORT_RETENTION_SECONDS
    for workbook in config.IMPORT_DIR.glob("*.xlsx"):
        if workbook.stat().st_mtime < cutoff:
            workbook.unlink(missing_ok=True)
    conn = connect(config.DB_PATH)
    with conn:
        conn.execute("delete from import_previews where expires_at <= datetime('now')")
    conn.close()


def ensure_database() -> None:
    validate_runtime_configuration()
    conn = connect(config.DB_PATH)
    init_db(conn)
    admin_total = conn.execute("select count(*) as total from admin_users").fetchone()["total"]
    if admin_total == 0:
        if not config.ADMIN_BOOTSTRAP_EMAIL or not config.ADMIN_BOOTSTRAP_PASSWORD:
            conn.close()
            raise RuntimeError("Admin awal belum ada. Set ADMIN_BOOTSTRAP_EMAIL dan ADMIN_BOOTSTRAP_PASSWORD.")
        with conn:
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
    conn.close()


def bill_row_to_dict(row: sqlite3.Row) -> dict[str, object]:
    keys = row.keys()
    due_date = row["due_date"] if "due_date" in keys and row["due_date"] else ""
    amount = int(row["amount"]) if "amount" in keys and row["amount"] is not None else 0
    status = str(row["status"]) if "status" in keys and row["status"] else "unpaid"

    raw_paid = row["paid_amount"] if "paid_amount" in keys and row["paid_amount"] is not None else 0
    if status == "paid":
        paid_amount = amount
    elif status == "unpaid":
        paid_amount = 0
    else:
        paid_amount = int(raw_paid or 0)

    remaining_amount = max(0, amount - paid_amount)

    student_id = row["student_id"] if "student_id" in keys and row["student_id"] else ""
    student_nim = str(row["nim"]) if "nim" in keys and row["nim"] else ""
    student_name = str(row["full_name"]) if "full_name" in keys and row["full_name"] else ""
    study_program_name = str(row["study_program_name"]) if "study_program_name" in keys and row["study_program_name"] else (
        str(row["program_study"]) if "program_study" in keys and row["program_study"] else ""
    )

    return {
        "id": row["id"],
        "student_id": student_id,
        "nim": student_nim,
        "full_name": student_name,
        "student_nim": student_nim,
        "student_name": student_name,
        "study_program_name": study_program_name,
        "period": row["period"] if "period" in keys else "",
        "bill_type": row["bill_type"] if "bill_type" in keys else "",
        "status": status,
        "amount": amount,
        "amount_formatted": rupiah(amount),
        "paid_amount": paid_amount,
        "paid_amount_formatted": rupiah(paid_amount),
        "remaining_amount": remaining_amount,
        "remaining_amount_formatted": rupiah(remaining_amount),
        "payment_method": row["payment_method"] if "payment_method" in keys else "BRIVA",
        "briva": row["briva"] if "briva" in keys else "",
        "instructions": row["instructions"] if "instructions" in keys and row["instructions"] else "",
        "due_date": due_date,
        "due_date_formatted": format_due_date(due_date),
        "source_file": row["source_file"] if "source_file" in keys else "",
        "source_row_number": row["source_row_number"] if "source_row_number" in keys else None,
    }


def student_row_to_dict(row: sqlite3.Row) -> dict[str, object]:
    keys = row.keys()
    entry_period = row["entry_period"] if "entry_period" in keys and row["entry_period"] else ""
    entry_semester = row["entry_semester"] if "entry_semester" in keys and row["entry_semester"] else ""
    return {
        "id": row["id"],
        "nim": row["nim"],
        "full_name": row["full_name"],
        "no_ktp": row["no_ktp"] if "no_ktp" in keys and row["no_ktp"] else "",
        "tempat_lahir": row["tempat_lahir"] if "tempat_lahir" in keys and row["tempat_lahir"] else "",
        "tanggal_lahir": row["tanggal_lahir"] if "tanggal_lahir" in keys and row["tanggal_lahir"] else "",
        "nama_ibu_kandung": row["nama_ibu_kandung"] if "nama_ibu_kandung" in keys and row["nama_ibu_kandung"] else "",
        "program_study": row["program_study"] if "program_study" in keys and row["program_study"] else "",
        "study_program_id": row["study_program_id"] if "study_program_id" in keys and row["study_program_id"] else "",
        "study_program_name": row["study_program_name"] if "study_program_name" in keys and row["study_program_name"] else (row["program_study"] if "program_study" in keys and row["program_study"] else ""),
        "study_program_code": row["study_program_code"] if "study_program_code" in keys and row["study_program_code"] else "",
        "academic_status": row["academic_status"] if "academic_status" in keys and row["academic_status"] else "aktif",
        "entry_year": row["entry_year"] if "entry_year" in keys and row["entry_year"] is not None else None,
        "entry_semester": entry_semester,
        "entry_period": entry_period,
        "entry_period_formatted": format_entry_period(entry_period, entry_semester),
        "email": row["email"] if "email" in keys and row["email"] else "",
        "address": row["address"] if "address" in keys and row["address"] else "",
        "phone_number": row["phone_number"] if "phone_number" in keys and row["phone_number"] else "",
        "initial_registration": row["initial_registration"] if "initial_registration" in keys and row["initial_registration"] else "",
        "bill_count": row["bill_count"] if "bill_count" in keys else 0,
        "total_amount": row["total_amount"] if "total_amount" in keys and row["total_amount"] is not None else 0,
        "total_amount_formatted": rupiah(int(row["total_amount"] or 0)) if "total_amount" in keys else rupiah(0),
    }


def joined_bill_select() -> str:
    return """
        select b.id, b.student_id, b.briva, b.amount, coalesce(b.paid_amount, 0) as paid_amount,
               b.period, b.bill_type, b.status, b.payment_method, b.instructions, b.due_date, b.created_at,
               b.source_file, b.source_row_number, s.nim, s.full_name, s.program_study,
               sp.name as study_program_name
        from bills b
        join students s on s.id = b.student_id
        left join study_programs sp on sp.id = s.study_program_id
    """


def validate_due_date_value(due_date: object) -> str | None:
    due_date_str = str(due_date or "").strip()
    if not due_date_str:
        return None
    parts = due_date_str.split("-")
    if len(parts) != 3 or not all(p.isdigit() for p in parts):
        raise ValueError("Format tanggal harus YYYY-MM-DD.")
    return due_date_str


def validate_amount(value: object) -> int:
    text = str(value or "").replace(".", "").replace(",", "").strip()
    if not text.isdigit():
        raise ValueError("Nominal tagihan wajib berupa angka.")
    amount = int(text)
    if amount <= 0:
        raise ValueError("Nominal tagihan harus lebih dari 0.")
    return amount


def validate_paid_amount(value: object, total_amount: int, status: str) -> int:
    if status == "paid":
        return total_amount
    if status == "unpaid":
        return 0
    # For partial status
    if value is None or value == "":
        raise ValueError("Nominal yang dibayarkan wajib diisi untuk status Bayar Sebagian.")
    text = str(value).replace(".", "").replace(",", "").strip()
    if not text.isdigit():
        raise ValueError("Nominal yang dibayarkan wajib berupa angka.")
    paid = int(text)
    if paid <= 0:
        raise ValueError("Nominal bayar sebagian harus lebih dari 0.")
    if paid >= total_amount:
        raise ValueError("Nominal bayar sebagian harus lebih kecil dari total tagihan. Jika sudah lunas, silakan pilih status Lunas.")
    return paid


def normalize_status_value(status: object) -> str:
    value = str(status or "unpaid").strip().lower()
    if value not in {"paid", "partial", "unpaid"}:
        raise ValueError("Status hanya boleh paid, partial, atau unpaid.")
    return value


def normalize_payment_status_alias(status: object) -> str:
    value = str(status or "unpaid").strip().lower()
    aliases = {
        "paid": "paid",
        "lunas": "paid",
        "partial": "partial",
        "bayar sebagian": "partial",
        "lunas sebagian": "partial",
        "dicicil": "partial",
        "cicil": "partial",
        "unpaid": "unpaid",
        "belum lunas": "unpaid",
    }
    return aliases.get(value, "unpaid")


def summarize_payment_status(statuses: list[object]) -> str:
    normalized = [normalize_payment_status_alias(status) for status in statuses]
    if normalized and all(status == "paid" for status in normalized):
        return "paid"
    if "partial" in normalized:
        return "partial"
    return "unpaid"


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
    normalized_nim = normalize_nim(nim)
    normalized_name = normalize_imported_name(full_name)
    if not normalized_nim:
        raise ValueError("NIM wajib diisi.")
    if not normalized_name:
        raise ValueError("Nama mahasiswa wajib diisi.")

    norm_prodi = clean_demographic_value(program_study)
    norm_prodi_id = normalize_text(study_program_id) or None
    if norm_prodi_id:
        sp_row = conn.execute("select name from study_programs where id = ? or upper(code) = ?", (norm_prodi_id, norm_prodi_id.upper())).fetchone()
        if sp_row and not norm_prodi:
            norm_prodi = str(sp_row["name"])
    elif norm_prodi:
        from Backend.db import resolve_study_program_id
        norm_prodi_id = resolve_study_program_id(conn, norm_prodi)

    norm_status = normalize_text(academic_status) or None
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
        norm_year = int(str(entry_year).strip()) if entry_year is not None and str(entry_year).strip().isdigit() else parsed_year
    except (ValueError, TypeError):
        norm_year = parsed_year
    norm_sem = clean_demographic_value(entry_semester) or parsed_sem
    norm_period = clean_demographic_value(entry_period) or parsed_period

    row = conn.execute("select id, nim, full_name from students where nim = ? and deleted_at is null", (normalized_nim,)).fetchone()
    if row:
        updates = ["full_name = ?", "name_norm = ?", "updated_at = datetime('now')"]
        params: list[object] = [normalized_name, normalize_name(normalized_name)]
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
            student_id, normalized_nim, normalized_name, normalize_name(normalized_name),
            norm_ktp, norm_tempat, norm_tgl, norm_ibu,
            norm_prodi, norm_prodi_id, norm_status or "aktif", norm_year, norm_sem, norm_period,
            norm_email, norm_address, norm_phone, norm_reg,
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
    conn = connect(db_path)
    init_db(conn)
    params: list[object] = []
    where_clauses = ["s.deleted_at is null"]
    if search:
        where_clauses.append(
            "(s.nim like ? or s.full_name like ? or s.program_study like ? or sp.name like ? or sp.code like ? or s.no_ktp like ? or s.email like ? or s.phone_number like ?)"
        )
        params.extend([f"%{search}%", f"%{search}%", f"%{search}%", f"%{search}%", f"%{search}%", f"%{search}%", f"%{search}%", f"%{search}%"])
    if study_program_id:
        where_clauses.append("(s.study_program_id = ? or sp.code = ? or lower(s.program_study) = lower(?) or lower(sp.name) = lower(?))")
        params.extend([study_program_id.strip(), study_program_id.strip(), study_program_id.strip(), study_program_id.strip()])
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
    conn.close()
    return [student_row_to_dict(row) for row in rows]


def get_student_detail(db_path: str | Path, student_id: str) -> dict[str, object] | None:
    conn = connect(db_path)
    init_db(conn)
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
        conn.close()
        return None

    bills = conn.execute(
        f"""
        {joined_bill_select()}
        where b.student_id = ? and b.deleted_at is null
        order by b.created_at desc, b.period desc
        """,
        (student_id,),
    ).fetchall()
    conn.close()

    bill_list = [bill_row_to_dict(b) for b in bills]
    total_amount = sum(int(b["amount"]) for b in bill_list)
    total_paid = sum(int(b["amount"]) if b["status"] == "paid" else (int(b.get("paid_amount", 0)) if b["status"] == "partial" else 0) for b in bill_list)
    total_outstanding = max(0, total_amount - total_paid)
    overall_status = summarize_payment_status([b["status"] for b in bill_list])

    return {
        "student": student_row_to_dict(student),
        "bills": bill_list,
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
) -> sqlite3.Row:
    if isinstance(nim_or_payload, dict):
        data = nim_or_payload
    elif isinstance(payload, dict):
        data = payload
    else:
        data = {"nim": nim_or_payload, "full_name": full_name}

    conn = connect(db_path)
    init_db(conn)
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
    finally:
        conn.close()
    return student


def require_delete_reason(reason: str) -> str:
    cleaned = normalize_text(reason)
    if not cleaned:
        raise ValueError("Alasan penghapusan wajib diisi.")
    return cleaned


def update_student(db_path: str | Path, student_id: str, payload: dict[str, object]) -> sqlite3.Row | None:
    normalized_nim = normalize_nim(payload.get("nim"))
    normalized_name = normalize_imported_name(payload.get("full_name"))
    if not normalized_nim:
        raise ValueError("NIM wajib diisi.")
    if not normalized_name:
        raise ValueError("Nama mahasiswa wajib diisi.")

    prodi = clean_demographic_value(payload.get("program_study"))
    prodi_id = normalize_text(payload.get("study_program_id")) or None
    status = normalize_text(payload.get("academic_status")) or "aktif"
    email = clean_demographic_value(payload.get("email"))
    address = clean_demographic_value(payload.get("address"))
    phone = normalize_nim(payload.get("phone_number")) if payload.get("phone_number") and clean_demographic_value(payload.get("phone_number")) else None
    no_ktp = clean_demographic_value(payload.get("no_ktp"))
    tempat = clean_demographic_value(payload.get("tempat_lahir"))
    tgl = clean_demographic_value(payload.get("tanggal_lahir"))
    ibu = clean_demographic_value(payload.get("nama_ibu_kandung"))
    reg = clean_demographic_value(payload.get("initial_registration"))

    parsed_year, parsed_sem, parsed_period = parse_entry_registration(reg)
    try:
        year = int(str(payload.get("entry_year")).strip()) if payload.get("entry_year") is not None and str(payload.get("entry_year")).strip().isdigit() else parsed_year
    except (ValueError, TypeError):
        year = parsed_year
    sem = clean_demographic_value(payload.get("entry_semester")) or parsed_sem
    period = clean_demographic_value(payload.get("entry_period")) or parsed_period

    conn = connect(db_path)
    init_db(conn)
    try:
        with conn:
            existing = conn.execute("select id from students where id = ?", (student_id,)).fetchone()
            if not existing:
                return None
            duplicate = conn.execute("select id from students where nim = ? and id <> ?", (normalized_nim, student_id)).fetchone()
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
                    normalized_nim, normalized_name, normalize_name(normalized_name),
                    no_ktp, tempat, tgl, ibu,
                    prodi, prodi_id, status, year, sem, period,
                    email, address, phone, reg, student_id,
                ),
            )
            return conn.execute("select * from students where id = ?", (student_id,)).fetchone()
    finally:
        conn.close()


def delete_student(db_path: str | Path, student_id: str, actor_id: str | None = None, reason: str = "") -> sqlite3.Row | None:
    reason = require_delete_reason(reason)
    conn = connect(db_path)
    init_db(conn)
    try:
        with conn:
            row = conn.execute("select id, nim, full_name from students where id = ? and deleted_at is null", (student_id,)).fetchone()
            if row:
                conn.execute(
                    """
                    update students
                    set deleted_at = datetime('now'), deleted_by = ?, delete_reason = ?, updated_at = datetime('now')
                    where id = ?
                    """,
                    (actor_id, reason, student_id),
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


def bill_filter_clause(query: str = "", status: str = "", source: str = "") -> tuple[str, list[object]]:
    search = normalize_text(query)
    normalized_status = normalize_text(status).lower()
    normalized_source = normalize_text(source).lower()
    params: list[object] = []
    where_clauses = ["b.deleted_at is null", "s.deleted_at is null"]
    if search:
        where_clauses.append("(s.nim like ? or s.full_name like ? or b.briva like ? or b.period like ? or b.bill_type like ?)")
        params.extend([f"%{search}%", f"%{search}%", f"%{search}%", f"%{search}%", f"%{search}%"])
    if normalized_status:
        where_clauses.append("b.status = ?")
        params.append(normalized_status)
    if normalized_source == "manual":
        where_clauses.append("lower(trim(b.source_file)) in ('manual', 'manual admin')")
    elif normalized_source == "import":
        where_clauses.append("lower(trim(b.source_file)) not in ('manual', 'manual admin')")
    return "where " + " and ".join(where_clauses), params


def list_bills(
    db_path: str | Path = config.DB_PATH,
    query: str = "",
    limit: int = 2000,
    offset: int = 0,
    status: str = "",
    source: str = "",
) -> list[dict[str, object]]:
    limit = max(1, min(int(limit or 2000), 5000))
    offset = max(0, int(offset or 0))
    conn = connect(db_path)
    init_db(conn)
    where, params = bill_filter_clause(query, status, source)
    rows = conn.execute(
        f"""
        {joined_bill_select()}
        {where}
        order by b.updated_at desc, b.created_at desc
        limit ? offset ?
        """,
        (*params, limit, offset),
    ).fetchall()
    conn.close()
    return [bill_row_to_dict(row) for row in rows]


def count_bills(db_path: str | Path = config.DB_PATH, query: str = "", status: str = "", source: str = "") -> int:
    conn = connect(db_path)
    init_db(conn)
    where, params = bill_filter_clause(query, status, source)
    row = conn.execute(
        f"""
        select count(*) as total
        from bills b
        join students s on s.id = b.student_id
        {where}
        """,
        params,
    ).fetchone()
    conn.close()
    return int(row["total"] if row else 0)


def list_import_issues(db_path: str | Path = config.DB_PATH, limit: int = 500) -> list[dict[str, object]]:
    limit = max(1, min(int(limit or 500), 2000))
    conn = connect(db_path)
    init_db(conn)
    rows = conn.execute(
        """
        select id, source_file, sheet_name, row_number, nim, full_name, briva, amount, note, created_at
        from import_issues
        order by created_at desc, source_file asc, row_number asc
        limit ?
        """,
        (limit,),
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]


def create_bill(db_path: str | Path, payload: dict[str, object]) -> sqlite3.Row:
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
    instructions = normalize_text(payload.get("instructions")) or "Bayar melalui BRIVA BRI dengan nomor BRIVA yang tampil."

    conn = connect(db_path)
    init_db(conn)
    try:
        with conn:
            from Backend.db import ensure_academic_period
            period = ensure_academic_period(conn, raw_period) or raw_period

            student_id = normalize_text(payload.get("student_id"))
            if student_id:
                student = conn.execute("select id, nim, full_name from students where id = ? and deleted_at is null", (student_id,)).fetchone()
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
                (bill_id, student["id"], briva, amount, paid_amount, period, bill_type, status, payment_method, instructions, due_date, "Manual Admin"),
            )
            return conn.execute(f"{joined_bill_select()} where b.id = ?", (bill_id,)).fetchone()
    finally:
        conn.close()


def update_bill(db_path: str | Path, bill_id: str, payload: dict[str, object]) -> sqlite3.Row | None:
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
    instructions = normalize_text(payload.get("instructions")) or "Bayar melalui BRIVA BRI dengan nomor BRIVA yang tampil."

    conn = connect(db_path)
    init_db(conn)
    try:
        with conn:
            current = conn.execute("select id, student_id from bills where id = ? and deleted_at is null", (bill_id,)).fetchone()
            if not current:
                return None

            from Backend.db import ensure_academic_period
            period = ensure_academic_period(conn, raw_period) or raw_period

            conn.execute(
                """
                update bills
                set briva = ?, amount = ?, paid_amount = ?, period = ?, bill_type = ?, status = ?,
                    payment_method = ?, instructions = ?, due_date = ?, updated_at = datetime('now')
                where id = ?
                """,
                (briva, amount, paid_amount, period, bill_type, status, payment_method, instructions, due_date, bill_id),
            )
            return conn.execute(f"{joined_bill_select()} where b.id = ?", (bill_id,)).fetchone()
    finally:
        conn.close()


def delete_bill(db_path: str | Path, bill_id: str, actor_id: str | None = None, reason: str = "") -> sqlite3.Row | None:
    reason = require_delete_reason(reason)
    conn = connect(db_path)
    init_db(conn)
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
        return row
    finally:
        conn.close()


def list_imported_bill_groups(db_path: str | Path = config.DB_PATH) -> list[dict[str, object]]:
    conn = connect(db_path)
    init_db(conn)
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
    conn.close()

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
    init_db(conn)
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
        return {"file_name": file_name, "deleted_bills": len(rows)}
    finally:
        conn.close()


def update_bill_status(db_path: str | Path, bill_id: str, status: str, paid_amount: object = None) -> sqlite3.Row | None:
    if status not in {"paid", "partial", "unpaid"}:
        raise ValueError("Status hanya boleh paid, partial, atau unpaid.")

    conn = connect(db_path)
    init_db(conn)
    with conn:
        row = conn.execute(
            f"{joined_bill_select()} where b.id = ? and b.deleted_at is null and s.deleted_at is null",
            (bill_id,),
        ).fetchone()
        if not row:
            updated = None
        else:
            amount = int(row["amount"])
            if status == "paid":
                new_paid = amount
            elif status == "unpaid":
                new_paid = 0
            else:
                if paid_amount is not None and str(paid_amount).strip():
                    new_paid = validate_paid_amount(paid_amount, amount, "partial")
                else:
                    curr_paid = int(row["paid_amount"] or 0)
                    if curr_paid <= 0 or curr_paid >= amount:
                        new_paid = amount // 2
                    else:
                        new_paid = curr_paid

            conn.execute(
                "update bills set status = ?, paid_amount = ?, updated_at = datetime('now') where id = ?",
                (status, new_paid, bill_id),
            )
            updated = conn.execute(
                f"{joined_bill_select()} where b.id = ? and b.deleted_at is null and s.deleted_at is null",
                (bill_id,),
            ).fetchone()
    conn.close()
    return updated


def update_bill_due_date(db_path: str | Path, bill_ids: list[str], due_date: str | None) -> list[sqlite3.Row]:
    if not bill_ids:
        return []
    due_date_str = str(due_date or "").strip()
    if due_date_str:
        parts = due_date_str.split("-")
        if len(parts) != 3 or not all(p.isdigit() for p in parts):
            raise ValueError("Format tanggal harus YYYY-MM-DD.")

    conn = connect(db_path)
    init_db(conn)
    with conn:
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
    conn.close()
    return list(updated)


def write_lookup_log(nim: str, name: str, result_type: str) -> None:
    conn = connect(config.DB_PATH)
    with conn:
        conn.execute(
            """
            insert into lookup_logs (id, nim_hash, name_hash, result_type)
            values (?, ?, ?, ?)
            """,
            (str(uuid.uuid4()), digest(nim), digest(name), result_type),
        )
    conn.close()


def write_audit(
    conn: sqlite3.Connection,
    actor_id: str | None,
    action: str,
    entity_type: str,
    entity_id: str | None,
    metadata: dict[str, object] | None = None,
) -> None:
    conn.execute(
        """
        insert into audit_logs (id, actor_id, action, entity_type, entity_id, metadata)
        values (?, ?, ?, ?, ?, ?)
        """,
        (str(uuid.uuid4()), actor_id, action, entity_type, entity_id, json.dumps(metadata or {}, ensure_ascii=False)),
    )


def store_import_preview(token: str, admin_id: str, file_name: str, stored_path: str | Path) -> None:
    conn = connect(config.DB_PATH)
    with conn:
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
    conn.close()


def get_import_preview_for_admin(token: str, admin: sqlite3.Row) -> sqlite3.Row | None:
    conn = connect(config.DB_PATH)
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
    conn.close()
    return row


def delete_import_preview(token: str) -> None:
    conn = connect(config.DB_PATH)
    with conn:
        conn.execute("delete from import_previews where token = ?", (token,))
    conn.close()


def authenticate_admin(email: str, password: str) -> sqlite3.Row | None:
    conn = connect(config.DB_PATH)
    admin = conn.execute(
        """
        select id, email, password_hash, full_name, role, is_active
        from admin_users
        where email = ?
        """,
        (email,),
    ).fetchone()
    conn.close()
    if not admin or not admin["is_active"] or not verify_password(password, admin["password_hash"]):
        return None
    return admin


def create_admin_session(admin: sqlite3.Row) -> str:
    token = secrets.token_urlsafe(32)
    session_id = str(uuid.uuid4())
    conn = connect(config.DB_PATH)
    with conn:
        conn.execute(
            """
            insert into admin_sessions (id, admin_id, token_hash, expires_at)
            values (?, ?, ?, datetime('now', ?))
            """,
            (session_id, admin["id"], token_hash(token), f"+{config.SESSION_TTL_HOURS} hours"),
        )
        write_audit(conn, admin["id"], "admin.login", "admin_session", session_id, {"email": admin["email"]})
    conn.close()
    return token


def delete_admin_session(token: str | None, admin: sqlite3.Row | None) -> None:
    conn = connect(config.DB_PATH)
    with conn:
        if token:
            conn.execute("delete from admin_sessions where token_hash = ?", (token_hash(token),))
        if admin:
            write_audit(conn, admin["id"], "admin.logout", "admin_session", None, {"email": admin["email"]})
    conn.close()


def find_admin_by_session(token: str | None) -> sqlite3.Row | None:
    if not token:
        return None
    conn = connect(config.DB_PATH)
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
    conn.close()
    return admin


# ==========================================
# MASTER DATA: STUDY PROGRAMS
# ==========================================

def list_study_programs(db_path: str | Path = config.DB_PATH) -> list[dict[str, object]]:
    conn = connect(db_path)
    init_db(conn)
    rows = conn.execute(
        """
        select sp.id, sp.code, sp.name, sp.degree, sp.faculty, sp.is_active, sp.created_at, sp.updated_at,
               count(distinct s.id) as student_count
        from study_programs sp
        left join students s on (
            s.study_program_id = sp.id
            or lower(trim(coalesce(s.program_study, ''))) = lower(trim(sp.name))
            or lower(trim(coalesce(s.program_study, ''))) like '%' || lower(trim(sp.name)) || '%'
            or lower(trim(sp.name)) like '%' || lower(trim(coalesce(s.program_study, ''))) || '%'
        ) and s.deleted_at is null
        group by sp.id, sp.code, sp.name, sp.degree, sp.faculty, sp.is_active, sp.created_at, sp.updated_at
        order by sp.name asc
        """
    ).fetchall()
    conn.close()
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


def create_study_program(db_path: str | Path, payload: dict[str, object]) -> dict[str, object]:
    code = normalize_text(payload.get("code")).upper()
    name = normalize_text(payload.get("name"))
    degree = normalize_text(payload.get("degree")) or "S1"
    faculty = normalize_text(payload.get("faculty")) or None
    is_active = 1 if payload.get("is_active", 1) else 0

    if not code:
        raise ValueError("Kode program studi wajib diisi.")
    if len(code) != 4 or not code.isalnum():
        raise ValueError("Kode program studi harus terdiri dari 4 karakter alfanumerik huruf kapital (contoh: HKUM, MANJ, SIFO).")
    if not name:
        raise ValueError("Nama program studi wajib diisi.")

    conn = connect(db_path)
    init_db(conn)
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
            return dict(row)
    finally:
        conn.close()


def update_study_program(db_path: str | Path, program_id: str, payload: dict[str, object]) -> dict[str, object] | None:
    code = normalize_text(payload.get("code")).upper() if payload.get("code") is not None else None
    name = normalize_text(payload.get("name")) if payload.get("name") is not None else None
    degree = normalize_text(payload.get("degree")) if payload.get("degree") is not None else None
    faculty = normalize_text(payload.get("faculty")) if payload.get("faculty") is not None else None
    is_active = (1 if payload.get("is_active") else 0) if payload.get("is_active") is not None else None

    conn = connect(db_path)
    init_db(conn)
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
                raise ValueError("Kode program studi harus terdiri dari 4 karakter alfanumerik huruf kapital (contoh: HKUM, MANJ, SIFO).")
            if not new_name:
                raise ValueError("Nama program studi tidak boleh kosong.")

            duplicate = conn.execute("select id from study_programs where upper(code) = ? and id <> ?", (new_code, program_id)).fetchone()
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
            return dict(row)
    finally:
        conn.close()


def delete_study_program(db_path: str | Path, program_id: str) -> bool:
    conn = connect(db_path)
    init_db(conn)
    try:
        with conn:
            current = conn.execute("select id from study_programs where id = ?", (program_id,)).fetchone()
            if not current:
                return False
            conn.execute("delete from study_programs where id = ?", (program_id,))
            return True
    finally:
        conn.close()


# ==========================================
# MASTER DATA: ACADEMIC PERIODS
# ==========================================

def list_academic_periods(db_path: str | Path = config.DB_PATH) -> list[dict[str, object]]:
    conn = connect(db_path)
    init_db(conn)
    rows = conn.execute(
        """
        select id, code, name, semester_type, is_active, default_due_date, created_at, updated_at
        from academic_periods
        order by code desc
        """
    ).fetchall()
    conn.close()
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


def create_academic_period(db_path: str | Path, payload: dict[str, object]) -> dict[str, object]:
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
    init_db(conn)
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
            return dict(row)
    finally:
        conn.close()


def update_academic_period(db_path: str | Path, period_id: str, payload: dict[str, object]) -> dict[str, object] | None:
    code = normalize_text(payload.get("code")) if payload.get("code") is not None else None
    name = normalize_text(payload.get("name")) if payload.get("name") is not None else None
    semester_type = normalize_text(payload.get("semester_type")).lower() if payload.get("semester_type") is not None else None
    is_active = (1 if payload.get("is_active") else 0) if payload.get("is_active") is not None else None
    default_due_date = validate_due_date_value(payload.get("default_due_date")) if "default_due_date" in payload else None

    conn = connect(db_path)
    init_db(conn)
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

            duplicate = conn.execute("select id from academic_periods where code = ? and id <> ?", (new_code, period_id)).fetchone()
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
            return dict(row)
    finally:
        conn.close()


# ==========================================
# DASHBOARD STATS & FINANCIAL REPORTS
# ==========================================

def get_dashboard_stats(db_path: str | Path = config.DB_PATH) -> dict[str, object]:
    conn = connect(db_path)
    init_db(conn)

    # Students count
    s_row = conn.execute(
        """
        select
          count(*) as total_students,
          sum(case when academic_status = 'aktif' then 1 else 0 end) as active_students
        from students
        where deleted_at is null
        """
    ).fetchone()

    # Bills count & sums
    b_row = conn.execute(
        """
        select
          count(*) as total_bills,
          sum(case when b.status = 'paid' then 1 else 0 end) as paid_bills,
          sum(case when b.status = 'partial' then 1 else 0 end) as partial_bills,
          sum(case when b.status = 'unpaid' then 1 else 0 end) as unpaid_bills,
          coalesce(sum(b.amount), 0) as total_billed_amount,
          coalesce(sum(case when b.status = 'paid' then b.amount when b.status = 'partial' then coalesce(b.paid_amount, 0) else 0 end), 0) as total_paid_amount
        from bills b
        join students s on s.id = b.student_id
        where b.deleted_at is null and s.deleted_at is null
        """
    ).fetchone()

    conn.close()

    total_students = int(s_row["total_students"] or 0) if s_row else 0
    active_students = int(s_row["active_students"] or 0) if s_row else 0

    total_bills = int(b_row["total_bills"] or 0) if b_row else 0
    paid_bills = int(b_row["paid_bills"] or 0) if b_row else 0
    partial_bills = int(b_row["partial_bills"] or 0) if b_row else 0
    unpaid_bills = int(b_row["unpaid_bills"] or 0) if b_row else 0

    total_billed = int(b_row["total_billed_amount"] or 0) if b_row else 0
    total_paid = int(b_row["total_paid_amount"] or 0) if b_row else 0
    total_outstanding = max(0, total_billed - total_paid)

    payment_rate = round((total_paid / total_billed * 100), 2) if total_billed > 0 else 0.0

    return {
        "total_students": total_students,
        "active_students": active_students,
        "total_bills": total_bills,
        "paid_bills": paid_bills,
        "partial_bills": partial_bills,
        "unpaid_bills": unpaid_bills,
        "total_billed_amount": total_billed,
        "total_billed_amount_formatted": rupiah(total_billed),
        "total_paid_amount": total_paid,
        "total_paid_amount_formatted": rupiah(total_paid),
        "total_outstanding_amount": total_outstanding,
        "total_outstanding_amount_formatted": rupiah(total_outstanding),
        "payment_rate_percentage": payment_rate,
    }


def get_financial_summary(db_path: str | Path = config.DB_PATH) -> dict[str, object]:
    conn = connect(db_path)
    init_db(conn)

    rows = conn.execute(
        """
        select
          coalesce(sp.name, s.program_study, 'Lainnya') as program_study,
          count(distinct s.id) as total_students,
          count(b.id) as total_bills,
          coalesce(sum(b.amount), 0) as billed_amount,
          coalesce(sum(case when b.status = 'paid' then b.amount when b.status = 'partial' then coalesce(b.paid_amount, 0) else 0 end), 0) as paid_amount
        from students s
        left join study_programs sp on sp.id = s.study_program_id
        left join bills b on b.student_id = s.id and b.deleted_at is null
        where s.deleted_at is null
        group by coalesce(sp.name, s.program_study, 'Lainnya')
        order by billed_amount desc
        """
    ).fetchall()

    conn.close()

    by_study_program: list[dict[str, object]] = []
    total_billed = 0
    total_paid = 0

    for r in rows:
        billed = int(r["billed_amount"] or 0)
        paid = int(r["paid_amount"] or 0)
        outstanding = max(0, billed - paid)
        rate = round((paid / billed * 100), 2) if billed > 0 else 0.0

        total_billed += billed
        total_paid += paid

        by_study_program.append({
            "program_study": r["program_study"],
            "total_students": int(r["total_students"] or 0),
            "total_bills": int(r["total_bills"] or 0),
            "billed_amount": billed,
            "billed_amount_formatted": rupiah(billed),
            "paid_amount": paid,
            "paid_amount_formatted": rupiah(paid),
            "outstanding_amount": outstanding,
            "outstanding_amount_formatted": rupiah(outstanding),
            "percentage_paid": rate,
        })

    total_outstanding = max(0, total_billed - total_paid)
    overall_rate = round((total_paid / total_billed * 100), 2) if total_billed > 0 else 0.0

    return {
        "by_study_program": by_study_program,
        "totals": {
            "billed_amount": total_billed,
            "billed_amount_formatted": rupiah(total_billed),
            "paid_amount": total_paid,
            "paid_amount_formatted": rupiah(total_paid),
            "outstanding_amount": total_outstanding,
            "outstanding_amount_formatted": rupiah(total_outstanding),
            "percentage_paid": overall_rate,
        },
    }

