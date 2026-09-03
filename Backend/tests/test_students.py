from __future__ import annotations

import sys
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import server
from Backend.app import config as app_config
from Backend.app.services import (
    create_bill,
    create_student,
    delete_student,
    get_student_detail,
    list_bills,
    list_students,
)
from db import connect, init_db, migrate_database
from fastapi.testclient import TestClient
from Backend.tests.test_base import BackendBaseTestCase


class StudentManagementTests(BackendBaseTestCase):
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
            self.assertEqual(
                set(result["data"]["student"]),
                {"nim", "full_name", "program_study", "payment_period", "due_date", "due_date_formatted"},
            )
            self.assertEqual([bill["bill_label"] for bill in result["data"]["bills"]], ["Tagihan 1", "Tagihan 2"])

    def test_lookup_rejects_letters_instead_of_silently_stripping_them(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            conn = connect(database)
            init_db(conn)
            with conn:
                conn.execute(
                    "insert into students (id, nim, full_name, name_norm) values (?, ?, ?, ?)",
                    ("student-strict-nim", "050117077", "Mahasiswa Valid", "mahasiswa valid"),
                )
            conn.close()

            with mock.patch.object(app_config, "DB_PATH", database):
                response = TestClient(server.app).post("/api/lookup", json={"nim": "ABC-050117077"})

            self.assertEqual(response.status_code, 400)
            result = response.json()
            self.assertFalse(result["success"])
            self.assertEqual(result["error"]["code"], "VALIDATION_ERROR")
            self.assertIn("NIM hanya boleh", result["error"]["message"])

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
                        (
                            "bill-import-api",
                            student_id,
                            "70002",
                            150000,
                            "Semester Ganjil 2026",
                            "UKT BRIVA",
                            "Bayar",
                            "api-import.xlsx",
                            2,
                        ),
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

    def test_soft_delete_student_and_bill(self) -> None:
        from Backend.app.services import create_student, create_bill, delete_student, delete_bill

        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            conn = connect(database)
            init_db(conn)
            conn.close()

            student = create_student(database, "050999888", "Mahasiswa Soft Delete")
            bill = create_bill(
                database,
                {
                    "nim": "050999888",
                    "full_name": "Mahasiswa Soft Delete",
                    "briva": "999888",
                    "amount": 500000,
                    "period": "2026.1",
                },
            )

            self.assertEqual(len(list_students(database)), 1)
            self.assertEqual(len(list_bills(database)), 1)

            deleted = delete_bill(database, bill["id"], actor_id="admin-1", reason="Salah entri")
            self.assertIsNotNone(deleted)
            self.assertEqual(len(list_bills(database)), 0)

            deleted_st = delete_student(database, student["id"], actor_id="admin-1", reason="Pengunduran diri")
            self.assertIsNotNone(deleted_st)
            self.assertEqual(len(list_students(database)), 0)

            conn = sqlite3.connect(database)
            st_row = conn.execute(
                "select deleted_at, delete_reason from students where id = ?", (student["id"],)
            ).fetchone()
            conn.close()
            self.assertIsNotNone(st_row[0])
            self.assertEqual(st_row[1], "Pengunduran diri")

    def test_student_domain_validation_rejects_invalid_nim_status_and_calendar_date(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            with self.assertRaisesRegex(ValueError, "NIM hanya boleh"):
                create_student(database, {"nim": "NIM-2026", "full_name": "Invalid NIM"})
            with self.assertRaisesRegex(ValueError, "Status akademik"):
                create_student(
                    database, {"nim": "20260003", "full_name": "Invalid Status", "academic_status": "sembarang"}
                )
            with self.assertRaisesRegex(ValueError, "Format tanggal"):
                create_bill(
                    database,
                    {
                        "nim": "20260004",
                        "full_name": "Invalid Date",
                        "briva": "BRIVA-DATE",
                        "amount": 100000,
                        "period": "2026.1",
                        "due_date": "2026-99-99",
                    },
                )

    def test_recreate_soft_deleted_student_restores_existing_nim(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            migrate_database(database)
            original = create_student(database, {"nim": "20260001", "full_name": "Mahasiswa Lama"})
            deleted = delete_student(database, original["id"], reason="Data duplikat")
            self.assertIsNotNone(deleted)

            restored = create_student(database, {"nim": "20260001", "full_name": "Mahasiswa Dipulihkan"})
            self.assertEqual(restored["id"], original["id"])
            conn = connect(database)
            row = conn.execute(
                "select full_name, deleted_at, deleted_by, delete_reason from students where id = ?", (original["id"],)
            ).fetchone()
            conn.close()
            self.assertEqual(row["full_name"], "Mahasiswa Dipulihkan")
            self.assertIsNone(row["deleted_at"])
            self.assertIsNone(row["deleted_by"])
            self.assertIsNone(row["delete_reason"])

    def test_student_profile_360_detail(self) -> None:
        from Backend.app.services import create_bill, create_student

        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            migrate_database(database)
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
            create_bill(
                database,
                {
                    "nim": "050117099",
                    "full_name": "Rizky Firmansyah",
                    "briva": "17810001",
                    "amount": 1000000,
                    "period": "2025.1",
                    "status": "paid",
                },
            )
            create_bill(
                database,
                {
                    "nim": "050117099",
                    "full_name": "Rizky Firmansyah",
                    "briva": "17810002",
                    "amount": 1500000,
                    "period": "2025.2",
                    "status": "unpaid",
                },
            )

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
        from Backend.app.services import create_student

        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            migrate_database(database)
            create_student(
                database,
                {
                    "nim": "1001",
                    "full_name": "Mhs Aktif Hukum",
                    "program_study": "S1 Ilmu Hukum",
                    "academic_status": "aktif",
                    "entry_year": 2024,
                },
            )
            create_student(
                database,
                {
                    "nim": "1002",
                    "full_name": "Mhs Cuti Manajemen",
                    "program_study": "S1 Manajemen",
                    "academic_status": "cuti",
                    "entry_year": 2025,
                },
            )

            # Filter by academic_status
            aktif_list = list_students(database, academic_status="aktif")
            self.assertTrue(any(s["nim"] == "1001" for s in aktif_list))
            self.assertFalse(any(s["nim"] == "1002" for s in aktif_list))

            # Filter by entry_year
            year_2025_list = list_students(database, entry_year=2025)
            self.assertTrue(any(s["nim"] == "1002" for s in year_2025_list))
            self.assertFalse(any(s["nim"] == "1001" for s in year_2025_list))

    def test_list_students_supports_pagination_limit_and_offset(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            conn = connect(database)
            init_db(conn)
            conn.close()

            for i in range(1, 6):
                create_student(
                    database,
                    {
                        "nim": f"900{i}",
                        "full_name": f"Mahasiswa {i}",
                        "program_study": "S1 Akuntansi",
                        "academic_status": "aktif",
                    },
                )

            first_page = list_students(database, limit=2, offset=0)
            second_page = list_students(database, limit=2, offset=2)
            third_page = list_students(database, limit=2, offset=4)

            self.assertEqual(len(first_page), 2)
            self.assertEqual([s["nim"] for s in first_page], ["9001", "9002"])
            self.assertEqual(len(second_page), 2)
            self.assertEqual([s["nim"] for s in second_page], ["9003", "9004"])
            self.assertEqual(len(third_page), 1)
            self.assertEqual([s["nim"] for s in third_page], ["9005"])


if __name__ == "__main__":
    unittest.main()
