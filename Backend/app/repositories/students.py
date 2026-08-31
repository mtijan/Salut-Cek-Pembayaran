"""Student repository data access layer."""

from __future__ import annotations

import sqlite3


class StudentRepository:
    """Data access object for querying active student profiles."""

    def __init__(self, connection: sqlite3.Connection) -> None:
        self._connection = connection

    def find_active_for_public_lookup(self, nim: str) -> sqlite3.Row | None:
        """Find active student record by unique NIM for public lookup."""
        return self._connection.execute(
            """
            select id, nim, full_name, program_study
            from students
            where nim = ? and deleted_at is null
            """,
            (nim,),
        ).fetchone()
