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

    def admin_exists(self, admin_id: str) -> bool:
        """Return whether an audit actor can be linked to an import batch."""
        return self._connection.execute("select 1 from admin_users where id = ?", (admin_id,)).fetchone() is not None

    def create_batch(
        self,
        *,
        batch_id: str,
        import_token: str | None,
        admin_id: str | None,
        source_file: str,
        file_sha256: str,
        period_code: str,
        period_label: str,
        billing_year: int | None,
        semester_type: str | None,
        status: str,
        created: int,
        updated: int,
        unchanged: int,
        quarantined: int,
        warning_count: int,
        critical_count: int,
    ) -> None:
        """Persist one immutable import result summary, including issue-only batches."""
        self._connection.execute(
            """
            insert into import_batches (
              id, import_token, admin_id, source_file, file_sha256, period_code, period_label,
              billing_year, semester_type, status, created_count, updated_count, unchanged_count,
              quarantined_count, warning_count, critical_count
            ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                batch_id,
                import_token,
                admin_id,
                source_file,
                file_sha256,
                period_code,
                period_label,
                billing_year,
                semester_type,
                status,
                created,
                updated,
                unchanged,
                quarantined,
                warning_count,
                critical_count,
            ),
        )

    def store_issue(self, issue: dict[str, object], source_file: str, *, batch_id: str, period_code: str) -> None:
        """Persist one invalid or skipped workbook row."""
        self._connection.execute(
            """
            insert into import_issues
              (id, batch_id, sheet_name, row_number, severity, issue_code, nim, full_name,
               briva, amount, note, source_file, period_code, resolution_status)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')
            """,
            (
                str(uuid.uuid4()),
                batch_id,
                str(issue.get("sheet_name") or issue.get("sheet") or ""),
                int(cast(Any, issue["row_number"])),
                str(issue.get("severity") or "warning"),
                str(issue.get("issue_code") or "IMPORT_VALIDATION_ISSUE"),
                str(issue.get("nim") or ""),
                str(issue.get("full_name") or ""),
                str(issue.get("briva") or ""),
                str(issue.get("amount") or ""),
                str(issue.get("note") or issue.get("message") or "Data perlu diperbaiki."),
                source_file,
                period_code,
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
        import_batch_id: str | None = None,
    ) -> None:
        """Create a new unpaid billing row from one import action."""
        self._connection.execute(
            """
            insert into bills
              (id, student_id, briva, amount, period, bill_type, status, instructions,
               due_date, source_file, source_row_number, import_batch_id, updated_at)
            values (?, ?, ?, ?, ?, ?, 'unpaid', ?, ?, ?, ?, ?, datetime('now'))
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
                import_batch_id,
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
        import_batch_id: str | None = None,
    ) -> None:
        """Apply an approved import update to an existing billing row."""
        self._connection.execute(
            """
            update bills
            set student_id = ?, briva = ?, amount = ?, period = ?, bill_type = ?,
                due_date = ?, source_file = ?, source_row_number = ?, import_batch_id = ?,
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
                import_batch_id,
                bill_id,
            ),
        )
