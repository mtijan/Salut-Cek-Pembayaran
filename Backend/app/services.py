from __future__ import annotations

import json
import secrets
import sqlite3
import time
import uuid
from pathlib import Path

from Backend.app import config
from Backend.app.security import digest, hash_password, token_hash, verify_password
from Backend.db import connect, init_db
from Backend.excel_reader import normalize_name, normalize_nim, normalize_text


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
    due_date = row["due_date"] if "due_date" in row.keys() and row["due_date"] else ""
    return {
        "id": row["id"],
        "nim": row["nim"],
        "full_name": row["full_name"],
        "period": row["period"],
        "bill_type": row["bill_type"],
        "status": row["status"],
        "amount": row["amount"],
        "amount_formatted": rupiah(int(row["amount"])),
        "payment_method": row["payment_method"],
        "briva": row["briva"],
        "due_date": due_date,
        "due_date_formatted": format_due_date(due_date),
        "source_file": row["source_file"],
        "source_row_number": row["source_row_number"],
    }


def student_row_to_dict(row: sqlite3.Row) -> dict[str, object]:
    return {
        "id": row["id"],
        "nim": row["nim"],
        "full_name": row["full_name"],
        "bill_count": row["bill_count"] if "bill_count" in row.keys() else 0,
        "total_amount": row["total_amount"] if "total_amount" in row.keys() and row["total_amount"] is not None else 0,
        "total_amount_formatted": rupiah(int(row["total_amount"] or 0)) if "total_amount" in row.keys() else rupiah(0),
    }


def joined_bill_select() -> str:
    return """
        select b.id, b.briva, b.amount, b.period, b.bill_type, b.status, b.payment_method, b.due_date,
               b.source_file, b.source_row_number, s.nim, s.full_name
        from bills b
        join students s on s.id = b.student_id
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


def normalize_status_value(status: object) -> str:
    value = str(status or "unpaid").strip().lower()
    if value not in {"paid", "unpaid"}:
        raise ValueError("Status hanya boleh paid atau unpaid.")
    return value


def ensure_student(conn: sqlite3.Connection, nim: object, full_name: object) -> sqlite3.Row:
    normalized_nim = normalize_nim(nim)
    normalized_name = normalize_text(full_name)
    if not normalized_nim:
        raise ValueError("NIM wajib diisi.")
    if not normalized_name:
        raise ValueError("Nama mahasiswa wajib diisi.")

    row = conn.execute("select id, nim, full_name from students where nim = ?", (normalized_nim,)).fetchone()
    if row:
        if row["full_name"] != normalized_name:
            conn.execute(
                "update students set full_name = ?, name_norm = ?, updated_at = datetime('now') where id = ?",
                (normalized_name, normalize_name(normalized_name), row["id"]),
            )
            row = conn.execute("select id, nim, full_name from students where id = ?", (row["id"],)).fetchone()
        return row

    student_id = str(uuid.uuid4())
    conn.execute(
        """
        insert into students (id, nim, full_name, name_norm)
        values (?, ?, ?, ?)
        """,
        (student_id, normalized_nim, normalized_name, normalize_name(normalized_name)),
    )
    return conn.execute("select id, nim, full_name from students where id = ?", (student_id,)).fetchone()


def list_students(db_path: str | Path = config.DB_PATH, query: str = "", limit: int = 2000) -> list[dict[str, object]]:
    search = normalize_text(query)
    limit = max(1, min(int(limit or 2000), 5000))
    conn = connect(db_path)
    init_db(conn)
    params: list[object] = []
    where = ""
    if search:
        where = "where s.nim like ? or s.full_name like ?"
        params.extend([f"%{search}%", f"%{search}%"])
    rows = conn.execute(
        f"""
        select s.id, s.nim, s.full_name, count(b.id) as bill_count, coalesce(sum(b.amount), 0) as total_amount
        from students s
        left join bills b on b.student_id = s.id
        {where}
        group by s.id, s.nim, s.full_name
        order by s.nim asc
        limit ?
        """,
        (*params, limit),
    ).fetchall()
    conn.close()
    return [student_row_to_dict(row) for row in rows]


def create_student(db_path: str | Path, nim: object, full_name: object) -> sqlite3.Row:
    conn = connect(db_path)
    init_db(conn)
    try:
        with conn:
            student = ensure_student(conn, nim, full_name)
    finally:
        conn.close()
    return student


def update_student(db_path: str | Path, student_id: str, payload: dict[str, object]) -> sqlite3.Row | None:
    normalized_nim = normalize_nim(payload.get("nim"))
    normalized_name = normalize_text(payload.get("full_name"))
    if not normalized_nim:
        raise ValueError("NIM wajib diisi.")
    if not normalized_name:
        raise ValueError("Nama mahasiswa wajib diisi.")

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
                set nim = ?, full_name = ?, name_norm = ?, updated_at = datetime('now')
                where id = ?
                """,
                (normalized_nim, normalized_name, normalize_name(normalized_name), student_id),
            )
            return conn.execute("select id, nim, full_name from students where id = ?", (student_id,)).fetchone()
    finally:
        conn.close()


