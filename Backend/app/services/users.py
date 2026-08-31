"""Admin user management service layer with repository delegation.

This module provides business logic for administrator account CRUD operations,
password resets, role assignment, active state management, session invalidation,
audit logging, and safeguards protecting the last active super_admin.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any

from Backend.app import config
from Backend.app.repositories.users import UserRepository
from Backend.app.security import hash_password
from Backend.app.services.audit import write_audit
from Backend.db import database_connection, database_transaction

ALLOWED_ROLES: set[str] = {"viewer", "admin_akademik", "admin_keuangan", "admin", "super_admin"}


def count_active_super_admins(conn: sqlite3.Connection) -> int:
    """Count currently active super_admin accounts."""
    return UserRepository(conn).count_active_super_admins()


def revoke_admin_sessions(conn: sqlite3.Connection, admin_id: str) -> int:
    """Revoke and delete all active sessions for a specific admin user."""
    return UserRepository(conn).revoke_sessions(admin_id)


def admin_user_row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    """Convert an admin_users sqlite3.Row into a clean public dictionary representation."""
    return {
        "id": str(row["id"]),
        "email": str(row["email"]),
        "full_name": str(row["full_name"] or ""),
        "role": str(row["role"]),
        "is_active": bool(row["is_active"]),
        "permissions": sorted(config.ROLE_PERMISSIONS.get(str(row["role"]), set())),
        "created_at": str(row["created_at"]),
        "updated_at": str(row["updated_at"]),
    }


def list_admin_users(db_path: Path | str = config.DB_PATH) -> list[dict[str, Any]]:
    """Retrieve all administrator accounts ordered by creation date."""
    with database_connection(db_path) as conn:
        rows = UserRepository(conn).list_all()
    return [admin_user_row_to_dict(row) for row in rows]


def get_admin_user(db_path: Path | str, user_id: str) -> dict[str, Any] | None:
    """Retrieve a single administrator account by unique ID."""
    with database_connection(db_path) as conn:
        row = UserRepository(conn).find_by_id(user_id)
    return admin_user_row_to_dict(row) if row else None


def create_admin_user(
    db_path: Path | str,
    payload: dict[str, Any],
    actor_id: str,
) -> dict[str, Any]:
    """Create a new administrator account with validation and audit logging."""
    email = str(payload.get("email") or "").strip().casefold()
    password = str(payload.get("password") or "")
    full_name = str(payload.get("full_name") or "").strip()
    role = str(payload.get("role") or "admin").strip()
    is_active = 1 if payload.get("is_active", True) else 0

    if not email or "@" not in email:
        raise ValueError("Email admin wajib diisi dan memiliki format valid.")
    if not password or len(password) < 8:
        raise ValueError("Password admin wajib minimal 8 karakter.")
    if role not in ALLOWED_ROLES:
        raise ValueError(f"Role '{role}' tidak valid. Pilihan role: {', '.join(sorted(ALLOWED_ROLES))}")

    pw_hash = hash_password(password)

    with database_transaction(db_path) as conn:
        repo = UserRepository(conn)
        if repo.find_by_email(email):
            raise ValueError(f"Email '{email}' sudah terdaftar.")

        created_row = repo.create(
            email=email,
            password_hash=pw_hash,
            full_name=full_name,
            role=role,
            is_active=is_active,
        )
        write_audit(
            conn,
            actor_id,
            "user.create",
            "admin_user",
            str(created_row["id"]),
            {"email": email, "full_name": full_name, "role": role, "is_active": bool(is_active)},
        )

    return admin_user_row_to_dict(created_row)


def update_admin_user(
    db_path: Path | str,
    user_id: str,
    payload: dict[str, Any],
    actor_id: str,
) -> dict[str, Any]:
    """Update administrator profile, role, or active status with safety checks."""
    with database_transaction(db_path) as conn:
        repo = UserRepository(conn)
        current = repo.find_by_id(user_id)
        if not current:
            raise ValueError("Admin tidak ditemukan.")

        new_full_name = str(payload.get("full_name", current["full_name"])).strip()
        new_role = str(payload.get("role", current["role"])).strip()
        new_is_active = 1 if payload.get("is_active", bool(current["is_active"])) else 0
        new_password = payload.get("password")

        if new_role not in ALLOWED_ROLES:
            raise ValueError(f"Role '{new_role}' tidak valid. Pilihan role: {', '.join(sorted(ALLOWED_ROLES))}")

        # Protection: Cannot deactivate or demote the last active super_admin
        is_demoting_super_admin = current["role"] == "super_admin" and new_role != "super_admin"
        is_deactivating_super_admin = (
            current["role"] == "super_admin" and current["is_active"] == 1 and new_is_active == 0
        )

        if is_demoting_super_admin or is_deactivating_super_admin:
            if repo.count_active_super_admins() <= 1:
                raise ValueError("Tidak dapat mengubah role atau menonaktifkan super_admin aktif terakhir.")

        pw_hash = current["password_hash"]
        password_changed = False
        if new_password is not None and str(new_password).strip():
            pw_str = str(new_password).strip()
            if len(pw_str) < 8:
                raise ValueError("Password baru minimal 8 karakter.")
            pw_hash = hash_password(pw_str)
            password_changed = True

        updated_row = repo.update(
            user_id=user_id,
            full_name=new_full_name,
            role=new_role,
            is_active=new_is_active,
            password_hash=pw_hash,
        )
        assert updated_row is not None

        # Invalidate sessions if password changed or account was deactivated
        if password_changed or (current["is_active"] == 1 and new_is_active == 0):
            repo.revoke_sessions(user_id)

        audit_meta = {
            "email": current["email"],
            "role": new_role,
            "is_active": bool(new_is_active),
            "password_changed": password_changed,
        }
        write_audit(conn, actor_id, "user.update", "admin_user", user_id, audit_meta)

    return admin_user_row_to_dict(updated_row)


def delete_admin_user(
    db_path: Path | str,
    user_id: str,
    actor_id: str,
) -> bool:
    """Delete an administrator account with safeguards against deleting the last super_admin."""
    with database_transaction(db_path) as conn:
        repo = UserRepository(conn)
        current = repo.find_by_id(user_id)
        if not current:
            return False

        if current["role"] == "super_admin" and current["is_active"] == 1:
            if repo.count_active_super_admins() <= 1:
                raise ValueError("Tidak dapat menghapus super_admin aktif terakhir.")

        repo.revoke_sessions(user_id)
        deleted = repo.delete(user_id)
        if deleted:
            write_audit(
                conn,
                actor_id,
                "user.delete",
                "admin_user",
                user_id,
                {"email": current["email"], "role": current["role"]},
            )
    return deleted


def reset_admin_password(
    db_path: Path | str,
    user_id: str,
    new_password: str,
    actor_id: str,
) -> bool:
    """Reset an administrator's password, revoke active sessions, and record audit log."""
    pw_str = str(new_password or "").strip()
    if not pw_str or len(pw_str) < 8:
        raise ValueError("Password baru minimal 8 karakter.")

    pw_hash = hash_password(pw_str)
    with database_transaction(db_path) as conn:
        repo = UserRepository(conn)
        current = repo.find_by_id(user_id)
        if not current:
            return False

        repo.reset_password(user_id, pw_hash)
        repo.revoke_sessions(user_id)
        write_audit(
            conn,
            actor_id,
            "user.password_reset",
            "admin_user",
            user_id,
            {"email": current["email"]},
        )
    return True
