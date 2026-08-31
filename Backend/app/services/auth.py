"""Auth slice – admin authentication, session management, and import preview tokens."""

from __future__ import annotations

import secrets
import sqlite3
import uuid
from pathlib import Path

from Backend.app import config
from Backend.app.security import token_hash, verify_password
from Backend.db import database_connection, database_transaction

from Backend.app.services.audit import write_audit


def store_import_preview(token: str, admin_id: str, file_name: str, stored_path: str | Path) -> None:
    """Store temporary metadata for an uploaded Excel import preview."""
    with database_transaction(config.DB_PATH) as conn:
        conn.execute(
            """
            insert into import_previews (token, admin_id, file_name, stored_path, expires_at)
            values (?, ?, ?, ?, datetime('now', ?))
            on conflict(token) do update set
              admin_id = excluded.admin_id,
              file_name = excluded.file_name,
              stored_path = excluded.stored_path,
              expires_at = excluded.expires_at,
              claim_id = null,
              claimed_at = null
            """,
            (token, admin_id, file_name, str(stored_path), f"+{config.IMPORT_RETENTION_SECONDS} seconds"),
        )


def get_import_preview_for_admin(token: str, admin: sqlite3.Row) -> sqlite3.Row | None:
    """Retrieve an active import preview token belonging to the admin or super_admin."""
    with database_connection(config.DB_PATH) as conn:
        row = conn.execute(
            """
            select token, admin_id, file_name, stored_path, expires_at, claim_id, claimed_at
            from import_previews
            where token = ?
              and expires_at > datetime('now')
              and (? = 'super_admin' or admin_id = ?)
            """,
            (token, admin["role"], admin["id"]),
        ).fetchone()
    return row


def claim_import_preview_for_admin(token: str, admin: sqlite3.Row) -> sqlite3.Row | None:
    """Atomically claim one active preview for an authorized import request."""
    claim_id = uuid.uuid4().hex
    with database_transaction(config.DB_PATH) as conn:
        cursor = conn.execute(
            """
            update import_previews
            set claim_id = ?, claimed_at = datetime('now')
            where token = ?
              and expires_at > datetime('now')
              and claim_id is null
              and (? = 'super_admin' or admin_id = ?)
            """,
            (claim_id, token, admin["role"], admin["id"]),
        )
        if cursor.rowcount != 1:
            return None
        return conn.execute(
            """
            select token, admin_id, file_name, stored_path, expires_at, claim_id, claimed_at
            from import_previews
            where token = ? and claim_id = ?
            """,
            (token, claim_id),
        ).fetchone()


def release_import_preview_claim(token: str, claim_id: str) -> bool:
    """Release only the matching claim so a failed import can be retried safely."""
    with database_transaction(config.DB_PATH) as conn:
        cursor = conn.execute(
            """
            update import_previews
            set claim_id = null, claimed_at = null
            where token = ? and claim_id = ?
            """,
            (token, claim_id),
        )
    return cursor.rowcount == 1


def consume_import_preview_claim(token: str, claim_id: str) -> bool:
    """Delete only the matching claimed token after its import has committed."""
    with database_transaction(config.DB_PATH) as conn:
        cursor = conn.execute(
            "delete from import_previews where token = ? and claim_id = ?",
            (token, claim_id),
        )
    return cursor.rowcount == 1


def delete_import_preview(token: str) -> None:
    """Delete an import preview token after commit or expiration."""
    with database_transaction(config.DB_PATH) as conn:
        conn.execute("delete from import_previews where token = ?", (token,))


def authenticate_admin(email: str, password: str) -> sqlite3.Row | None:
    """Authenticate admin credentials using PBKDF2 password verification."""
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
    """Generate a secure session token for an authenticated administrator and log audit event."""
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
    """Revoke an active admin session token and record logout audit log."""
    with database_transaction(config.DB_PATH) as conn:
        if token:
            conn.execute("delete from admin_sessions where token_hash = ?", (token_hash(token),))
        if admin:
            write_audit(conn, admin["id"], "admin.logout", "admin_session", None, {"email": admin["email"]})


def find_admin_by_session(token: str | None) -> sqlite3.Row | None:
    """Lookup active administrator profile by session token hash."""
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
