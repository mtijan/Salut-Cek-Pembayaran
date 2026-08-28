from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from Backend.app.services import (
    create_bill,
    create_student,
    get_dashboard_stats,
    get_financial_summary,
)
from db import connect, init_db, migrate_database
from Backend.test_base import BackendBaseTestCase


class ReportingAndAnalyticsTests(BackendBaseTestCase):
    def test_dashboard_stats_and_financial_summary(self) -> None:
        from Backend.app.services import create_bill, create_student, get_dashboard_stats, get_financial_summary

        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            migrate_database(database)
            create_student(
                database,
                {"nim": "2001", "full_name": "Student A", "program_study": "S1 Ilmu Hukum", "academic_status": "aktif"},
            )
            create_student(
                database,
                {"nim": "2002", "full_name": "Student B", "program_study": "S1 Manajemen", "academic_status": "cuti"},
            )

            create_bill(
                database,
                {
                    "nim": "2001",
                    "full_name": "Student A",
                    "briva": "17810011",
                    "amount": 2000000,
                    "period": "2025.1",
                    "status": "paid",
                },
            )
            create_bill(
                database,
                {
                    "nim": "2002",
                    "full_name": "Student B",
                    "briva": "17810012",
                    "amount": 3000000,
                    "period": "2025.1",
                    "status": "unpaid",
                },
            )

            stats = get_dashboard_stats(database)
            self.assertEqual(stats["total_students"], 2)
            self.assertEqual(stats["active_students"], 1)
            self.assertEqual(stats["total_bills"], 2)
            self.assertEqual(stats["paid_bills"], 1)
            self.assertEqual(stats["unpaid_bills"], 1)
            self.assertEqual(stats["total_billed_amount"], 5000000)
            self.assertEqual(stats["total_paid_amount"], 2000000)
            self.assertEqual(stats["total_outstanding_amount"], 3000000)
            self.assertEqual(stats["payment_rate_percentage"], 40.0)

            fin = get_financial_summary(database)
            self.assertEqual(fin["totals"]["billed_amount"], 5000000)
            self.assertEqual(fin["totals"]["paid_amount"], 2000000)
            self.assertEqual(fin["totals"]["outstanding_amount"], 3000000)
            self.assertEqual(len(fin["by_study_program"]), 2)

    def test_financial_summary_applies_period_program_and_entry_filters_together(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            migrate_database(database)
            student_a = create_student(
                database,
                {"nim": "3001", "full_name": "Student A", "study_program_id": "sp_hkum", "entry_period": "2024.1"},
            )
            student_b = create_student(
                database,
                {"nim": "3002", "full_name": "Student B", "study_program_id": "sp_sifo", "entry_period": "2025.2"},
            )
            create_bill(
                database,
                {
                    "student_id": student_a["id"],
                    "briva": "3001001",
                    "amount": 1000000,
                    "period": "2025.1",
                    "status": "paid",
                },
            )
            create_bill(
                database,
                {
                    "student_id": student_a["id"],
                    "briva": "3001002",
                    "amount": 500000,
                    "period": "2025.2",
                    "status": "unpaid",
                },
            )
            create_bill(
                database,
                {
                    "student_id": student_b["id"],
                    "briva": "3002001",
                    "amount": 2000000,
                    "period": "2025.1",
                    "status": "unpaid",
                },
            )

            summary = get_financial_summary(
                database,
                period="2025.1",
                study_program_id="sp_hkum",
                entry_period="2024.1",
            )

            self.assertEqual(summary["totals"]["total_students"], 1)
            self.assertEqual(summary["totals"]["total_bills"], 1)
            self.assertEqual(summary["totals"]["billed_amount"], 1000000)
            self.assertEqual(summary["totals"]["paid_amount"], 1000000)
            self.assertEqual([row["nim"] for row in summary["by_student"]], ["3001"])

    def test_dashboard_and_financial_summary_with_partial_bills(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            conn = connect(database)
            init_db(conn)
            conn.close()

            st1 = create_student(database, {"nim": "050117001", "full_name": "Mhs Satu", "study_program_id": "sp_hkum"})
            st2 = create_student(database, {"nim": "050117002", "full_name": "Mhs Dua", "study_program_id": "sp_sifo"})

            # Bill 1: 2.000.000, paid 1.500.000 (partial)
            create_bill(
                database,
                {
                    "student_id": st1["id"],
                    "briva": "178100023200001",
                    "amount": 2000000,
                    "paid_amount": 1500000,
                    "period": "20251",
                    "status": "partial",
                },
            )

            # Bill 2: 1.000.000, paid (full)
            create_bill(
                database,
                {
                    "student_id": st2["id"],
                    "briva": "178100023200002",
                    "amount": 1000000,
                    "paid_amount": 1000000,
                    "period": "20251",
                    "status": "paid",
                },
            )

            # Bill 3: 500.000, unpaid
            create_bill(
                database,
                {
                    "student_id": st2["id"],
                    "briva": "178100023200003",
                    "amount": 500000,
                    "paid_amount": 0,
                    "period": "20251",
                    "status": "unpaid",
                },
            )

            stats = get_dashboard_stats(database)
            # Total billed = 2.000.000 + 1.000.000 + 500.000 = 3.500.000
            # Total paid = 1.500.000 (from partial) + 1.000.000 (from paid) = 2.500.000
            # Outstanding = 3.500.000 - 2.500.000 = 1.000.000
            self.assertEqual(stats["total_billed_amount"], 3500000)
            self.assertEqual(stats["total_paid_amount"], 2500000)
            self.assertEqual(stats["total_outstanding_amount"], 1000000)
            self.assertEqual(stats["partial_bills"], 1)
            self.assertEqual(stats["paid_bills"], 1)
            self.assertEqual(stats["unpaid_bills"], 1)

            fin = get_financial_summary(database)
            self.assertEqual(fin["totals"]["billed_amount"], 3500000)
            self.assertEqual(fin["totals"]["paid_amount"], 2500000)
            self.assertEqual(fin["totals"]["outstanding_amount"], 1000000)


if __name__ == "__main__":
    unittest.main()
