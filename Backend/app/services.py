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
from Backend.import_excel import DEFAULT_WORKBOOK, import_workbook


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
    total = conn.execute("select count(*) as total from students").fetchone()["total"]
    conn.close()
    if total == 0 and DEFAULT_WORKBOOK.exists():
        import_workbook(DEFAULT_WORKBOOK, config.DB_PATH)


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

