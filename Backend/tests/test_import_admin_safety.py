from __future__ import annotations

import sys
import sqlite3
import tempfile
import threading
import zipfile
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path
from unittest import mock

import openpyxl

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

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
from Backend.tests.test_base import BackendBaseTestCase


class ImportAdminSafetyTests(BackendBaseTestCase):
    def test_commit_rejects_workbook_changed_after_preview(self) -> None:
        from Backend.app.security import hash_password
        from Backend.app.services import store_import_preview

        with tempfile.TemporaryDirectory() as temporary_directory:
            temp = Path(temporary_directory)
            database = temp / "salut.sqlite"
            imports = temp / "imports"
            imports.mkdir()
            token = "imp_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
            workbook = imports / f"{token}_changed.xlsx"
            self._write_workbook(workbook, [("01111", "File Berubah", "81111", 100000)])
            migrate_database(database)
            conn = connect(database)
            with conn:
                conn.execute(
                    "insert into admin_users (id, email, password_hash, role) values (?, ?, ?, ?)",
                    ("admin-changed", "changed@imp.test", hash_password("Password123!"), "admin"),
                )
            conn.close()

            original_db_path = app_config.DB_PATH
            original_import_dir = app_config.IMPORT_DIR
            app_config.DB_PATH = database
            app_config.IMPORT_DIR = imports
            client: TestClient | None = None
            try:
                store_import_preview(
                    token,
                    "admin-changed",
                    "changed.xlsx",
                    workbook,
                    file_sha256="0" * 64,
                    period_code="2026.2",
                    period_label="2026 Genap",
                    billing_year=2026,
                    semester_type="genap",
                )
                client = TestClient(server.app)
                client.post(
                    "/api/admin/login",
                    json={"email": "changed@imp.test", "password": "Password123!"},
                )
                response = client.post("/api/admin/import/commit", json={"import_token": token})
                self.assertEqual(response.status_code, 409)
                self.assertEqual(response.json()["error"]["code"], "IMPORT_FILE_CHANGED")
                verify = sqlite3.connect(database)
                try:
                    self.assertEqual(verify.execute("select count(*) from bills").fetchone()[0], 0)
                    self.assertEqual(
                        verify.execute("select count(*) from import_previews where token = ?", (token,)).fetchone()[0],
                        1,
                    )
                finally:
                    verify.close()
            finally:
                if client:
                    client.close()
                app_config.DB_PATH = original_db_path
                app_config.IMPORT_DIR = original_import_dir

    def test_preview_binds_period_and_commit_quarantines_critical_rows(self) -> None:
        from Backend.app.security import hash_password

        with tempfile.TemporaryDirectory() as temporary_directory:
            temp = Path(temporary_directory)
            database = temp / "salut.sqlite"
            imports = temp / "imports"
            imports.mkdir()
            workbook = temp / "period-bound.xlsx"
            self._write_workbook(
                workbook,
                [
                    ("01101", "Konflik API Satu", "80101", 100000),
                    ("01102", "Konflik API Dua", "80101", 100000),
                    ("01103", "Aman API", "80102", 125000),
                ],
            )
            migrate_database(database)
            conn = connect(database)
            with conn:
                conn.execute(
                    "insert into admin_users (id, email, password_hash, role) values (?, ?, ?, ?)",
                    ("admin-period", "period@imp.test", hash_password("Password123!"), "admin"),
                )
            conn.close()

            original_db_path = app_config.DB_PATH
            original_import_dir = app_config.IMPORT_DIR
            app_config.DB_PATH = database
            app_config.IMPORT_DIR = imports
            client: TestClient | None = None
            try:
                client = TestClient(server.app)
                login = client.post(
                    "/api/admin/login",
                    json={"email": "period@imp.test", "password": "Password123!"},
                )
                self.assertEqual(login.status_code, 200)
                with workbook.open("rb") as source:
                    preview_response = client.post(
                        "/api/admin/import/preview",
                        data={"billing_year": "2026", "semester_type": "genap"},
                        files={
                            "file": (
                                workbook.name,
                                source,
                                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                            )
                        },
                    )
                self.assertEqual(preview_response.status_code, 200)
                preview = preview_response.json()["data"]
                self.assertEqual(preview["period"]["code"], "2026.2")
                self.assertEqual(preview["period"]["label"], "2026 Genap")
                self.assertEqual(preview["critical_rows"], 2)
                self.assertEqual(preview["new_rows"], 1)
                self.assertEqual(preview["issues"][0]["severity"], "critical")

                issues_response = client.get(
                    f"/api/admin/import/previews/{preview['import_token']}/issues",
                    params={"severity": "critical"},
                )
                self.assertEqual(issues_response.status_code, 200)
                issue_data = issues_response.json()["data"]
                self.assertEqual(issue_data["pagination"]["total"], 2)
                self.assertEqual(issue_data["issues"][0]["nim"], "01101")

                committed_response = client.post(
                    "/api/admin/import/commit",
                    json={"import_token": preview["import_token"]},
                )
                self.assertEqual(committed_response.status_code, 200)
                committed = committed_response.json()["data"]
                self.assertEqual(committed["period"]["code"], "2026.2")
                self.assertEqual(committed["status"], "completed_with_issues")
                self.assertEqual(committed["created"], 1)
                self.assertEqual(committed["quarantined"], 2)

                verify = sqlite3.connect(database)
                try:
                    self.assertEqual(
                        verify.execute("select period from bills").fetchone()[0],
                        "2026.2",
                    )
                    self.assertEqual(verify.execute("select count(*) from import_issues").fetchone()[0], 2)
                finally:
                    verify.close()
            finally:
                if client:
                    client.close()
                app_config.DB_PATH = original_db_path
                app_config.IMPORT_DIR = original_import_dir

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

    def test_admin_import_commit_claim_allows_exactly_one_concurrent_request(self) -> None:
        from Backend.app.security import hash_password
        from Backend.app.services import store_import_preview

        with tempfile.TemporaryDirectory() as temporary_directory:
            temp = Path(temporary_directory)
            database = temp / "salut.sqlite"
            imports = temp / "imports"
            imports.mkdir()
            token = "imp_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
            workbook = imports / f"{token}_concurrent.xlsx"
            self._write_workbook(workbook, [("01013", "Concurrent Import", "81313", 100000)])

            conn = connect(database)
            init_db(conn)
            with conn:
                conn.execute(
                    "insert into admin_users (id, email, password_hash, role) values (?, ?, ?, ?)",
                    ("admin-concurrent", "concurrent@imp.test", hash_password("Password123!"), "admin"),
                )
            conn.close()

            original_db_path = app_config.DB_PATH
            original_import_dir = app_config.IMPORT_DIR
            app_config.DB_PATH = database
            app_config.IMPORT_DIR = imports
            clients: list[TestClient] = []
            try:
                store_import_preview(token, "admin-concurrent", "concurrent.xlsx", workbook)
                clients = [TestClient(server.app), TestClient(server.app)]
                for client in clients:
                    login = client.post(
                        "/api/admin/login",
                        json={"email": "concurrent@imp.test", "password": "Password123!"},
                    )
                    self.assertEqual(login.status_code, 200)

                preflight_barrier = threading.Barrier(2)
                import_calls = 0
                import_lock = threading.Lock()

                def preview_side_effect(*_args: object, **_kwargs: object) -> dict[str, object]:
                    preflight_barrier.wait(timeout=5)
                    return {"critical_rows": 0, "requires_update_confirmation": False}

                def import_side_effect(*_args: object, **_kwargs: object) -> dict[str, int]:
                    nonlocal import_calls
                    with import_lock:
                        import_calls += 1
                    return {"created": 1, "updated": 0}

                with (
                    mock.patch("Backend.app.routers.imports.preview_workbook", side_effect=preview_side_effect),
                    mock.patch("Backend.app.routers.imports.import_workbook", side_effect=import_side_effect),
                    ThreadPoolExecutor(max_workers=2) as executor,
                ):
                    futures = [
                        executor.submit(client.post, "/api/admin/import/commit", json={"import_token": token})
                        for client in clients
                    ]
                    responses = [future.result(timeout=10) for future in futures]

                self.assertEqual(sorted(response.status_code for response in responses), [200, 409])
                conflict = next(response for response in responses if response.status_code == 409)
                self.assertEqual(conflict.json()["error"]["code"], "IMPORT_ALREADY_PROCESSING")
                self.assertEqual(import_calls, 1)
                self.assertFalse(workbook.exists())
                verify = sqlite3.connect(database)
                try:
                    self.assertEqual(
                        verify.execute("select count(*) from import_previews where token = ?", (token,)).fetchone()[0],
                        0,
                    )
                finally:
                    verify.close()
            finally:
                for client in clients:
                    client.close()
                app_config.DB_PATH = original_db_path
                app_config.IMPORT_DIR = original_import_dir

    def test_import_claim_authorization_super_admin_and_expiry(self) -> None:
        from Backend.app.services import (
            claim_import_preview_for_admin,
            release_import_preview_claim,
            store_import_preview,
        )

        with tempfile.TemporaryDirectory() as temporary_directory:
            temp = Path(temporary_directory)
            database = temp / "salut.sqlite"
            workbook = temp / "claim.xlsx"
            workbook.touch()
            conn = connect(database)
            init_db(conn)
            with conn:
                conn.executemany(
                    "insert into admin_users (id, email, password_hash, role) values (?, ?, '', ?)",
                    [
                        ("claim-owner", "owner@claim.test", "admin"),
                        ("claim-other", "other@claim.test", "admin"),
                        ("claim-super", "super@claim.test", "super_admin"),
                    ],
                )
                admins = {
                    row["id"]: row
                    for row in conn.execute("select id, role from admin_users where id like 'claim-%'").fetchall()
                }
            conn.close()

            original_db_path = app_config.DB_PATH
            app_config.DB_PATH = database
            try:
                token = "imp_cccccccccccccccccccccccccccccccc"
                store_import_preview(token, "claim-owner", "claim.xlsx", workbook)
                self.assertIsNone(claim_import_preview_for_admin(token, admins["claim-other"]))
                super_claim = claim_import_preview_for_admin(token, admins["claim-super"])
                self.assertIsNotNone(super_claim)
                assert super_claim is not None
                self.assertTrue(release_import_preview_claim(token, str(super_claim["claim_id"])))

                expire = sqlite3.connect(database)
                try:
                    expire.execute(
                        "update import_previews set expires_at = datetime('now', '-1 second') where token = ?",
                        (token,),
                    )
                    expire.commit()
                finally:
                    expire.close()
                self.assertIsNone(claim_import_preview_for_admin(token, admins["claim-owner"]))
            finally:
                app_config.DB_PATH = original_db_path

    def test_failed_import_releases_claim_for_safe_retry(self) -> None:
        from Backend.app.security import hash_password
        from Backend.app.services import store_import_preview

        with tempfile.TemporaryDirectory() as temporary_directory:
            temp = Path(temporary_directory)
            database = temp / "salut.sqlite"
            imports = temp / "imports"
            imports.mkdir()
            token = "imp_dddddddddddddddddddddddddddddddd"
            workbook = imports / f"{token}_retry.xlsx"
            self._write_workbook(workbook, [("01014", "Retry Import", "81414", 100000)])

            conn = connect(database)
            init_db(conn)
            with conn:
                conn.execute(
                    "insert into admin_users (id, email, password_hash, role) values (?, ?, ?, ?)",
                    ("admin-retry", "retry@imp.test", hash_password("Password123!"), "admin"),
                )
            conn.close()

            original_db_path = app_config.DB_PATH
            original_import_dir = app_config.IMPORT_DIR
            app_config.DB_PATH = database
            app_config.IMPORT_DIR = imports
            client: TestClient | None = None
            try:
                store_import_preview(token, "admin-retry", "retry.xlsx", workbook)
                client = TestClient(server.app)
                client.post("/api/admin/login", json={"email": "retry@imp.test", "password": "Password123!"})
                preview = {"critical_rows": 0, "requires_update_confirmation": False}
                with (
                    mock.patch("Backend.app.routers.imports.preview_workbook", return_value=preview),
                    mock.patch(
                        "Backend.app.routers.imports.import_workbook",
                        side_effect=ValueError("simulated import failure"),
                    ),
                ):
                    failed = client.post("/api/admin/import/commit", json={"import_token": token})
                self.assertEqual(failed.status_code, 400)
                self.assertTrue(workbook.exists())
                verify = sqlite3.connect(database)
                try:
                    claim = verify.execute(
                        "select claim_id, claimed_at from import_previews where token = ?", (token,)
                    ).fetchone()
                finally:
                    verify.close()
                self.assertEqual(claim, (None, None))

                with (
                    mock.patch("Backend.app.routers.imports.preview_workbook", return_value=preview),
                    mock.patch(
                        "Backend.app.routers.imports.import_workbook",
                        return_value={"created": 1, "updated": 0},
                    ),
                ):
                    retried = client.post("/api/admin/import/commit", json={"import_token": token})
                self.assertEqual(retried.status_code, 200)
                self.assertFalse(workbook.exists())
            finally:
                if client:
                    client.close()
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
                    "000000001",
                    "MAHASISWA CONTOH SATU",
                    "0000000000000001",
                    "Kota Contoh",
                    "01 Januari 2000",
                    "Orang Tua Contoh",
                    "mahasiswa.satu@example.test",
                    "000000000001",
                    "UNIVERSITAS TERBUKA 2023.1",
                    "FEB - Akuntansi",
                    "000000000000001",
                    1850000,
                    "22 Januari 2027 Pukul 11.59 WIB",
                ),
                (
                    "000000002",
                    "MAHASISWA CONTOH DUA",
                    "-",
                    "-",
                    "-",
                    "-",
                    "mahasiswa.dua@example.test",
                    "'000000000002",
                    "UNIVERSITAS TERBUKA 2023.2",
                    "FHISIP - Sosiologi",
                    "000000000000002",
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
                "select nim, full_name, no_ktp, tempat_lahir, tanggal_lahir, nama_ibu_kandung, email, phone_number, entry_year, entry_semester, entry_period from students where nim = '000000001'"
            ).fetchone()
            s2 = conn.execute(
                "select nim, full_name, no_ktp, tempat_lahir, tanggal_lahir, nama_ibu_kandung, email, phone_number, entry_year, entry_semester, entry_period from students where nim = '000000002'"
            ).fetchone()
            conn.close()

            # Verify s1 has Title Case, demography, and parsed entry period
            self.assertEqual(
                s1,
                (
                    "000000001",
                    "Mahasiswa Contoh Satu",
                    "0000000000000001",
                    "Kota Contoh",
                    "01 Januari 2000",
                    "Orang Tua Contoh",
                    "mahasiswa.satu@example.test",
                    "000000000001",
                    2023,
                    "ganjil",
                    "2023.1",
                ),
            )
            # Verify s2 cleaned '-' to None and stripped apostrophe in phone number
            self.assertEqual(
                s2,
                (
                    "000000002",
                    "Mahasiswa Contoh Dua",
                    None,
                    None,
                    None,
                    None,
                    "mahasiswa.dua@example.test",
                    "000000000002",
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
        workbook = openpyxl.load_workbook(BytesIO(template_bytes), read_only=True, data_only=True)
        try:
            template_rows = list(workbook.active.iter_rows(min_row=2, values_only=True))
        finally:
            workbook.close()
        self.assertEqual(len(template_rows), 2)
        self.assertTrue(all(str(row[1]).startswith("Mahasiswa Contoh") for row in template_rows))
        self.assertTrue(all(str(row[6]).endswith("@example.test") for row in template_rows))

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
