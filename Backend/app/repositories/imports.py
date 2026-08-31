"""Persistence operations for the transactional Excel import use case."""

from __future__ import annotations

import sqlite3
import uuid
from typing import Any, cast


class ImportRepository:
    """Store import issues and create or update imported billing rows."""

    def __init__(self, connection: sqlite3.Connection) -> None:
        self._connection = connection

    def clear_issues(self, source_file: str) -> None:
        """Remove stale issue rows for an import source before replacing them."""
        self._connection.execute("delete from import_issues where source_file = ?", (source_file,))

    def store_issue(self, issue: dict[str, object], source_file: str) -> None:
        """Persist one invalid or skipped workbook row."""
        self._connection.execute(
            """
            insert into import_issues
              (id, sheet_name, row_number, nim, full_name, briva, amount, note, source_file)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                str(issue["sheet_name"]),
                int(cast(Any, issue["row_number"])),
                str(issue.get("nim") or ""),
                str(issue.get("full_name") or ""),
                str(issue.get("briva") or ""),
                str(issue.get("amount") or ""),
                str(issue["note"]),
                source_file,
            ),
        )

    def create_bill(
        self,
        *,
        student_id: str,
        briva: str,
        amount: int,
        period: str,
        bill_type: str,
        instructions: str,
        due_date: str | None,
        source_file: str,
        row_number: int,
    ) -> None:
        """Create a new unpaid billing row from one import action."""
        self._connection.execute(
            """
            insert into bills
              (id, student_id, briva, amount, period, bill_type, status, instructions,
               due_date, source_file, source_row_number, updated_at)
            values (?, ?, ?, ?, ?, ?, 'unpaid', ?, ?, ?, ?, datetime('now'))
            """,
            (
                str(uuid.uuid4()),
                student_id,
                briva,
                amount,
                period,
                bill_type,
                instructions,
                due_date,
                source_file,
                row_number,
            ),
        )

    def update_bill(
        self,
        bill_id: str,
        *,
        student_id: str,
        briva: str,
        amount: int,
        period: str,
        bill_type: str,
        due_date: str | None,
        source_file: str,
        row_number: int,
    ) -> None:
        """Apply an approved import update to an existing billing row."""
        self._connection.execute(
            """
            update bills
            set student_id = ?, briva = ?, amount = ?, period = ?, bill_type = ?,
                due_date = ?, source_file = ?, source_row_number = ?,
                updated_at = datetime('now')
            where id = ?
            """,
            (
                student_id,
                briva,
                amount,
                period,
                bill_type,
                due_date,
                source_file,
                row_number,
                bill_id,
            ),
        )
