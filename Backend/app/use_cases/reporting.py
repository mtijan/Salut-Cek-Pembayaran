from __future__ import annotations

import sqlite3
from pathlib import Path

from Backend.app.domain.common import rupiah
from Backend.app.repositories.reporting import ReportingRepository
from Backend.db import database_connection
from Backend.excel_reader import normalize_text


class ReportingService:
    """Build dashboard and financial report responses outside the HTTP layer."""

    def __init__(self, db_path: str | Path) -> None:
        self._db_path = db_path

    def dashboard_stats(self) -> dict[str, object]:
        with database_connection(self._db_path) as connection:
            student_row, bill_row = ReportingRepository(connection).dashboard_counts()

        total_students = self._row_int(student_row, "total_students")
        active_students = self._row_int(student_row, "active_students")
        total_bills = self._row_int(bill_row, "total_bills")
        paid_bills = self._row_int(bill_row, "paid_bills")
        partial_bills = self._row_int(bill_row, "partial_bills")
        unpaid_bills = self._row_int(bill_row, "unpaid_bills")
        total_billed = self._row_int(bill_row, "total_billed_amount")
        total_paid = self._row_int(bill_row, "total_paid_amount")
        total_outstanding = max(0, total_billed - total_paid)
        payment_rate = round((total_paid / total_billed * 100), 2) if total_billed > 0 else 0.0

        return {
            "total_students": total_students,
            "active_students": active_students,
            "total_bills": total_bills,
            "paid_bills": paid_bills,
            "partial_bills": partial_bills,
            "unpaid_bills": unpaid_bills,
            "total_billed_amount": total_billed,
            "total_billed_amount_formatted": rupiah(total_billed),
            "total_paid_amount": total_paid,
            "total_paid_amount_formatted": rupiah(total_paid),
            "total_outstanding_amount": total_outstanding,
            "total_outstanding_amount_formatted": rupiah(total_outstanding),
            "payment_rate_percentage": payment_rate,
        }

    def financial_summary(
        self,
        *,
        period: str = "",
        study_program_id: str = "",
        entry_period: str = "",
    ) -> dict[str, object]:
        normalized_period = normalize_text(period)
        normalized_program = normalize_text(study_program_id)
        normalized_entry_period = normalize_text(entry_period)

        with database_connection(self._db_path) as connection:
            program_rows, student_rows = ReportingRepository(connection).financial_rows(
                period=normalized_period,
                study_program_id=normalized_program,
                entry_period=normalized_entry_period,
            )

        by_study_program = [self._program_summary(row) for row in program_rows]
        by_student = [self._student_summary(row) for row in student_rows]
        total_billed = sum(int(row["billed_amount"] or 0) for row in student_rows)
        total_paid = sum(int(row["paid_amount"] or 0) for row in student_rows)
        total_bills = sum(int(row["total_bills"] or 0) for row in student_rows)
        total_outstanding = max(0, total_billed - total_paid)
        overall_rate = round((total_paid / total_billed * 100), 2) if total_billed > 0 else 0.0

        return {
            "period": normalized_period or None,
            "study_program_id": normalized_program or None,
            "entry_period": normalized_entry_period or None,
            "by_study_program": by_study_program,
            "by_student": by_student,
            "totals": {
                "total_students": len(by_student),
                "total_bills": total_bills,
                "billed_amount": total_billed,
                "billed_amount_formatted": rupiah(total_billed),
                "paid_amount": total_paid,
                "paid_amount_formatted": rupiah(total_paid),
                "outstanding_amount": total_outstanding,
                "outstanding_amount_formatted": rupiah(total_outstanding),
                "percentage_paid": overall_rate,
            },
        }

    @staticmethod
    def _row_int(row: sqlite3.Row | None, key: str) -> int:
        return int(row[key] or 0) if row is not None else 0

    @staticmethod
    def _program_summary(row: sqlite3.Row) -> dict[str, object]:
        billed = int(row["billed_amount"] or 0)
        paid = int(row["paid_amount"] or 0)
        outstanding = max(0, billed - paid)
        rate = round((paid / billed * 100), 2) if billed > 0 else 0.0
        return {
            "program_study": row["program_study"],
            "total_students": int(row["total_students"] or 0),
            "total_bills": int(row["total_bills"] or 0),
            "billed_amount": billed,
            "billed_amount_formatted": rupiah(billed),
            "paid_amount": paid,
            "paid_amount_formatted": rupiah(paid),
            "outstanding_amount": outstanding,
            "outstanding_amount_formatted": rupiah(outstanding),
            "percentage_paid": rate,
        }

    @staticmethod
    def _student_summary(row: sqlite3.Row) -> dict[str, object]:
        billed = int(row["billed_amount"] or 0)
        paid = int(row["paid_amount"] or 0)
        outstanding = max(0, billed - paid)
        rate = round((paid / billed * 100), 2) if billed > 0 else 0.0
        status_code = "paid" if billed > 0 and paid >= billed else "partial" if paid > 0 else "unpaid"
        status_label = "Lunas" if status_code == "paid" else "Sebagian" if status_code == "partial" else "Belum Bayar"
        return {
            "student_id": row["student_id"],
            "nim": row["nim"] or "-",
            "full_name": row["full_name"] or "-",
            "phone_number": row["phone_number"] or "-",
            "program_study": row["program_study"],
            "entry_period": row["entry_period"],
            "total_bills": int(row["total_bills"] or 0),
            "billed_amount": billed,
            "billed_amount_formatted": rupiah(billed),
            "paid_amount": paid,
            "paid_amount_formatted": rupiah(paid),
            "outstanding_amount": outstanding,
            "outstanding_amount_formatted": rupiah(outstanding),
            "percentage_paid": rate,
            "status": status_code,
            "status_label": status_label,
        }
