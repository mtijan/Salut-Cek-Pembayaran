"""Auth slice – admin authentication, session management, and import preview tokens."""

from __future__ import annotations

import secrets
import sqlite3
import uuid
from pathlib import Path
from typing import Any, cast

from Backend.app import config
from Backend.app.security import token_hash, verify_password
from Backend.db import database_connection, database_transaction

from Backend.app.services.audit import write_audit


def store_import_preview(
    token: str,
    admin_id: str,
    file_name: str,
    stored_path: str | Path,
    *,
    file_sha256: str | None = None,
    period_code: str | None = None,
    period_label: str | None = None,
    billing_year: int | None = None,
    semester_type: str | None = None,
    issues: list[dict[str, object]] | None = None,
) -> None:
    """Store temporary metadata for an uploaded Excel import preview."""
    with database_transaction(config.DB_PATH) as conn:
        conn.execute(
            """
            insert into import_previews (
              token, admin_id, file_name, stored_path, expires_at, file_sha256,
              period_code, period_label, billing_year, semester_type
            )
            values (?, ?, ?, ?, datetime('now', ?), ?, ?, ?, ?, ?)
            on conflict(token) do update set
              admin_id = excluded.admin_id,
              file_name = excluded.file_name,
              stored_path = excluded.stored_path,
              expires_at = excluded.expires_at,
              file_sha256 = excluded.file_sha256,
              period_code = excluded.period_code,
              period_label = excluded.period_label,
              billing_year = excluded.billing_year,
              semester_type = excluded.semester_type,
              claim_id = null,
              claimed_at = null
            """,
            (
                token,
                admin_id,
                file_name,
                str(stored_path),
                f"+{config.IMPORT_RETENTION_SECONDS} seconds",
                file_sha256,
                period_code,
                period_label,
                billing_year,
                semester_type,
            ),
        )
        conn.execute("delete from import_preview_issues where token = ?", (token,))
        for issue in issues or []:
            conn.execute(
                """
                insert into import_preview_issues (
                  id, token, sheet_name, row_number, severity, issue_code,
                  nim, full_name, briva, amount, note
                ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(uuid.uuid4()),
                    token,
                    str(issue.get("sheet_name") or issue.get("sheet") or ""),
                    int(cast(Any, issue.get("row_number") or 0)),
                    str(issue.get("severity") or "warning"),
                    str(issue.get("issue_code") or "IMPORT_VALIDATION_ISSUE"),
                    str(issue.get("nim") or ""),
                    str(issue.get("full_name") or ""),
                    str(issue.get("briva") or ""),
                    str(issue.get("amount") or ""),
                    str(issue.get("note") or issue.get("message") or "Data perlu diperbaiki."),
                ),
            )


def get_import_preview_for_admin(token: str, admin: sqlite3.Row) -> sqlite3.Row | None:
    """Retrieve an active import preview token belonging to the admin or super_admin."""
    with database_connection(config.DB_PATH) as conn:
        row = conn.execute(
            """
            select token, admin_id, file_name, stored_path, expires_at, file_sha256,
                   period_code, period_label, billing_year, semester_type, claim_id, claimed_at
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
            select token, admin_id, file_name, stored_path, expires_at, file_sha256,
                   period_code, period_label, billing_year, semester_type, claim_id, claimed_at
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


def list_import_preview_issues(
    token: str,
    admin: sqlite3.Row,
    *,
    severity: str = "",
    query: str = "",
    page: int = 1,
    limit: int = 50,
) -> tuple[list[dict[str, object]], int]:
    """List one authorized preview's structured issues with server-side pagination."""
    normalized_severity = severity.strip().casefold()
    if normalized_severity and normalized_severity not in {"warning", "critical"}:
        raise ValueError("Severity issue tidak valid.")
    page = max(1, int(page))
    limit = max(1, min(int(limit), 200))
    offset = (page - 1) * limit
    normalized_query = query.strip()
    clauses = [
        "p.token = ?",
        "p.expires_at > datetime('now')",
        "(? = 'super_admin' or p.admin_id = ?)",
    ]
    params: list[object] = [token, admin["role"], admin["id"]]
    if normalized_severity:
        clauses.append("i.severity = ?")
        params.append(normalized_severity)
    if normalized_query:
        clauses.append(
            "(i.nim like ? or i.full_name like ? or i.briva like ? or i.amount like ? or i.issue_code like ? or i.note like ?)"
        )
        like = f"%{normalized_query}%"
        params.extend([like, like, like, like, like, like])
    where = " and ".join(clauses)
    with database_connection(config.DB_PATH) as conn:
        total = int(
            conn.execute(
                f"select count(*) from import_preview_issues i join import_previews p on p.token = i.token where {where}",
                params,
            ).fetchone()[0]
        )
        rows = conn.execute(
            f"""
            select i.sheet_name, i.row_number, i.severity, i.issue_code, i.nim,
                   i.full_name, i.briva, i.amount, i.note as message
            from import_preview_issues i
            join import_previews p on p.token = i.token
            where {where}
            order by case i.severity when 'critical' then 0 else 1 end, i.row_number, i.id
            limit ? offset ?
            """,
            (*params, limit, offset),
        ).fetchall()
    return [dict(row) for row in rows], total


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