def delete_student(db_path: str | Path, student_id: str) -> sqlite3.Row | None:
    conn = connect(db_path)
    init_db(conn)
    try:
        with conn:
            row = conn.execute("select id, nim, full_name from students where id = ?", (student_id,)).fetchone()
            if row:
                conn.execute("delete from students where id = ?", (student_id,))
        return row
    finally:
        conn.close()


def list_bills(db_path: str | Path = config.DB_PATH, query: str = "", limit: int = 2000) -> list[dict[str, object]]:
    search = normalize_text(query)
    limit = max(1, min(int(limit or 2000), 5000))
    conn = connect(db_path)
    init_db(conn)
    params: list[object] = []
    where = ""
    if search:
        where = "where s.nim like ? or s.full_name like ? or b.briva like ? or b.period like ? or b.bill_type like ?"
        params.extend([f"%{search}%", f"%{search}%", f"%{search}%", f"%{search}%", f"%{search}%"])
    rows = conn.execute(
        f"""
        {joined_bill_select()}
        {where}
        order by b.updated_at desc, b.created_at desc
        limit ?
        """,
        (*params, limit),
    ).fetchall()
    conn.close()
    return [bill_row_to_dict(row) for row in rows]


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
    period = normalize_text(payload.get("period"))
    bill_type = normalize_text(payload.get("bill_type")) or "UKT BRIVA"
    payment_method = normalize_text(payload.get("payment_method")) or "BRIVA"
    if not briva:
        raise ValueError("Nomor BRIVA wajib diisi.")
    if not period:
        raise ValueError("Periode pembayaran wajib diisi.")
    amount = validate_amount(payload.get("amount"))
    status = normalize_status_value(payload.get("status"))
    due_date = validate_due_date_value(payload.get("due_date"))
    instructions = normalize_text(payload.get("instructions")) or "Bayar melalui BRIVA BRI dengan nomor BRIVA yang tampil."

    conn = connect(db_path)
    init_db(conn)
    try:
        with conn:
            student = ensure_student(conn, payload.get("nim"), payload.get("full_name"))
            bill_id = str(uuid.uuid4())
            conn.execute(
                """
                insert into bills
                  (id, student_id, briva, amount, period, bill_type, status, payment_method, instructions, due_date, source_file)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (bill_id, student["id"], briva, amount, period, bill_type, status, payment_method, instructions, due_date, "Manual Admin"),
            )
            return conn.execute(f"{joined_bill_select()} where b.id = ?", (bill_id,)).fetchone()
    finally:
        conn.close()


def update_bill(db_path: str | Path, bill_id: str, payload: dict[str, object]) -> sqlite3.Row | None:
    briva = normalize_text(payload.get("briva"))
    period = normalize_text(payload.get("period"))
    bill_type = normalize_text(payload.get("bill_type")) or "UKT BRIVA"
    payment_method = normalize_text(payload.get("payment_method")) or "BRIVA"
    if not briva:
        raise ValueError("Nomor BRIVA wajib diisi.")
    if not period:
        raise ValueError("Periode pembayaran wajib diisi.")
    amount = validate_amount(payload.get("amount"))
    status = normalize_status_value(payload.get("status"))
    due_date = validate_due_date_value(payload.get("due_date"))
    instructions = normalize_text(payload.get("instructions")) or "Bayar melalui BRIVA BRI dengan nomor BRIVA yang tampil."

    conn = connect(db_path)
    init_db(conn)
    try:
        with conn:
            current = conn.execute("select id from bills where id = ?", (bill_id,)).fetchone()
            if not current:
                return None
            student = ensure_student(conn, payload.get("nim"), payload.get("full_name"))
            conn.execute(
                """
                update bills
                set student_id = ?, briva = ?, amount = ?, period = ?, bill_type = ?, status = ?,
                    payment_method = ?, instructions = ?, due_date = ?, updated_at = datetime('now')
                where id = ?
                """,
                (student["id"], briva, amount, period, bill_type, status, payment_method, instructions, due_date, bill_id),
            )
            return conn.execute(f"{joined_bill_select()} where b.id = ?", (bill_id,)).fetchone()
    finally:
        conn.close()


def delete_bill(db_path: str | Path, bill_id: str) -> sqlite3.Row | None:
    conn = connect(db_path)
    init_db(conn)
    try:
        with conn:
            row = conn.execute(f"{joined_bill_select()} where b.id = ?", (bill_id,)).fetchone()
            if row:
                conn.execute("delete from bills where id = ?", (bill_id,))
        return row
    finally:
        conn.close()


def list_imported_bill_groups(db_path: str | Path = config.DB_PATH) -> list[dict[str, object]]:
    conn = connect(db_path)
    init_db(conn)
    rows = conn.execute(
        """
        select b.id, b.briva, b.amount, b.period, b.bill_type, b.status, b.payment_method, b.due_date,
               b.source_file, b.source_row_number, s.nim, s.full_name
        from bills b
        join students s on s.id = b.student_id
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
            group = {"file_name": source_file, "total": 0, "paid": 0, "unpaid": 0, "bills": []}
            by_file[source_file] = group
            groups.append(group)
        bills = group["bills"]
        assert isinstance(bills, list)
        bills.append(bill_row_to_dict(row))
        group["total"] = int(group["total"]) + 1
        if row["status"] == "paid":
            group["paid"] = int(group["paid"]) + 1
        else:
            group["unpaid"] = int(group["unpaid"]) + 1
    return groups


def update_bill_status(db_path: str | Path, bill_id: str, status: str) -> sqlite3.Row | None:
    if status not in {"paid", "unpaid"}:
        raise ValueError("Status hanya boleh paid atau unpaid.")

    conn = connect(db_path)
    init_db(conn)
    with conn:
        row = conn.execute(
            """
            select b.id, b.briva, b.amount, b.period, b.bill_type, b.status, b.payment_method, b.due_date,
                   b.source_file, b.source_row_number, s.nim, s.full_name
            from bills b
            join students s on s.id = b.student_id
            where b.id = ?
            """,
            (bill_id,),
        ).fetchone()
        if not row:
            updated = None
        elif row["status"] != status:
            conn.execute("update bills set status = ?, updated_at = datetime('now') where id = ?", (status, bill_id))
            updated = conn.execute(
                """
                select b.id, b.briva, b.amount, b.period, b.bill_type, b.status, b.payment_method, b.due_date,
                       b.source_file, b.source_row_number, s.nim, s.full_name
                from bills b
                join students s on s.id = b.student_id
                where b.id = ?
                """,
                (bill_id,),
            ).fetchone()
        else:
            updated = row
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
            f"update bills set due_date = ?, updated_at = datetime('now') where id in ({placeholders})",
            (due_date_str or None, *bill_ids),
        )
        updated = conn.execute(
            f"""
            select b.id, b.briva, b.amount, b.period, b.bill_type, b.status, b.payment_method, b.due_date,
                   b.source_file, b.source_row_number, s.nim, s.full_name
            from bills b
            join students s on s.id = b.student_id
            where b.id in ({placeholders})
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
