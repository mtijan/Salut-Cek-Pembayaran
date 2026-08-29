from __future__ import annotations

import sys
import sqlite3
import tempfile
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import server
from Backend.app import config as app_config
from Backend.app.services import (
    create_student,
    get_student_detail,
    list_students,
)
from import_excel import import_workbook, preview_workbook
from db import connect, init_db, migrate_database
from fastapi.testclient import TestClient
from Backend.test_base import BackendBaseTestCase


class ImportAdminSafetyTests(BackendBaseTestCase):
    def test_current_customer_workbook_cleans_excel_markers_without_changing_due_date(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            temp = Path(temporary_directory)
            database = temp / "salut.sqlite"
            migrate_database(database)
            workbook = temp / "customer_markers.xlsx"
            self._write_current_workbook(
                workbook,
                [
                    (
                        "`01010",
                        "' Dini Putri",
                        "`UT Serang/2025-Ganjil",
                        "`0812-3456-7890",
                        "'FST - Sistem Informasi",
                        "`178100023200891",
                        "Rp 1.850.000",
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
            self.assertEqual(
                student, ("01010", "Dini Putri", "UT Serang/2025-Ganjil", "081234567890", "FST - Sistem Informasi")
            )
            self.assertEqual(bill, ("178100023200891", 1850000, "07 Agustus 2026 Pukul 11.59 WIB"))

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
                res = client.post(
                    "/api/admin/import/commit", json={"import_token": "imp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}
                )
                self.assertEqual(res.status_code, 404)
                self.assertTrue(workbook.exists())
            finally:
                app_config.DB_PATH = original_db_path
                app_config.IMPORT_DIR = original_import_dir

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

    def test_master_data_13_columns_import_and_period_parsing(self) -> None:
        from Backend.excel_reader import normalize_imported_name
        from Backend.db import parse_entry_registration

        # Test Title Case Normalization
        self.assertEqual(normalize_imported_name("MUHAMAD ROMLI"), "Muhamad Romli")
        self.assertEqual(normalize_imported_name("   riyanita   meirina   "), "Riyanita Meirina")

        # Test Entry Period Parsing (Tahun.1 = Ganjil, Tahun.2 = Genap)
        self.assertEqual(parse_entry_registration("UNIVERSITAS TERBUKA 2023.1"), (2023, "ganjil", "2023.1"))
        self.assertEqual(parse_entry_registration("UNIVERSITAS TERBUKA 2023.2"), (2023, "genap", "2023.2"))
        self.assertEqual(parse_entry_registration("2024.1"), (2024, "ganjil", "2024.1"))
        self.assertEqual(parse_entry_registration("2025.2"), (2025, "genap", "2025.2"))

        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            migrate_database(database)
            workbook = Path(temporary_directory) / "MASTER_DATA_TEST.xlsx"

            rows = [
                (
                    "049530265",
                    "MUHAMAD ROMLI",
                    "3603100510860014",
                    "Tangerang",
                    "14 September 2000",
                    "Siti Aminah",
                    "rhomly0496@gmail.com",
                    "082310867195",
                    "UNIVERSITAS TERBUKA 2023.1",
                    "FEB - Akuntansi",
                    "178100023200085",
                    1850000,
                    "22 Januari 2027 Pukul 11.59 WIB",
                ),
                (
                    "049532688",
                    "RIA ANGGRAENI",
                    "-",
                    "-",
                    "-",
                    "-",
                    "riaa1390@gmail.com",
                    "'0895411921596",
                    "UNIVERSITAS TERBUKA 2023.2",
                    "FHISIP - Sosiologi",
                    "178100023200060",
                    1850000,
                    "22 Januari 2027 Pukul 11.59 WIB",
                ),
            ]
            self._write_master_13_workbook(workbook, rows)

            preview = preview_workbook(workbook, database)
            self.assertEqual(preview["valid_rows"], 2)
            self.assertEqual(preview["critical_rows"], 0)

            result = import_workbook(workbook, database)
            self.assertEqual(result["created"], 2)

            conn = sqlite3.connect(database)
            s1 = conn.execute(
                "select nim, full_name, no_ktp, tempat_lahir, tanggal_lahir, nama_ibu_kandung, email, phone_number, entry_year, entry_semester, entry_period from students where nim = '049530265'"
            ).fetchone()
            s2 = conn.execute(
                "select nim, full_name, no_ktp, tempat_lahir, tanggal_lahir, nama_ibu_kandung, email, phone_number, entry_year, entry_semester, entry_period from students where nim = '049532688'"
            ).fetchone()
            conn.close()

            # Verify s1 has Title Case, demography, and parsed entry period
            self.assertEqual(
                s1,
                (
                    "049530265",
                    "Muhamad Romli",
                    "3603100510860014",
                    "Tangerang",
                    "14 September 2000",
                    "Siti Aminah",
                    "rhomly0496@gmail.com",
                    "082310867195",
                    2023,
                    "ganjil",
                    "2023.1",
                ),
            )
            # Verify s2 cleaned '-' to None and stripped apostrophe in phone number
            self.assertEqual(
                s2,
                (
                    "049532688",
                    "Ria Anggraeni",
                    None,
                    None,
                    None,
                    None,
                    "riaa1390@gmail.com",
                    "0895411921596",
                    2023,
                    "genap",
                    "2023.2",
                ),
            )

    def test_master_data_template_download_and_api_filters(self) -> None:
        from Backend.app.security import hash_password
        from Backend.import_excel import generate_master_data_template

        # Test Template Generator
        template_bytes = generate_master_data_template()
        self.assertTrue(len(template_bytes) > 100)

        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            conn = connect(database)
            init_db(conn)
            with conn:
                conn.execute(
                    "insert into admin_users (id, email, password_hash, full_name, role) values (?, ?, ?, ?, ?)",
                    ("admin-m", "master@example.test", hash_password("PasswordBaru123!"), "Admin Master", "admin"),
                )
            conn.close()

            s1 = create_student(
                database,
                {
                    "nim": "0301",
                    "full_name": "andi saputra",
                    "no_ktp": "32010101",
                    "entry_period": "2024.1",
                    "initial_registration": "UNIVERSITAS TERBUKA 2024.1",
                    "email": "andi@test.com",
                },
            )
            create_student(
                database,
                {
                    "nim": "0302",
                    "full_name": "budi santoso",
                    "no_ktp": "32010102",
                    "entry_period": "2023.2",
                    "initial_registration": "UNIVERSITAS TERBUKA 2023.2",
                    "email": "budi@test.com",
                },
            )

            # Verify sorting by entry_period
            sorted_asc = list_students(database, sort_by="entry_period_asc")
            self.assertEqual([s["nim"] for s in sorted_asc], ["0302", "0301"])

            sorted_desc = list_students(database, sort_by="entry_period_desc")
            self.assertEqual([s["nim"] for s in sorted_desc], ["0301", "0302"])

            # Verify filter by entry_period
            filtered = list_students(database, entry_period="2024.1")
            self.assertEqual(len(filtered), 1)
            self.assertEqual(filtered[0]["nim"], "0301")

            # Verify search by KTP
            ktp_search = list_students(database, query="32010102")
            self.assertEqual(len(ktp_search), 1)
            self.assertEqual(ktp_search[0]["nim"], "0302")

            # Verify 360 detail contains entry_period and formatted label
            detail = get_student_detail(database, s1["id"])
            self.assertEqual(detail["student"]["entry_period"], "2024.1")
            self.assertEqual(detail["student"]["entry_period_formatted"], "2024.1 (Ganjil)")

            # Test Template download API
            original_db_path = app_config.DB_PATH
            app_config.DB_PATH = database
            try:
                client = TestClient(server.app)
                login = client.post(
                    "/api/admin/login", json={"email": "master@example.test", "password": "PasswordBaru123!"}
                )
                self.assertIn("salut_admin_session", login.cookies)

                resp = client.get("/api/admin/template/master-data")
                self.assertEqual(resp.status_code, 200)
                self.assertIn("application/vnd.openxmlformats", resp.headers["content-type"])
            finally:
                app_config.DB_PATH = original_db_path
