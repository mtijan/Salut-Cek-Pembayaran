from __future__ import annotations

import sqlite3


class BillRepository:
    """Read access to bills without owning the connection lifecycle."""

    def __init__(self, connection: sqlite3.Connection) -> None:
        self._connection = connection

    def list_active_for_public_lookup(self, student_id: str) -> list[sqlite3.Row]:
        return self._connection.execute(
            """
            select briva, amount, coalesce(paid_amount, 0) as paid_amount,
                   period, bill_type, status, payment_method, instructions, due_date
            from bills
            where student_id = ? and deleted_at is null
            order by period desc, created_at asc, briva asc
            """,
            (student_id,),
        ).fetchall()
