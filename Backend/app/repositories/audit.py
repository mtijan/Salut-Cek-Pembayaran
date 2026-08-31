"""Read-only repository for administrative audit-log queries."""

from __future__ import annotations

import sqlite3


class AuditLogRepository:
    """Query immutable audit records without exposing mutation operations."""

    def __init__(self, connection: sqlite3.Connection) -> None:
        self._connection = connection

    @staticmethod
    def _filters(
        action: str = "",
        entity_type: str = "",
        actor_id: str = "",
    ) -> tuple[str, list[object]]:
        clauses: list[str] = []
        params: list[object] = []
        if action:
            clauses.append("al.action = ?")
            params.append(action)
        if entity_type:
            clauses.append("al.entity_type = ?")
            params.append(entity_type)
        if actor_id:
            clauses.append("al.actor_id = ?")
            params.append(actor_id)
        return (f"where {' and '.join(clauses)}" if clauses else "", params)

    def list_page(
        self,
        *,
        action: str = "",
        entity_type: str = "",
        actor_id: str = "",
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[sqlite3.Row], int]:
        """Return a newest-first filtered page and its total row count."""
        where, params = self._filters(action, entity_type, actor_id)
        count_row = self._connection.execute(
            f"select count(*) as total from audit_logs al {where}",
            params,
        ).fetchone()
        rows = self._connection.execute(
            f"""
            select al.id, al.actor_id, al.action, al.entity_type, al.entity_id,
                   al.metadata, al.created_at, au.full_name as actor_name,
                   au.role as actor_role
            from audit_logs al
            left join admin_users au on au.id = al.actor_id
            {where}
            order by al.created_at desc, al.rowid desc
            limit ? offset ?
            """,
            (*params, limit, offset),
        ).fetchall()
        return rows, int(count_row["total"]) if count_row else 0
