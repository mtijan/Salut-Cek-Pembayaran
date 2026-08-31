"""System / infrastructure slice – startup, cleanup, and database bootstrap."""

from __future__ import annotations

import re
import sqlite3
import time
import uuid
from pathlib import Path

from Backend.app import config
from Backend.app.security import hash_password
from Backend.db import database_connection, database_transaction, migrate_database


GIT_RELEASE_ID_PATTERN = re.compile(r"^[0-9a-f]{7,40}$")


def _has_existing_admins(db_path: Path | str = config.DB_PATH) -> bool:
    try:
        with database_connection(db_path) as conn:
            row = conn.execute("select count(*) as total from admin_users where is_active = 1").fetchone()
            return bool(row and row["total"] > 0)
    except sqlite3.OperationalError:
        return False


def validate_runtime_configuration(has_existing_admins: bool | None = None) -> None:
    """Validate mandatory environment variables and security constraints in production mode."""
    if config.APP_ENV != "production":
        return
    if config.PROCESS_WORKERS != 1:
        raise RuntimeError(
            "Rate limiter bounded in-memory hanya aman untuk satu worker dan tidak mendukung scale-out. "
            "Gunakan WEB_CONCURRENCY=1/UVICORN_WORKERS=1 sampai shared store disetujui sebelum scale-out."
        )
    if config.RATE_LIMIT_MAX_BUCKETS < 1:
        raise RuntimeError("RATE_LIMIT_MAX_BUCKETS wajib lebih besar dari nol.")
    if not GIT_RELEASE_ID_PATTERN.fullmatch(config.RELEASE_ID):
        raise RuntimeError("RELEASE_ID production wajib berupa Git revision 7-40 karakter heksadesimal.")

    if has_existing_admins is None:
        has_existing_admins = _has_existing_admins(config.DB_PATH)

    lookup_secret = config.LOOKUP_HASH_SECRET.strip()
    bootstrap_email = config.ADMIN_BOOTSTRAP_EMAIL.strip()
    bootstrap_password = config.ADMIN_BOOTSTRAP_PASSWORD

    missing: list[str] = []
    if not lookup_secret:
        missing.append("LOOKUP_HASH_SECRET")

    if not has_existing_admins:
        if not bootstrap_email:
            missing.append("ADMIN_BOOTSTRAP_EMAIL")
        if not bootstrap_password:
            missing.append("ADMIN_BOOTSTRAP_PASSWORD")

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
    weak: list[str] = []
    if lookup_secret:
        if len(lookup_secret) < 32 or any(m in lookup_secret.casefold() for m in placeholder_markers):
            weak.append("LOOKUP_HASH_SECRET")

    if bootstrap_email:
        if "@" not in bootstrap_email or any(m in bootstrap_email.casefold() for m in placeholder_markers):
            weak.append("ADMIN_BOOTSTRAP_EMAIL")

    if bootstrap_password:
        if len(bootstrap_password) < 12 or any(m in bootstrap_password.casefold() for m in placeholder_markers):
            weak.append("ADMIN_BOOTSTRAP_PASSWORD")

    if weak:
        raise RuntimeError(
            "Konfigurasi production memakai nilai placeholder atau lemah: " + ", ".join(sorted(set(weak)))
        )


def cleanup_stale_imports() -> int:
    """Remove expired uploaded preview workbooks and delete expired preview tokens."""
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
    """Validate configuration, run database schema migrations, and bootstrap initial super_admin."""
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
