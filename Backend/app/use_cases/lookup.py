from __future__ import annotations

import sqlite3
from pathlib import Path

from Backend.app.domain.billing import summarize_payment_status
from Backend.app.domain.common import format_due_date, rupiah
from Backend.app.repositories.bills import BillRepository
from Backend.app.repositories.students import StudentRepository
from Backend.db import database_connection


class LookupService:
    """Build the public billing view while keeping HTTP concerns in the route."""

    def __init__(
        self,
        db_path: str | Path,
        *,
        default_program_study: str,
        default_payment_period_label: str,
    ) -> None:
        self._db_path = db_path
        self._default_program_study = default_program_study
        self._default_payment_period_label = default_payment_period_label

    def execute(self, nim: str) -> dict[str, object] | None:
        with database_connection(self._db_path) as connection:
            student = StudentRepository(connection).find_active_for_public_lookup(nim)
            if student is None:
                return None
            bills = BillRepository(connection).list_active_for_public_lookup(str(student["id"]))

        return self._build_result(student, bills)

    def _build_result(self, student: sqlite3.Row, bills: list[sqlite3.Row]) -> dict[str, object]:
        unpaid_due_dates = [bill["due_date"] for bill in bills if bill["due_date"] and bill["status"] != "paid"]
        all_due_dates = [bill["due_date"] for bill in bills if bill["due_date"]]
        primary_due_date = unpaid_due_dates[0] if unpaid_due_dates else (all_due_dates[0] if all_due_dates else "")
        return {
            "student": {
                "nim": student["nim"],
                "full_name": student["full_name"],
                "program_study": student["program_study"] or self._default_program_study,
                "payment_period": self._default_payment_period_label or (bills[0]["period"] if bills else ""),
                "due_date": primary_due_date,
                "due_date_formatted": format_due_date(primary_due_date),
            },
            "bills": [self._bill_to_dict(bill, index, len(bills)) for index, bill in enumerate(bills, start=1)],
            "payment_status": summarize_payment_status([bill["status"] for bill in bills]),
        }

    @staticmethod
    def _bill_to_dict(bill: sqlite3.Row, index: int, total_bills: int) -> dict[str, object]:
        amount = int(bill["amount"])
        status = str(bill["status"])
        paid_amount = int(bill["paid_amount"] or 0) if status == "partial" else amount if status == "paid" else 0
        remaining_amount = max(0, amount - paid_amount)
        due_date = str(bill["due_date"] or "")
        return {
            "bill_label": f"Tagihan {index}" if total_bills > 1 else bill["bill_type"],
            "period": bill["period"],
            "bill_type": bill["bill_type"],
            "status": status,
            "amount": amount,
            "amount_formatted": rupiah(amount),
            "paid_amount": paid_amount,
            "paid_amount_formatted": rupiah(paid_amount),
            "remaining_amount": remaining_amount,
            "remaining_amount_formatted": rupiah(remaining_amount),
            "payment_method": bill["payment_method"],
            "briva": bill["briva"],
            "instructions": bill["instructions"],
            "due_date": due_date,
            "due_date_formatted": format_due_date(due_date),
        }
