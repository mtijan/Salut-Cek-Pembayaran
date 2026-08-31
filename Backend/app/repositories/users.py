"""User repository data access layer for administrator account management."""

from __future__ import annotations

import sqlite3
import uuid


class UserRepository:
    """Data access object for querying and mutating admin users and credentials."""

    def __init__(self, connection: sqlite3.Connection) -> None:
        self._connection = connection

    def list_all(self) -> list[sqlite3.Row]:
        """Retrieve all active administrator user records."""
        return self._connection.execute(
            """
            select id, email, full_name, role, is_active, created_at, updated_at
            from admin_users
            order by created_at asc
            """
        ).fetchall()

    def find_by_id(self, user_id: str) -> sqlite3.Row | None:
        """Find an administrator by UUID primary key."""
        return self._connection.execute(
            """
            select id, email, full_name, role, is_active, password_hash, created_at, updated_at
            from admin_users
            where id = ?
            """,
            (user_id,),
        ).fetchone()

    def find_by_email(self, email: str) -> sqlite3.Row | None:
        """Find an administrator by email address."""
        return self._connection.execute(
            """
            select id, email, full_name, role, is_active, password_hash, created_at, updated_at
            from admin_users
            where lower(email) = lower(?)
            """,
            (email,),
        ).fetchone()

    def count_active_super_admins(self) -> int:
        """Count currently active super_admin accounts."""
        row = self._connection.execute(
            "select count(*) as total from admin_users where role = 'super_admin' and is_active = 1"
        ).fetchone()
        return int(row["total"]) if row else 0

    def create(
        self,
        email: str,
        password_hash: str,
        full_name: str,
        role: str = "admin",
        is_active: int = 1,
    ) -> sqlite3.Row:
        """Create a new administrator account."""
        user_id = str(uuid.uuid4())
        self._connection.execute(
            """
            insert into admin_users (id, email, password_hash, full_name, role, is_active)
            values (?, ?, ?, ?, ?, ?)
            """,
            (user_id, email.strip().casefold(), password_hash, full_name.strip(), role, is_active),
        )
        row = self.find_by_id(user_id)
        assert row is not None
        return row

    def update(
        self,
        user_id: str,
        full_name: str,
        role: str,
        is_active: int,
        password_hash: str,
    ) -> sqlite3.Row | None:
        """Update administrator profile, role, active status, and password hash."""
        self._connection.execute(
            """
            update admin_users
            set full_name = ?, role = ?, is_active = ?, password_hash = ?, updated_at = datetime('now')
            where id = ?
            """,
            (full_name, role, is_active, password_hash, user_id),
        )
        return self.find_by_id(user_id)

    def reset_password(self, user_id: str, password_hash: str) -> sqlite3.Row | None:
        """Update user password hash and bump updated_at timestamp."""
        self._connection.execute(
            "update admin_users set password_hash = ?, updated_at = datetime('now') where id = ?",
            (password_hash, user_id),
        )
        return self.find_by_id(user_id)

    def delete(self, user_id: str) -> bool:
        """Delete an administrator account."""
        cursor = self._connection.execute("delete from admin_users where id = ?", (user_id,))
        return cursor.rowcount > 0

    def revoke_sessions(self, user_id: str) -> int:
        """Revoke and delete all active sessions for a specific admin user."""
        cursor = self._connection.execute("delete from admin_sessions where admin_id = ?", (user_id,))
        return cursor.rowcount
