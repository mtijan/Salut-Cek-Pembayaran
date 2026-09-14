"""Public student billing lookup use case."""

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
        """Execute student billing lookup by NIM, resolving student, bills, summary, and payment transactions."""
        with database_connection(self._db_path) as connection:
            student = StudentRepository(connection).find_active_for_public_lookup(nim)
            if student is None:
                return None
            bill_repository = BillRepository(connection)
            student_id = str(student["id"])
            bills = bill_repository.list_active_for_public_lookup(student_id)
            transactions = bill_repository.list_recent_transactions_for_public_lookup(student_id)

            active_period_name = ""
            period_name_map: dict[str, str] = {}
            try:
                period_rows = connection.execute(
                    "select code, name, is_active from academic_periods"
                ).fetchall()
                for pr in period_rows:
                    code_val = str(pr["code"] or "").strip()
                    name_val = str(pr["name"] or "").strip()
                    if code_val and name_val:
                        period_name_map[code_val.lower()] = name_val
                        period_name_map[name_val.lower()] = name_val
                    if int(pr["is_active"] or 0) == 1:
                        active_period_name = name_val or code_val
            except sqlite3.OperationalError:
                pass

        return self._build_result(student, bills, transactions, active_period_name, period_name_map)

    def _build_result(
        self,
        student: sqlite3.Row,
        bills: list[sqlite3.Row],
        transactions: list[sqlite3.Row] | None = None,
        active_period_name: str = "",
        period_name_map: dict[str, str] | None = None,
    ) -> dict[str, object]:
        txs = transactions or []
        unpaid_due_dates = [bill["due_date"] for bill in bills if bill["due_date"] and bill["status"] != "paid"]
        all_due_dates = [bill["due_date"] for bill in bills if bill["due_date"]]
        primary_due_date = unpaid_due_dates[0] if unpaid_due_dates else (all_due_dates[0] if all_due_dates else "")

        bill_dicts = [self._bill_to_dict(bill, index, len(bills)) for index, bill in enumerate(bills, start=1)]
        total_amount = sum(int(str(b["amount"])) for b in bill_dicts)
        total_paid_amount = sum(int(str(b["paid_amount"])) for b in bill_dicts)
        total_remaining_amount = sum(int(str(b["remaining_amount"])) for b in bill_dicts)

        pmap = period_name_map or {}
        payment_period = ""
        if bills and bills[0]["period"]:
            raw_period = str(bills[0]["period"]).strip()
            payment_period = pmap.get(raw_period.lower(), "")
            if not payment_period:
                if active_period_name and raw_period.lower() == active_period_name.lower():
                    payment_period = active_period_name
                elif self._default_payment_period_label:
                    payment_period = self._default_payment_period_label
                else:
                    payment_period = raw_period
        elif active_period_name:
            payment_period = active_period_name
        else:
            payment_period = self._default_payment_period_label or ""

        return {
            "student": {
                "nim": student["nim"],
                "full_name": student["full_name"],
                "program_study": student["program_study"] or self._default_program_study,
                "payment_period": payment_period,
                "due_date": primary_due_date,
                "due_date_formatted": format_due_date(primary_due_date),
            },
            "bills": bill_dicts,
            "payment_status": summarize_payment_status([bill["status"] for bill in bills]),
            "summary": {
                "total_amount": total_amount,
                "total_amount_formatted": rupiah(total_amount),
                "paid_amount": total_paid_amount,
                "paid_amount_formatted": rupiah(total_paid_amount),
                "remaining_amount": total_remaining_amount,
                "remaining_amount_formatted": rupiah(total_remaining_amount),
            },
            "payment_history": [self._transaction_to_dict(tx) for tx in txs],
        }

    @staticmethod
    def _transaction_to_dict(tx: sqlite3.Row) -> dict[str, object]:
        amount = int(tx["amount"])
        payment_date = str(tx["payment_date"] or "")
        return {
            "transaction_type": str(tx["transaction_type"] or "payment"),
            "amount": amount,
            "amount_formatted": rupiah(abs(amount)),
            "payment_date": payment_date,
            "payment_date_formatted": format_due_date(payment_date) if payment_date else "",
            "payment_method": str(tx["payment_method"] or "BRIVA"),
            "bill_type": str(tx["bill_type"] or ""),
            "briva": str(tx["briva"] or ""),
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
