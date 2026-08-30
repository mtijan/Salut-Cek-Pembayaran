from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from Backend.app.repositories.bills import BillRepository
from Backend.app.repositories.students import StudentRepository
from Backend.app.use_cases.lookup import LookupService
from Backend.db import database_connection, database_transaction, migrate_database


class LookupRepositoryTests(unittest.TestCase):
    def test_repositories_hide_soft_deleted_records(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            migrate_database(database)
            with database_transaction(database) as connection:
                connection.execute(
                    "insert into students (id, nim, full_name, name_norm, deleted_at) values (?, ?, ?, ?, datetime('now'))",
                    ("student-deleted", "100001", "Deleted Student", "deleted student"),
                )
                connection.execute(
                    "insert into students (id, nim, full_name, name_norm) values (?, ?, ?, ?)",
                    ("student-active", "100002", "Active Student", "active student"),
                )
                connection.execute(
                    """
                    insert into bills (
                        id, student_id, briva, amount, period, bill_type, instructions, source_file, deleted_at
                    ) values (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                    """,
                    (
                        "bill-deleted",
                        "student-active",
                        "BRIVA-DELETED",
                        100000,
                        "2026.1",
                        "UKT",
                        "Data dihapus untuk pengujian.",
                        "test.xlsx",
                    ),
                )

            with database_connection(database) as connection:
                students = StudentRepository(connection)
                bills = BillRepository(connection)
                self.assertIsNone(students.find_active_for_public_lookup("100001"))
                active_student = students.find_active_for_public_lookup("100002")
                self.assertIsNotNone(active_student)
                self.assertEqual(bills.list_active_for_public_lookup("student-active"), [])


class LookupServiceTests(unittest.TestCase):
    def test_lookup_builds_the_existing_public_contract(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            migrate_database(database)
            with database_transaction(database) as connection:
                connection.execute(
                    "insert into students (id, nim, full_name, name_norm) values (?, ?, ?, ?)",
                    ("student-lookup", "050117077", "Syahla Taqiyyah", "syahla taqiyyah"),
                )
                connection.execute(
                    """
                    insert into bills (
                        id, student_id, briva, amount, paid_amount, period, bill_type,
                        status, payment_method, instructions, due_date, source_file, created_at
                    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        "bill-partial",
                        "student-lookup",
                        "BRIVA-PARTIAL",
                        500000,
                        200000,
                        "2026.2",
                        "UKT",
                        "partial",
                        "BRIVA",
                        "Bayar melalui BRIVA.",
                        "2026-09-10",
                        "test.xlsx",
                        "2026-08-27 08:00:00",
                    ),
                )
                connection.execute(
                    """
                    insert into bills (
                        id, student_id, briva, amount, paid_amount, period, bill_type,
                        status, payment_method, instructions, due_date, source_file, created_at
                    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        "bill-paid",
                        "student-lookup",
                        "BRIVA-PAID",
                        1000000,
                        0,
                        "2026.1",
                        "UKT",
                        "paid",
                        "BRIVA",
                        "Sudah lunas.",
                        "2026-08-10",
                        "test.xlsx",
                        "2026-08-27 07:00:00",
                    ),
                )

            result = LookupService(
                database,
                default_program_study="Program Default",
                default_payment_period_label="Semester Aktif",
            ).execute("050117077")

            self.assertIsNotNone(result)
            assert result is not None
            self.assertEqual(
                set(result),
                {"student", "bills", "payment_status"},
            )
            self.assertEqual(result["payment_status"], "partial")
            student = result["student"]
            assert isinstance(student, dict)
            self.assertEqual(student["program_study"], "Program Default")
            self.assertEqual(student["payment_period"], "Semester Aktif")
            self.assertEqual(student["due_date"], "2026-09-10")

            bills = result["bills"]
            assert isinstance(bills, list)
            self.assertEqual([bill["bill_label"] for bill in bills], ["Tagihan 1", "Tagihan 2"])
            self.assertEqual(bills[0]["paid_amount"], 200000)
            self.assertEqual(bills[0]["remaining_amount"], 300000)
            self.assertEqual(bills[1]["paid_amount"], 1000000)
            self.assertEqual(bills[1]["remaining_amount"], 0)

    def test_lookup_returns_none_for_unknown_nim(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            migrate_database(database)
            result = LookupService(
                database,
                default_program_study="Program Default",
                default_payment_period_label="Semester Aktif",
            ).execute("999999")
            self.assertIsNone(result)


if __name__ == "__main__":
    unittest.main()
