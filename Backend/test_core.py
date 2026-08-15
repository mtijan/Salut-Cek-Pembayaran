from __future__ import annotations

import json
import sys
import sqlite3
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))

import server
from Backend.app import config as app_config
from Backend.app.config import ROLE_PERMISSIONS
from Backend.app.rate_limit import RateLimiter
from Backend.app.services import delete_imported_bill_group, list_imported_bill_groups, summarize_payment_status, update_bill_status
from import_excel import import_workbook, preview_workbook
from db import connect, init_db
from fastapi.testclient import TestClient


class CoreBehaviorTests(unittest.TestCase):
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

    def test_rate_limiter_blocks_after_limit(self) -> None:
        limiter = RateLimiter()
        self.assertIsNone(limiter.check("lookup", "127.0.0.1", 2, 60))
        self.assertIsNone(limiter.check("lookup", "127.0.0.1", 2, 60))
        self.assertIsNotNone(limiter.check("lookup", "127.0.0.1", 2, 60))

    def test_viewer_cannot_import(self) -> None:
        self.assertNotIn("import", ROLE_PERMISSIONS["viewer"])
        self.assertIn("import", ROLE_PERMISSIONS["admin"])

    def test_lookup_uses_nim_only_without_returning_name(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            conn = connect(database)
            init_db(conn)
            with conn:
                conn.execute(
                    "insert into students (id, nim, full_name, name_norm) values (?, ?, ?, ?)",
                    ("student-1", "050117077", "Syahla Taqiyyah", "syahla taqiyyah"),
                )
                conn.execute(
                    """
                    insert into bills (id, student_id, briva, amount, period, bill_type, instructions, source_file)
                    values (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        "bill-1",
                        "student-1",
                        "178100023200040",
                        1850000,
                        "2025.2",
                        "UKT BRIVA",
                        "Bayar melalui BRIVA BRI dengan nomor VA yang tampil.",
                        "unit-test.xlsx",
                    ),
                )
                conn.execute(
                    """
                    insert into bills (id, student_id, briva, amount, period, bill_type, instructions, source_file)
                    values (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        "bill-2",
                        "student-1",
                        "178100023200041",
                        750000,
                        "2025.2",
                        "UKT BRIVA",
                        "Bayar melalui BRIVA BRI dengan nomor VA yang tampil.",
                        "unit-test.xlsx",
                    ),
                )
            conn.close()

            original_db_path = app_config.DB_PATH
            app_config.DB_PATH = database
            try:
                client = TestClient(server.app)
                response = client.post("/api/lookup", json={"nim": "050117077", "full_name": "Tidak Dipakai"})
                result = response.json()
            finally:
                app_config.DB_PATH = original_db_path

            self.assertEqual(response.status_code, 200)
            self.assertTrue(result["success"])
            self.assertEqual(result["data"]["student"]["nim"], "050117077")
            self.assertEqual(result["data"]["student"]["full_name"], "Syahla Taqiyyah")
            self.assertEqual(result["data"]["student"]["program_study"], "S1 Ilmu Hukum")
            self.assertEqual(result["data"]["student"]["payment_period"], "Semester Ganjil 2026")
            self.assertEqual(set(result["data"]["student"]), {"nim", "full_name", "program_study", "payment_period", "due_date", "due_date_formatted"})
            self.assertEqual([bill["bill_label"] for bill in result["data"]["bills"]], ["Tagihan 1", "Tagihan 2"])

    def test_lookup_reports_partial_payment_status(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            conn = connect(database)
            init_db(conn)
            with conn:
                conn.execute(
                    "insert into students (id, nim, full_name, name_norm) values (?, ?, ?, ?)",
                    ("student-partial", "050117088", "Rina Partial", "rina partial"),
                )
                conn.execute(
                    """
                    insert into bills (id, student_id, briva, amount, period, bill_type, status, instructions, source_file)
                    values (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        "bill-partial",
                        "student-partial",
                        "178100023200088",
                        500000,
                        "2025.2",
                        "UKT BRIVA",
                        "partial",
                        "Bayar melalui BRIVA BRI dengan nomor VA yang tampil.",
                        "unit-test.xlsx",
                    ),
                )
            conn.close()

            original_db_path = app_config.DB_PATH
            app_config.DB_PATH = database
            try:
                response = TestClient(server.app).post("/api/lookup", json={"nim": "050117088"})
                result = response.json()
            finally:
                app_config.DB_PATH = original_db_path

            self.assertEqual(response.status_code, 200)
            self.assertTrue(result["success"])
            self.assertEqual(result["data"]["payment_status"], "partial")
            self.assertEqual(result["data"]["bills"][0]["status"], "partial")

    def test_payment_status_summary_accepts_partial_aliases(self) -> None:
        self.assertEqual(summarize_payment_status(["paid", "lunas sebagian"]), "partial")
        self.assertEqual(summarize_payment_status(["dicicil"]), "partial")
        self.assertEqual(summarize_payment_status(["paid", "lunas"]), "paid")

    def test_reupload_is_unchanged_and_amount_update_requires_confirmation(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            temp = Path(temporary_directory)
            database = temp / "salut.sqlite"
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

    def test_briva_replacement_and_paid_bill_protection(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            temp = Path(temporary_directory)
            database = temp / "salut.sqlite"
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
            source_rows = conn.execute("select source_row_number from bills where briva = '60001' order by source_row_number").fetchall()
            conn.close()
            self.assertEqual(count, 2)
            self.assertEqual([row[0] for row in source_rows], [None, 3])

            second_preview = preview_workbook(workbook, database)
            self.assertEqual(second_preview["new_rows"], 0)
            self.assertEqual(second_preview["unchanged_rows"], 2)

    def test_admin_bill_groups_and_status_update(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            temp = Path(temporary_directory)
            database = temp / "salut.sqlite"
            workbook = temp / "batch-admin.xlsx"
            self._write_workbook(workbook, [("01005", "Eka Putri", "50001", 125000)])
            import_workbook(workbook, database)

            groups = list_imported_bill_groups(database)
            self.assertEqual(len(groups), 1)
            self.assertEqual(groups[0]["file_name"], "batch-admin.xlsx")
            self.assertEqual(groups[0]["student_count"], 1)
            self.assertEqual(groups[0]["total_amount"], 125000)
            self.assertTrue(groups[0]["imported_at"])
            self.assertEqual(groups[0]["unpaid"], 1)
            bill_id = groups[0]["bills"][0]["id"]

            updated = update_bill_status(database, bill_id, "partial")
            self.assertIsNotNone(updated)
            self.assertEqual(updated["status"], "partial")
            groups = list_imported_bill_groups(database)
            self.assertEqual(groups[0]["partial"], 1)

            updated = update_bill_status(database, bill_id, "paid")
            self.assertIsNotNone(updated)
            self.assertEqual(updated["status"], "paid")
            groups = list_imported_bill_groups(database)
            self.assertEqual(groups[0]["paid"], 1)

    def test_imported_groups_exclude_manual_data_and_can_be_deleted(self) -> None:
        from Backend.app.services import create_bill, list_bills

        with tempfile.TemporaryDirectory() as temporary_directory:
            temp = Path(temporary_directory)
            database = temp / "salut.sqlite"
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

    def test_admin_bill_due_date_update(self) -> None:
        from Backend.app.services import update_bill_due_date, format_due_date
        with tempfile.TemporaryDirectory() as temporary_directory:
            temp = Path(temporary_directory)
            database = temp / "salut.sqlite"
            workbook = temp / "batch-due.xlsx"
            self._write_workbook(workbook, [("01006", "Siti Aminah", "50002", 200000)])
            import_workbook(workbook, database)

            groups = list_imported_bill_groups(database)
            bill_id = groups[0]["bills"][0]["id"]

            updated = update_bill_due_date(database, [bill_id], "2026-08-25")
            self.assertTrue(len(updated) > 0)
            self.assertEqual(updated[0]["due_date"], "2026-08-25")
            self.assertEqual(format_due_date("2026-08-25"), "25 Agustus 2026")

            groups = list_imported_bill_groups(database)
            self.assertEqual(groups[0]["bills"][0]["due_date"], "2026-08-25")
            self.assertEqual(groups[0]["bills"][0]["due_date_formatted"], "25 Agustus 2026")

    def test_current_customer_workbook_maps_profile_and_due_date(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            temp = Path(temporary_directory)
            database = temp / "salut.sqlite"
            workbook = temp / "customer_20260808.xlsx"
            self._write_current_workbook(
                workbook,
                [
                    (
                        "01008", "Tara Utami", "UT Serang/2025-Ganjil", "'081234567890",
                        "FST - Sistem Informasi", "'178100023200888", 1850000,
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
            workbook = temp / "customer_invalid_row.xlsx"
            self._write_current_workbook(
                workbook,
                [
                    ("01009", "Dina Putri", "UT Serang/2025-Ganjil", "'081234567891", "FST - Sistem Informasi", "'178100023200889", 1850000, "07 Agustus 2026 Pukul 11.59 WIB"),
                    ("`", "Data Tidak Valid", "UT Serang/2025-Ganjil", "'081234567892", "FST - Sistem Informasi", "'178100023200890", 1850000, "07 Agustus 2026 Pukul 11.59 WIB"),
                ],
            )

            preview = preview_workbook(workbook, database)
            self.assertEqual(preview["valid_rows"], 1)
            self.assertEqual(preview["critical_rows"], 0)
            self.assertEqual(preview["issue_rows"], 1)
            result = import_workbook(workbook, database)
            self.assertEqual(result["created"], 1)
            self.assertEqual(result["issues"], 1)

            conn = sqlite3.connect(database)
            issue = conn.execute("select row_number, note from import_issues").fetchone()
            conn.close()
            self.assertEqual(issue, (3, "Baris dilewati karena NIM, nama, BRIVA, atau nominal tidak valid."))
            from Backend.app.services import list_import_issues
            stored_issues = list_import_issues(database)
            self.assertEqual(len(stored_issues), 1)
            self.assertEqual(stored_issues[0]["row_number"], 3)

    def test_current_customer_workbook_cleans_excel_markers_without_changing_due_date(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            temp = Path(temporary_directory)
            database = temp / "salut.sqlite"
            workbook = temp / "customer_markers.xlsx"
            self._write_current_workbook(
                workbook,
                [
                    (
                        "`01010", "' Dini Putri", "`UT Serang/2025-Ganjil", "`0812-3456-7890",
                        "'FST - Sistem Informasi", "`178100023200891", "Rp 1.850.000",
                        "`07 Agustus 2026 Pukul 11.59 WIB",
                    ),
                ],
            )

            preview = preview_workbook(workbook, database)
            self.assertEqual(preview["valid_rows"], 1)
            self.assertEqual(preview["critical_rows"], 0)
            self.assertEqual(import_workbook(workbook, database)["created"], 1)

            conn = sqlite3.connect(database)
            student = conn.execute(
                "select nim, full_name, initial_registration, phone_number, program_study from students"
            ).fetchone()
            bill = conn.execute("select briva, amount, due_date from bills").fetchone()
            conn.close()
            self.assertEqual(student, ("01010", "DINI PUTRI", "UT Serang/2025-Ganjil", "081234567890", "FST - Sistem Informasi"))
            self.assertEqual(bill, ("178100023200891", 1850000, "07 Agustus 2026 Pukul 11.59 WIB"))

    def test_admin_manual_student_and_bill_crud_api(self) -> None:
        from Backend.app.security import hash_password

        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            conn = connect(database)
            init_db(conn)
            with conn:
                conn.execute(
                    """
                    insert into admin_users (id, email, password_hash, full_name, role)
                    values (?, ?, ?, ?, ?)
                    """,
                    ("admin-1", "admin@example.test", hash_password("PasswordBaru123!"), "Admin Test", "admin"),
                )
            conn.close()

            original_db_path = app_config.DB_PATH
            app_config.DB_PATH = database
            try:
                client = TestClient(server.app)
                login = client.post(
                    "/api/admin/login",
                    json={"email": "admin@example.test", "password": "PasswordBaru123!"},
                )
                self.assertEqual(login.status_code, 200)

                created_student = client.post("/api/admin/students", json={"nim": "01007", "full_name": "Raka Putra"})
                self.assertEqual(created_student.status_code, 200)
                student_id = created_student.json()["data"]["student"]["id"]

                updated_student = client.patch(
                    f"/api/admin/students/{student_id}",
                    json={"nim": "01007", "full_name": "Raka Putra Santoso"},
                )
                self.assertEqual(updated_student.status_code, 200)
                self.assertEqual(updated_student.json()["data"]["student"]["full_name"], "Raka Putra Santoso")

                created_bill = client.post(
                    "/api/admin/bills",
                    json={
                        "nim": "01007",
                        "full_name": "Raka Putra Santoso",
                        "briva": "70001",
                        "amount": 100000,
                        "period": "Semester Ganjil 2026",
                        "bill_type": "UKT BRIVA",
                        "status": "unpaid",
                    },
                )
                self.assertEqual(created_bill.status_code, 200)
                bill_id = created_bill.json()["data"]["bill"]["id"]

                updated_bill = client.patch(
                    f"/api/admin/bills/{bill_id}",
                    json={
                        "nim": "01007",
                        "full_name": "Raka Putra Santoso",
                        "briva": "70001",
                        "amount": 125000,
                        "period": "Semester Ganjil 2026",
                        "bill_type": "UKT BRIVA",
                        "status": "paid",
                        "due_date": "2026-08-25",
                    },
                )
                self.assertEqual(updated_bill.status_code, 200)
                self.assertEqual(updated_bill.json()["data"]["bill"]["status"], "paid")
                self.assertEqual(updated_bill.json()["data"]["bill"]["amount"], 125000)

                conn = connect(database)
                with conn:
                    conn.execute(
                        """
                        insert into bills
                          (id, student_id, briva, amount, period, bill_type, instructions, source_file, source_row_number)
                        values (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        ("bill-import-api", student_id, "70002", 150000, "Semester Ganjil 2026", "UKT BRIVA", "Bayar", "api-import.xlsx", 2),
                    )
                conn.close()
                deleted_file = client.request(
                    "DELETE",
                    "/api/admin/imported-files",
                    json={"file_name": "api-import.xlsx", "reason": "Pengujian hapus file"},
                )
                self.assertEqual(deleted_file.status_code, 200)
                self.assertEqual(deleted_file.json()["data"]["deleted_bills"], 1)

                self.assertEqual(client.get("/api/admin/students").status_code, 200)
                self.assertEqual(client.get("/api/admin/bills").status_code, 200)
                self.assertEqual(client.get("/api/admin/import-issues").status_code, 200)
                self.assertEqual(client.delete(f"/api/admin/bills/{bill_id}?reason=test").status_code, 200)
                self.assertEqual(client.delete(f"/api/admin/students/{student_id}?reason=test").status_code, 200)
            finally:
                app_config.DB_PATH = original_db_path

    def test_admin_bills_pagination_limits_each_page_to_100(self) -> None:
        from Backend.app.security import hash_password

        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            conn = connect(database)
            init_db(conn)
            with conn:
                conn.execute(
                    "insert into admin_users (id, email, password_hash, role) values (?, ?, ?, ?)",
                    ("admin-page", "admin@page.test", hash_password("Password123!"), "admin"),
                )
                conn.execute(
                    "insert into students (id, nim, full_name, name_norm) values (?, ?, ?, ?)",
                    ("student-page", "09999", "Mahasiswa Pagination", "mahasiswa pagination"),
                )
                conn.executemany(
                    """
                    insert into bills (id, student_id, briva, amount, period, bill_type, instructions, source_file)
                    values (?, 'student-page', ?, 100000, 'Semester Ganjil 2026', 'UKT BRIVA', 'Bayar', 'pagination.xlsx')
                    """,
                    [(f"bill-page-{index}", f"900{index:03d}") for index in range(105)],
                )
                conn.execute(
                    "update bills set status = 'paid', source_file = 'Manual Admin' where id = 'bill-page-0'"
                )
            conn.close()

            original_db_path = app_config.DB_PATH
            app_config.DB_PATH = database
            try:
                client = TestClient(server.app)
                client.post("/api/admin/login", json={"email": "admin@page.test", "password": "Password123!"})

                first_page = client.get("/api/admin/bills?limit=500&offset=0")
                self.assertEqual(first_page.status_code, 200)
                self.assertEqual(len(first_page.json()["data"]["bills"]), 100)
                self.assertEqual(
                    first_page.json()["data"]["pagination"],
                    {"total": 105, "limit": 100, "offset": 0, "page": 1, "total_pages": 2},
                )

                second_page = client.get("/api/admin/bills?limit=100&offset=100")
                self.assertEqual(len(second_page.json()["data"]["bills"]), 5)
                self.assertEqual(second_page.json()["data"]["pagination"]["page"], 2)

                paid = client.get("/api/admin/bills?status=paid")
                manual = client.get("/api/admin/bills?source=manual")
                imported = client.get("/api/admin/bills?source=import")
                self.assertEqual(paid.json()["data"]["pagination"]["total"], 1)
                self.assertEqual(manual.json()["data"]["pagination"]["total"], 1)
                self.assertEqual(imported.json()["data"]["pagination"]["total"], 104)
            finally:
                app_config.DB_PATH = original_db_path

    def test_public_health_does_not_leak_counts(self) -> None:
        client = TestClient(server.app)
        response = client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["data"],
            {"status": "ok", "version": "0.2.0", "release_id": app_config.RELEASE_ID},
        )

    def test_release_id_auto_follows_git_head(self) -> None:
        with mock.patch.object(app_config, "_read_git_release_id", return_value="554ab37"):
            self.assertEqual(app_config.resolve_release_id("auto"), "554ab37")
            self.assertEqual(app_config.resolve_release_id("git"), "554ab37")

    def test_release_id_manual_override_still_supported(self) -> None:
        with mock.patch.object(app_config, "_read_git_release_id") as git_reader:
            self.assertEqual(app_config.resolve_release_id("release-label"), "release-label")
            git_reader.assert_not_called()

    def test_admin_limit_query_parameter_validation(self) -> None:
        from Backend.app.security import hash_password

        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            conn = connect(database)
            init_db(conn)
            with conn:
                conn.execute(
                    "insert into admin_users (id, email, password_hash, role) values (?, ?, ?, ?)",
                    ("admin-limit", "admin@limit.test", hash_password("Password123!"), "admin"),
                )
            conn.close()

            original_db_path = app_config.DB_PATH
            app_config.DB_PATH = database
            try:
                client = TestClient(server.app)
                client.post("/api/admin/login", json={"email": "admin@limit.test", "password": "Password123!"})
                res = client.get("/api/admin/students?limit=abc")
                self.assertEqual(res.status_code, 400)
                self.assertEqual(res.json()["error"]["code"], "VALIDATION_ERROR")
            finally:
                app_config.DB_PATH = original_db_path

    def test_admin_import_commit_invalid_token(self) -> None:
        from Backend.app.security import hash_password

        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            conn = connect(database)
            init_db(conn)
            with conn:
                conn.execute(
                    "insert into admin_users (id, email, password_hash, role) values (?, ?, ?, ?)",
                    ("admin-imp", "admin@imp.test", hash_password("Password123!"), "admin"),
                )
            conn.close()

            original_db_path = app_config.DB_PATH
            app_config.DB_PATH = database
            try:
                client = TestClient(server.app)
                client.post("/api/admin/login", json={"email": "admin@imp.test", "password": "Password123!"})
                res = client.post("/api/admin/import/commit", json={"import_token": "imp_wildcard*"})
                self.assertEqual(res.status_code, 400)
                self.assertEqual(res.json()["error"]["code"], "VALIDATION_ERROR")
            finally:
                app_config.DB_PATH = original_db_path

    def test_admin_import_commit_rejects_other_admin_preview(self) -> None:
        from Backend.app.security import hash_password
        from Backend.app.services import store_import_preview

        with tempfile.TemporaryDirectory() as temporary_directory:
            temp = Path(temporary_directory)
            database = temp / "salut.sqlite"
            imports = temp / "imports"
            imports.mkdir()
            workbook = imports / "imp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa_owner.xlsx"
            self._write_workbook(workbook, [("01011", "Pemilik Preview", "81111", 100000)])

            conn = connect(database)
            init_db(conn)
            with conn:
                conn.execute(
                    "insert into admin_users (id, email, password_hash, role) values (?, ?, ?, ?)",
                    ("owner-admin", "owner@imp.test", hash_password("Password123!"), "admin"),
                )
                conn.execute(
                    "insert into admin_users (id, email, password_hash, role) values (?, ?, ?, ?)",
                    ("other-admin", "other@imp.test", hash_password("Password123!"), "admin"),
                )
            conn.close()

            original_db_path = app_config.DB_PATH
            original_import_dir = app_config.IMPORT_DIR
            app_config.DB_PATH = database
            app_config.IMPORT_DIR = imports
            try:
                store_import_preview("imp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "owner-admin", "owner.xlsx", workbook)
                client = TestClient(server.app)
                client.post("/api/admin/login", json={"email": "other@imp.test", "password": "Password123!"})
                res = client.post("/api/admin/import/commit", json={"import_token": "imp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"})
                self.assertEqual(res.status_code, 404)
                self.assertTrue(workbook.exists())
            finally:
                app_config.DB_PATH = original_db_path
                app_config.IMPORT_DIR = original_import_dir

    def test_anonymous_admin_endpoints_rejected(self) -> None:
        client = TestClient(server.app)
        self.assertEqual(client.get("/api/admin/students").status_code, 401)
        self.assertEqual(client.get("/api/admin/bills").status_code, 401)
        self.assertEqual(client.get("/api/admin/imported-bills").status_code, 401)
        self.assertEqual(client.request("DELETE", "/api/admin/imported-files", json={"file_name": "x.xlsx", "reason": "test"}).status_code, 401)

    def test_delete_requires_reason(self) -> None:
        from Backend.app.security import hash_password

        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            conn = connect(database)
            init_db(conn)
            with conn:
                conn.execute(
                    "insert into admin_users (id, email, password_hash, role) values (?, ?, ?, ?)",
                    ("admin-delete", "admin@delete.test", hash_password("Password123!"), "admin"),
                )
                conn.execute(
                    "insert into students (id, nim, full_name, name_norm) values (?, ?, ?, ?)",
                    ("student-delete", "01012", "Butuh Alasan", "butuh alasan"),
                )
                conn.execute(
                    """
                    insert into bills (id, student_id, briva, amount, period, bill_type, instructions, source_file)
                    values (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    ("bill-delete", "student-delete", "81212", 100000, "2026.1", "UKT BRIVA", "Bayar", "manual"),
                )
            conn.close()

            original_db_path = app_config.DB_PATH
            app_config.DB_PATH = database
            try:
                client = TestClient(server.app)
                client.post("/api/admin/login", json={"email": "admin@delete.test", "password": "Password123!"})
                bill_res = client.delete("/api/admin/bills/bill-delete")
                student_res = client.delete("/api/admin/students/student-delete")
                self.assertEqual(bill_res.status_code, 400)
                self.assertEqual(student_res.status_code, 400)
                self.assertEqual(bill_res.json()["error"]["code"], "VALIDATION_ERROR")
            finally:
                app_config.DB_PATH = original_db_path

    def test_soft_delete_student_and_bill(self) -> None:
        from Backend.app.services import create_student, create_bill, delete_student, delete_bill, list_students, list_bills

        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            conn = connect(database)
            init_db(conn)
            conn.close()

            student = create_student(database, "050999888", "Mahasiswa Soft Delete")
            bill = create_bill(database, {"nim": "050999888", "full_name": "Mahasiswa Soft Delete", "briva": "999888", "amount": 500000, "period": "2026.1"})

            self.assertEqual(len(list_students(database)), 1)
            self.assertEqual(len(list_bills(database)), 1)

            deleted = delete_bill(database, bill["id"], actor_id="admin-1", reason="Salah entri")
            self.assertIsNotNone(deleted)
            self.assertEqual(len(list_bills(database)), 0)

            deleted_st = delete_student(database, student["id"], actor_id="admin-1", reason="Pengunduran diri")
            self.assertIsNotNone(deleted_st)
            self.assertEqual(len(list_students(database)), 0)

            conn = sqlite3.connect(database)
            st_row = conn.execute("select deleted_at, delete_reason from students where id = ?", (student["id"],)).fetchone()
            conn.close()
            self.assertIsNotNone(st_row[0])
            self.assertEqual(st_row[1], "Pengunduran diri")

    def test_rate_limit_spoofed_proxy_header(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            conn = connect(database)
            init_db(conn)
            conn.close()

            original_db_path = app_config.DB_PATH
            original_trust = app_config.TRUST_PROXY_HEADERS
            app_config.DB_PATH = database
            app_config.TRUST_PROXY_HEADERS = True
            try:
                client = TestClient(server.app)
                for i in range(10):
                    resp = client.post("/api/lookup", json={"nim": "000000"}, headers={"X-Forwarded-For": f"10.0.0.{i}"})
                resp = client.post("/api/lookup", json={"nim": "000000"}, headers={"X-Forwarded-For": "10.0.0.99"})
                self.assertEqual(resp.status_code, 429)
            finally:
                app_config.DB_PATH = original_db_path
                app_config.TRUST_PROXY_HEADERS = original_trust

    def test_malformed_xlsx_is_rejected_safely(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            workbook = Path(temporary_directory) / "malformed.xlsx"
            with zipfile.ZipFile(workbook, "w") as archive:
                archive.writestr("xl/workbook.xml", "<workbook>")
                archive.writestr("xl/_rels/workbook.xml.rels", "<Relationships></Relationships>")
            with self.assertRaisesRegex(ValueError, "Struktur XML file Excel tidak valid"):
                preview_workbook(workbook)

    def test_xlsx_uncompressed_size_limit(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            workbook = Path(temporary_directory) / "oversize.xlsx"
            with zipfile.ZipFile(workbook, "w", compression=zipfile.ZIP_DEFLATED) as archive:
                archive.writestr("xl/workbook.xml", "a" * (20 * 1024 * 1024 + 1))
            with self.assertRaisesRegex(ValueError, "melebihi batas maksimum 20 MB"):
                preview_workbook(workbook)

    def test_xlsx_row_limit(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            workbook = Path(temporary_directory) / "too-many-rows.xlsx"
            rows = [(f"{100000 + index}", "Mahasiswa Banyak", f"88{index}", 100000) for index in range(5001)]
            self._write_workbook(workbook, rows)
            with self.assertRaisesRegex(ValueError, "Jumlah baris worksheet melebihi batas maksimum 5000"):
                preview_workbook(workbook)

    def test_schema_migration_and_master_data(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            conn = connect(database)
            init_db(conn)
            prodi_count = conn.execute("select count(*) as cnt from study_programs").fetchone()["cnt"]
            period_count = conn.execute("select count(*) as cnt from academic_periods").fetchone()["cnt"]
            bill_type_count = conn.execute("select count(*) as cnt from bill_types").fetchone()["cnt"]
            conn.close()

            self.assertGreaterEqual(prodi_count, 5)
            self.assertGreaterEqual(period_count, 2)
            self.assertGreaterEqual(bill_type_count, 3)

    def test_study_programs_crud(self) -> None:
        from Backend.app.services import create_study_program, delete_study_program, list_study_programs, update_study_program

        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            # Create
            created = create_study_program(database, {"code": "TIK", "name": "Teknik Informatika", "degree": "S1", "faculty": "FST"})
            self.assertEqual(created["code"], "TIK")
            self.assertEqual(created["name"], "Teknik Informatika")

            # List
            prodis = list_study_programs(database)
            self.assertTrue(any(p["code"] == "TIK" for p in prodis))

            # Update
            updated = update_study_program(database, created["id"], {"name": "S1 Teknik Informatika"})
            self.assertIsNotNone(updated)
            self.assertEqual(updated["name"], "S1 Teknik Informatika")

            # Delete
            deleted = delete_study_program(database, created["id"])
            self.assertTrue(deleted)
            prodis_after = list_study_programs(database)
            self.assertFalse(any(p["code"] == "TIK" for p in prodis_after))

    def test_academic_periods_crud(self) -> None:
        from Backend.app.services import create_academic_period, list_academic_periods, update_academic_period

        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            # Create
            created = create_academic_period(database, {"code": "20261", "name": "2026/2027 Ganjil", "semester_type": "ganjil", "is_active": 1, "default_due_date": "2026-09-30"})
            self.assertEqual(created["code"], "20261")
            self.assertEqual(created["is_active"], 1)

            # Check that only one period is active
            periods = list_academic_periods(database)
            active_periods = [p for p in periods if p["is_active"] == 1]
            self.assertEqual(len(active_periods), 1)
            self.assertEqual(active_periods[0]["code"], "20261")

            # Update
            updated = update_academic_period(database, created["id"], {"name": "2026/2027 Semester Ganjil"})
            self.assertIsNotNone(updated)
            self.assertEqual(updated["name"], "2026/2027 Semester Ganjil")

    def test_student_profile_360_detail(self) -> None:
        from Backend.app.services import create_bill, create_student, get_student_detail

        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            student = create_student(
                database,
                {
                    "nim": "050117099",
                    "full_name": "Rizky Firmansyah",
                    "program_study": "S1 Ilmu Hukum",
                    "academic_status": "aktif",
                    "entry_year": 2025,
                    "email": "rizky@example.com",
                    "address": "Jl. Sudirman No 10",
                    "phone_number": "081234567890",
                },
            )

            # Add two bills
            create_bill(database, {"nim": "050117099", "full_name": "Rizky Firmansyah", "briva": "17810001", "amount": 1000000, "period": "2025.1", "status": "paid"})
            create_bill(database, {"nim": "050117099", "full_name": "Rizky Firmansyah", "briva": "17810002", "amount": 1500000, "period": "2025.2", "status": "unpaid"})

            detail = get_student_detail(database, student["id"])
            self.assertIsNotNone(detail)
            self.assertEqual(detail["student"]["nim"], "050117099")
            self.assertEqual(detail["student"]["academic_status"], "aktif")
            self.assertEqual(detail["student"]["entry_year"], 2025)
            self.assertEqual(len(detail["bills"]), 2)
            self.assertEqual(detail["summary"]["total_amount"], 2500000)
            self.assertEqual(detail["summary"]["total_paid"], 1000000)
            self.assertEqual(detail["summary"]["total_outstanding"], 1500000)
            self.assertEqual(detail["summary"]["overall_status"], "unpaid")

    def test_student_filters_by_prodi_and_status(self) -> None:
        from Backend.app.services import create_student, list_students

        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            create_student(database, {"nim": "1001", "full_name": "Mhs Aktif Hukum", "program_study": "S1 Ilmu Hukum", "academic_status": "aktif", "entry_year": 2024})
            create_student(database, {"nim": "1002", "full_name": "Mhs Cuti Manajemen", "program_study": "S1 Manajemen", "academic_status": "cuti", "entry_year": 2025})

            # Filter by academic_status
            aktif_list = list_students(database, academic_status="aktif")
            self.assertTrue(any(s["nim"] == "1001" for s in aktif_list))
            self.assertFalse(any(s["nim"] == "1002" for s in aktif_list))

            # Filter by entry_year
            year_2025_list = list_students(database, entry_year=2025)
            self.assertTrue(any(s["nim"] == "1002" for s in year_2025_list))
            self.assertFalse(any(s["nim"] == "1001" for s in year_2025_list))

    def test_dashboard_stats_and_financial_summary(self) -> None:
        from Backend.app.services import create_bill, create_student, get_dashboard_stats, get_financial_summary

        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            create_student(database, {"nim": "2001", "full_name": "Student A", "program_study": "S1 Ilmu Hukum", "academic_status": "aktif"})
            create_student(database, {"nim": "2002", "full_name": "Student B", "program_study": "S1 Manajemen", "academic_status": "cuti"})

            create_bill(database, {"nim": "2001", "full_name": "Student A", "briva": "17810011", "amount": 2000000, "period": "2025.1", "status": "paid"})
            create_bill(database, {"nim": "2002", "full_name": "Student B", "briva": "17810012", "amount": 3000000, "period": "2025.1", "status": "unpaid"})

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

    def test_granular_rbac_roles(self) -> None:
        from Backend.app.config import ROLE_PERMISSIONS
        self.assertIn("manage_master_data", ROLE_PERMISSIONS["admin_akademik"])
        self.assertIn("manage_students", ROLE_PERMISSIONS["admin_akademik"])
        self.assertNotIn("import", ROLE_PERMISSIONS["admin_akademik"])

        self.assertIn("import", ROLE_PERMISSIONS["admin_keuangan"])
        self.assertIn("manage_billing", ROLE_PERMISSIONS["admin_keuangan"])
        self.assertNotIn("manage_master_data", ROLE_PERMISSIONS["admin_keuangan"])

        self.assertIn("view_reports", ROLE_PERMISSIONS["viewer"])
        self.assertNotIn("manage_data", ROLE_PERMISSIONS["viewer"])

        self.assertIn("manage_users", ROLE_PERMISSIONS["super_admin"])

    @staticmethod
    def _write_workbook(path: Path, rows: list[tuple[str, str, str, int]]) -> None:
        def inline(cell: str, value: str) -> str:
            return f'<c r="{cell}" t="inlineStr"><is><t>{value}</t></is></c>'

        def worksheet(headers: list[str], values: list[tuple[str, str, str, int]], issue_sheet: bool = False) -> str:
            columns = "ABCDEF"
            header_cells = "".join(inline(f"{column}1", value) for column, value in zip(columns, headers))
            data_rows = []
            for index, (nim, name, briva, amount) in enumerate(values, start=2):
                data_rows.append(
                    f'<row r="{index}">{inline(f"A{index}", str(index - 1))}{inline(f"B{index}", nim)}'
                    f'{inline(f"C{index}", name)}{inline(f"D{index}", briva)}<c r="E{index}"><v>{amount}</v></c>'
                    f'{inline(f"F{index}", "") if issue_sheet else ""}</row>'
                )
            return (
                '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
                f'<sheetData><row r="1">{header_cells}</row>{"".join(data_rows)}</sheetData></worksheet>'
            )

        workbook = (
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            '<sheets><sheet name="Data Sinkron" sheetId="1" r:id="rId1"/>'
            '<sheet name="Data Belum Lengkap" sheetId="2" r:id="rId2"/></sheets></workbook>'
        )
        relationships = (
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>'
            '</Relationships>'
        )
        with zipfile.ZipFile(path, "w") as archive:
            archive.writestr("xl/workbook.xml", workbook)
            archive.writestr("xl/_rels/workbook.xml.rels", relationships)
            archive.writestr("xl/worksheets/sheet1.xml", worksheet(["No.", "NIM", "Nama Mahasiswa", "BRIVA", "Jumlah"], rows))
            archive.writestr(
                "xl/worksheets/sheet2.xml",
                worksheet(["No.", "NIM", "Nama Mahasiswa", "BRIVA", "Jumlah", "Keterangan"], [], issue_sheet=True),
            )

    @staticmethod
    def _write_current_workbook(path: Path, rows: list[tuple[str, str, str, str, str, str, int, str]]) -> None:
        def inline(cell: str, value: str) -> str:
            return f'<c r="{cell}" t="inlineStr"><is><t>{value}</t></is></c>'

        headers = ["NIM", "Nama", "Registrasi Awal", " No  Hp ", "Program Studi", "No Rek", "Jumlah", "Batas Pembayaran"]
        columns = "ABCDEFGH"
        header_cells = "".join(inline(f"{column}1", value) for column, value in zip(columns, headers))
        data_rows = []
        for index, row in enumerate(rows, start=2):
            values = [str(value) for value in row]
            cells = "".join(
                f'<c r="{column}{index}"><v>{value}</v></c>' if column == "G" and value.isdigit() else inline(f"{column}{index}", value)
                for column, value in zip(columns, values)
            )
            data_rows.append(f'<row r="{index}">{cells}</row>')

        workbook = (
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            '<sheets><sheet name="customer_20260808" sheetId="1" r:id="rId1"/></sheets></workbook>'
        )
        relationships = (
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            '</Relationships>'
        )
        worksheet = (
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            f'<sheetData><row r="1">{header_cells}</row>{"".join(data_rows)}</sheetData></worksheet>'
        )
        with zipfile.ZipFile(path, "w") as archive:
            archive.writestr("xl/workbook.xml", workbook)
            archive.writestr("xl/_rels/workbook.xml.rels", relationships)
            archive.writestr("xl/worksheets/sheet1.xml", worksheet)


if __name__ == "__main__":
    unittest.main()
