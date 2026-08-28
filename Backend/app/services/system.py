"""System / infrastructure slice – startup, cleanup, and database bootstrap."""

from __future__ import annotations

import time
import uuid

from Backend.app import config
from Backend.app.security import hash_password
from Backend.db import database_transaction, migrate_database


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
