from __future__ import annotations

import sys
import sqlite3
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import server
from Backend.app import config as app_config
from Backend.app.services import (
    create_bill,
    delete_imported_bill_group,
    list_bills,
    list_imported_bill_groups,
)
from import_excel import import_workbook, preview_workbook
from db import migrate_database
from fastapi.testclient import TestClient
from Backend.tests.test_base import BackendBaseTestCase


class ImportWorkbookTests(BackendBaseTestCase):
    def test_workbook_preview_has_no_critical_rows(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            workbook = Path(temporary_directory) / "preview.xlsx"
            self._write_workbook(
                workbook,
                [
                    ("01001", "Ayu Sari", "12345", 100000),
                    ("01001", "Ayu Sari", "12345", 125000),
                ],
            )
            preview = preview_workbook(workbook)

        self.assertEqual(preview["valid_rows"], 2)
        self.assertEqual(preview["critical_rows"], 0)
        self.assertEqual(preview["issue_rows"], 2)
        self.assertEqual(preview["multiple_bill_rows"], 2)

    def test_reupload_is_unchanged_and_amount_update_requires_confirmation(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            temp = Path(temporary_directory)
            database = temp / "salut.sqlite"
            migrate_database(database)
            initial = temp / "initial.xlsx"
            updated = temp / "updated.xlsx"
            self._write_workbook(initial, [("01001", "Ayu Sari", "12345", 100000)])
            self._write_workbook(updated, [("01001", "Ayu Sari", "12345", 125000)])

            first_preview = preview_workbook(initial, database)
            self.assertEqual(first_preview["new_rows"], 1)
            self.assertEqual(first_preview["critical_rows"], 0)
            self.assertEqual(import_workbook(initial, database)["created"], 1)

            same_preview = preview_workbook(initial, database)
            self.assertEqual(same_preview["unchanged_rows"], 1)
            self.assertEqual(same_preview["update_rows"], 0)
            self.assertEqual(import_workbook(initial, database)["imported"], 0)

            update_preview = preview_workbook(updated, database)
            self.assertEqual(update_preview["amount_change_rows"], 1)
            self.assertTrue(update_preview["requires_update_confirmation"])
            with self.assertRaisesRegex(ValueError, "memerlukan konfirmasi"):
                import_workbook(updated, database)
            self.assertEqual(import_workbook(updated, database, confirm_updates=True)["updated"], 1)

            conn = sqlite3.connect(database)
            amount = conn.execute("select amount from bills where briva = '12345'").fetchone()[0]
            conn.close()
            self.assertEqual(amount, 125000)

    def test_import_restores_soft_deleted_student_with_same_nim(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            temp = Path(temporary_directory)
            database = temp / "salut.sqlite"
            migrate_database(database)
            workbook = temp / "restore-student.xlsx"
            self._write_workbook(workbook, [("01009", "Nama Setelah Restore", "90001", 100000)])

            conn = sqlite3.connect(database)
            conn.execute(
                """
                insert into students (
                    id, nim, full_name, name_norm, deleted_at, deleted_by, delete_reason
                ) values (?, ?, ?, ?, datetime('now'), ?, ?)
                """,
                ("student-soft-deleted", "01009", "Nama Lama", "nama lama", "admin-old", "Data lama"),
            )
            conn.commit()
            conn.close()

            result = import_workbook(workbook, database)
            self.assertEqual(result["created"], 1)

            conn = sqlite3.connect(database)
            student = conn.execute(
                """
                select id, full_name, deleted_at, deleted_by, delete_reason
                from students
                where nim = ?
                """,
                ("01009",),
            ).fetchone()
            student_count = conn.execute("select count(*) from students where nim = ?", ("01009",)).fetchone()[0]
            bill_student_id = conn.execute("select student_id from bills where briva = ?", ("90001",)).fetchone()[0]
            conn.close()

            self.assertEqual(student_count, 1)
            self.assertEqual(student[0], "student-soft-deleted")
            self.assertEqual(student[1], "Nama Setelah Restore")
            self.assertIsNone(student[2])
            self.assertIsNone(student[3])
            self.assertIsNone(student[4])
            self.assertEqual(bill_student_id, "student-soft-deleted")

    def test_briva_replacement_and_paid_bill_protection(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            temp = Path(temporary_directory)
            database = temp / "salut.sqlite"
            migrate_database(database)
            initial = temp / "initial.xlsx"
            replacement = temp / "replacement.xlsx"
            changed_amount = temp / "changed-amount.xlsx"
            self._write_workbook(initial, [("01002", "Bima Putra", "20001", 100000)])
            self._write_workbook(replacement, [("01002", "Bima Putra", "20002", 100000)])
            self._write_workbook(changed_amount, [("01002", "Bima Putra", "20002", 150000)])
            import_workbook(initial, database)

            replacement_preview = preview_workbook(replacement, database)
            self.assertEqual(replacement_preview["briva_change_rows"], 1)
            self.assertTrue(replacement_preview["requires_update_confirmation"])
            import_workbook(replacement, database, confirm_updates=True)

            conn = sqlite3.connect(database)
            self.assertEqual(conn.execute("select count(*) from bills").fetchone()[0], 1)
            self.assertEqual(conn.execute("select briva from bills").fetchone()[0], "20002")
            conn.execute("update bills set status = 'paid'")
            conn.commit()
            conn.close()

            paid_preview = preview_workbook(changed_amount, database)
            self.assertGreater(paid_preview["critical_rows"], 0)
            self.assertGreater(paid_preview["conflict_rows"], 0)

    def test_same_briva_for_different_nim_is_critical(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            workbook = Path(temporary_directory) / "duplicate-briva-different-nim.xlsx"
            self._write_workbook(
                workbook,
                [
                    ("01003", "Citra P", "30001", 100000),
                    ("01004", "Dina R", "30001", 100000),
                ],
            )
            preview = preview_workbook(workbook)
            self.assertGreater(preview["critical_rows"], 0)
            self.assertEqual(preview["duplicate_briva_conflict_rows"], 2)

    def test_same_nim_with_same_briva_imports_multiple_bills_idempotently(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            temp = Path(temporary_directory)
            database = temp / "salut.sqlite"
            migrate_database(database)
            workbook = temp / "Tagihan tambahan bebas namanya.xlsx"
            self._write_workbook(
                workbook,
                [
                    ("01004", "Dina Rahma", "40001", 100000),
                    ("01004", "Dina Rahma", "40001", 150000),
                ],
            )

            preview = preview_workbook(workbook, database)
            self.assertEqual(preview["critical_rows"], 0)
            self.assertEqual(preview["multiple_bill_rows"], 2)
            self.assertEqual(preview["new_rows"], 2)
            result = import_workbook(workbook, database)
            self.assertEqual(result["created"], 2)
            self.assertEqual(import_workbook(workbook, database)["unchanged"], 2)

            conn = sqlite3.connect(database)
            count = conn.execute("select count(*) from bills").fetchone()[0]
            briva_count = conn.execute("select count(*) from bills where briva = '40001'").fetchone()[0]
            source_files = conn.execute("select distinct source_file from bills").fetchall()
            conn.close()
            self.assertEqual(count, 2)
            self.assertEqual(briva_count, 2)
            self.assertEqual(source_files[0][0], "Tagihan tambahan bebas namanya.xlsx")

    def test_duplicate_bill_import_backfills_legacy_row_without_source_number(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            temp = Path(temporary_directory)
            database = temp / "salut.sqlite"
            migrate_database(database)
            workbook = temp / "legacy-source.xlsx"
            self._write_workbook(workbook, [("01006", "Fajar Hadi", "60001", 100000)])
            import_workbook(workbook, database)

            conn = sqlite3.connect(database)
            conn.execute("update bills set source_row_number = null")
            conn.commit()
            conn.close()

            self._write_workbook(
                workbook,
                [
                    ("01006", "Fajar Hadi", "60001", 100000),
                    ("01006", "Fajar Hadi", "60001", 100000),
                ],
            )

            preview = preview_workbook(workbook, database)
            self.assertEqual(preview["unchanged_rows"], 1)
            self.assertEqual(preview["new_rows"], 1)
            self.assertEqual(preview["multiple_bill_rows"], 2)

            result = import_workbook(workbook, database)
            self.assertEqual(result["created"], 1)
            self.assertEqual(result["unchanged"], 1)

            conn = sqlite3.connect(database)
            count = conn.execute("select count(*) from bills where briva = '60001'").fetchone()[0]
            source_rows = conn.execute(
                "select source_row_number from bills where briva = '60001' order by source_row_number"
            ).fetchall()
            conn.close()
            self.assertEqual(count, 2)
            self.assertEqual([row[0] for row in source_rows], [None, 3])

            second_preview = preview_workbook(workbook, database)
            self.assertEqual(second_preview["new_rows"], 0)
            self.assertEqual(second_preview["unchanged_rows"], 2)

    def test_imported_groups_exclude_manual_data_and_can_be_deleted(self) -> None:

        with tempfile.TemporaryDirectory() as temporary_directory:
            temp = Path(temporary_directory)
            database = temp / "salut.sqlite"
            migrate_database(database)
            workbook = temp / "batch-file-delete.xlsx"
            self._write_workbook(workbook, [("01015", "Data Import", "51515", 250000)])
            import_workbook(workbook, database)
            create_bill(
                database,
                {
                    "nim": "01016",
                    "full_name": "Data Manual",
                    "briva": "61616",
                    "amount": 300000,
                    "period": "Semester Ganjil 2026",
                },
            )

            groups = list_imported_bill_groups(database)
            self.assertEqual([group["file_name"] for group in groups], ["batch-file-delete.xlsx"])
            self.assertEqual(groups[0]["student_count"], 1)

            deleted = delete_imported_bill_group(
                database,
                "batch-file-delete.xlsx",
                actor_id="admin-test",
                reason="File tidak digunakan",
            )
            self.assertEqual(deleted, {"file_name": "batch-file-delete.xlsx", "deleted_bills": 1})
            self.assertEqual(list_imported_bill_groups(database), [])
            self.assertEqual([bill["source_file"] for bill in list_bills(database)], ["Manual Admin"])

            reimported = import_workbook(workbook, database)
            self.assertEqual(reimported["created"], 1)
            self.assertEqual(len(list_imported_bill_groups(database)), 1)

    def test_current_customer_workbook_maps_profile_and_due_date(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            temp = Path(temporary_directory)
            database = temp / "salut.sqlite"
            migrate_database(database)
            workbook = temp / "customer_20260808.xlsx"
            self._write_current_workbook(
                workbook,
                [
                    (
                        "01008",
                        "Tara Utami",
                        "UT Serang/2025-Ganjil",
                        "'081234567890",
                        "FST - Sistem Informasi",
                        "'178100023200888",
                        1850000,
                        "07 Agustus 2026 Pukul 11.59 WIB",
                    ),
                ],
            )

            preview = preview_workbook(workbook, database)
            self.assertEqual(preview["valid_rows"], 1)
            self.assertEqual(preview["critical_rows"], 0)
            self.assertEqual(preview["sample"][0]["briva"], "178100023200888")
            self.assertEqual(preview["sample"][0]["program_study"], "FST - Sistem Informasi")
            self.assertEqual(import_workbook(workbook, database)["created"], 1)
            self.assertEqual(import_workbook(workbook, database)["unchanged"], 1)

            conn = sqlite3.connect(database)
            student = conn.execute(
                "select program_study, initial_registration, phone_number from students where nim = ?", ("01008",)
            ).fetchone()
            bill = conn.execute("select briva, period, due_date from bills").fetchone()
            conn.close()
            self.assertEqual(student, ("FST - Sistem Informasi", "UT Serang/2025-Ganjil", "081234567890"))
            self.assertEqual(bill, ("178100023200888", "Semester Ganjil 2026", "07 Agustus 2026 Pukul 11.59 WIB"))

            original_db_path = app_config.DB_PATH
            app_config.DB_PATH = database
            try:
                response = TestClient(server.app).post("/api/lookup", json={"nim": "01008"})
            finally:
                app_config.DB_PATH = original_db_path
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["data"]["student"]["program_study"], "FST - Sistem Informasi")
            self.assertEqual(response.json()["data"]["student"]["due_date"], "07 Agustus 2026 Pukul 11.59 WIB")

    def test_current_customer_workbook_skips_invalid_required_row(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            temp = Path(temporary_directory)
            database = temp / "salut.sqlite"
            migrate_database(database)
            workbook = temp / "customer_invalid_row.xlsx"
            self._write_current_workbook(
                workbook,
                [
                    (
                        "01009",
                        "Dina Putri",
                        "UT Serang/2025-Ganjil",
                        "'081234567891",
                        "FST - Sistem Informasi",
                        "'178100023200889",
                        1850000,
                        "07 Agustus 2026 Pukul 11.59 WIB",
                    ),
                    (
                        "ABC-01009",
                        "Data Tidak Valid",
                        "UT Serang/2025-Ganjil",
                        "'081234567892",
                        "FST - Sistem Informasi",
                        "'178100023200890",
                        1850000,
                        "07 Agustus 2026 Pukul 11.59 WIB",
                    ),
                    (
                        "01010",
                        "BRIVA Tidak Valid",
                        "UT Serang/2025-Ganjil",
                        "'081234567893",
                        "FST - Sistem Informasi",
                        "ABC-178100023200891",
                        1850000,
                        "07 Agustus 2026 Pukul 11.59 WIB",
                    ),
                ],
            )

            preview = preview_workbook(workbook, database)
            self.assertEqual(preview["valid_rows"], 1)
            self.assertEqual(preview["critical_rows"], 0)
            self.assertEqual(preview["issue_rows"], 2)
            result = import_workbook(workbook, database)
            self.assertEqual(result["created"], 1)
            self.assertEqual(result["issues"], 2)

            conn = sqlite3.connect(database)
            issues = conn.execute("select row_number, note from import_issues order by row_number").fetchall()
            conn.close()
            self.assertEqual(
                issues,
                [
                    (3, "Baris dilewati karena NIM, nama, BRIVA, atau nominal tidak valid."),
                    (4, "Baris dilewati karena NIM, nama, BRIVA, atau nominal tidak valid."),
                ],
            )
            from Backend.app.services import list_import_issues

            stored_issues = list_import_issues(database)
            self.assertEqual(len(stored_issues), 2)
            self.assertEqual(stored_issues[0]["row_number"], 3)
            self.assertEqual(stored_issues[1]["row_number"], 4)


if __name__ == "__main__":
    unittest.main()
