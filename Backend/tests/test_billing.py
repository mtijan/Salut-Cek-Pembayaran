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
    list_bills,
    list_imported_bill_groups,
    summarize_payment_status,
    update_bill_status,
)
from import_excel import import_workbook
from db import connect, init_db, migrate_database
from fastapi.testclient import TestClient
from Backend.tests.test_base import BackendBaseTestCase


class BillingAndPaymentTests(BackendBaseTestCase):
    def test_payment_status_summary_accepts_partial_aliases(self) -> None:
        self.assertEqual(summarize_payment_status(["paid", "lunas sebagian"]), "partial")
        self.assertEqual(summarize_payment_status(["dicicil"]), "partial")
        self.assertEqual(summarize_payment_status(["paid", "lunas"]), "paid")

    def test_admin_bill_groups_and_status_update(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            temp = Path(temporary_directory)
            database = temp / "salut.sqlite"
            migrate_database(database)
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

            updated = update_bill_status(database, bill_id, "partial", paid_amount=62500)
            self.assertIsNotNone(updated)
            self.assertEqual(updated["status"], "partial")
            groups = list_imported_bill_groups(database)
            self.assertEqual(groups[0]["partial"], 1)

            updated = update_bill_status(database, bill_id, "paid")
            self.assertIsNotNone(updated)
            self.assertEqual(updated["status"], "paid")
            groups = list_imported_bill_groups(database)
            self.assertEqual(groups[0]["paid"], 1)

    def test_partial_status_requires_explicit_paid_amount(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            conn = connect(database)
            init_db(conn)
            conn.close()
            student = create_student(database, {"nim": "090000001", "full_name": "Nominal Wajib"})
            bill = create_bill(
                database,
                {
                    "student_id": student["id"],
                    "briva": "90000001",
                    "amount": 100000,
                    "period": "2026.1",
                    "status": "unpaid",
                },
            )

            with self.assertRaisesRegex(ValueError, "wajib diisi"):
                update_bill_status(database, bill["id"], "partial")

            unchanged = list_bills(database)[0]
            self.assertEqual(unchanged["status"], "unpaid")
            self.assertEqual(unchanged["paid_amount"], 0)

    def test_admin_bill_due_date_update(self) -> None:
        from Backend.app.services import update_bill_due_date, format_due_date

        with tempfile.TemporaryDirectory() as temporary_directory:
            temp = Path(temporary_directory)
            database = temp / "salut.sqlite"
            migrate_database(database)
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

            with self.assertRaisesRegex(ValueError, "Format tanggal"):
                update_bill_due_date(database, [bill_id], "2026-99-99")
            unchanged = list_imported_bill_groups(database)[0]["bills"][0]
            self.assertEqual(unchanged["due_date"], "2026-08-25")

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
                conn.execute("update bills set status = 'paid', source_file = 'Manual Admin' where id = 'bill-page-0'")
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

    def test_bills_page_uses_api_pagination_total(self) -> None:
        hook_path = Path(__file__).resolve().parents[2] / "Frontend-Admin" / "src" / "hooks" / "useBillsPage.js"
        source = (
            hook_path.read_text(encoding="utf-8")
            if hook_path.exists()
            else (Path(__file__).resolve().parents[2] / "Frontend-Admin" / "src" / "pages" / "BillsPage.jsx").read_text(
                encoding="utf-8"
            )
        )
        self.assertTrue("pagination" in source)
        self.assertTrue("Number(pagination.total)" in source or "Number(pageData.total)" in source)
        self.assertNotIn("setTotalCount(res.total_count || 0);", source)

    def test_payment_history_routes_apply_reporting_rbac_and_validation(self) -> None:
        from Backend.app.security import hash_password

        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            conn = connect(database)
            init_db(conn)
            with conn:
                for role in ("viewer", "admin", "super_admin"):
                    conn.execute(
                        "insert into admin_users (id, email, password_hash, full_name, role) values (?, ?, ?, ?, ?)",
                        (f"history-{role}", f"{role}@history.test", hash_password("Password123!"), role.title(), role),
                    )
            conn.close()

            student = create_student(database, {"nim": "090000002", "full_name": "Akses Riwayat"})
            bill = create_bill(
                database,
                {
                    "student_id": student["id"],
                    "briva": "90000002",
                    "amount": 100000,
                    "period": "2026.1",
                    "status": "unpaid",
                },
            )
            update_bill_status(database, bill["id"], "partial", paid_amount=40000)

            original_db_path = app_config.DB_PATH
            app_config.DB_PATH = database
            try:
                anonymous = TestClient(server.app)
                self.assertEqual(anonymous.get(f"/api/admin/bills/{bill['id']}/transactions").status_code, 401)

                for role in ("viewer", "admin", "super_admin"):
                    client = TestClient(server.app)
                    login = client.post(
                        "/api/admin/login",
                        json={"email": f"{role}@history.test", "password": "Password123!"},
                    )
                    self.assertEqual(login.status_code, 200)

                    bill_history = client.get(f"/api/admin/bills/{bill['id']}/transactions")
                    student_history = client.get(f"/api/admin/students/{student['id']}/transactions")
                    self.assertEqual(bill_history.status_code, 200)
                    self.assertEqual(student_history.status_code, 200)
                    self.assertEqual(bill_history.json()["data"]["pagination"]["total"], 1)

                client = TestClient(server.app)
                client.post(
                    "/api/admin/login",
                    json={"email": "super_admin@history.test", "password": "Password123!"},
                )
                self.assertEqual(client.get("/api/admin/bills/not-found/transactions").status_code, 404)
                self.assertEqual(client.get("/api/admin/students/not-found/transactions").status_code, 404)
                self.assertEqual(
                    client.get(f"/api/admin/bills/{bill['id']}/transactions?limit=invalid").status_code, 400
                )
                self.assertEqual(
                    client.get(f"/api/admin/students/{student['id']}/transactions?offset=invalid").status_code, 400
                )
            finally:
                app_config.DB_PATH = original_db_path

    def test_bill_status_api_rejects_partial_without_paid_amount(self) -> None:
        from Backend.app.security import hash_password

        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            conn = connect(database)
            init_db(conn)
            with conn:
                conn.execute(
                    "insert into admin_users (id, email, password_hash, role) values (?, ?, ?, ?)",
                    ("partial-api", "partial@api.test", hash_password("Password123!"), "admin"),
                )
            conn.close()
            student = create_student(database, {"nim": "090000003", "full_name": "API Partial"})
            bill = create_bill(
                database,
                {
                    "student_id": student["id"],
                    "briva": "90000003",
                    "amount": 100000,
                    "period": "2026.1",
                    "status": "unpaid",
                },
            )

            original_db_path = app_config.DB_PATH
            app_config.DB_PATH = database
            try:
                client = TestClient(server.app)
                login = client.post("/api/admin/login", json={"email": "partial@api.test", "password": "Password123!"})
                self.assertEqual(login.status_code, 200)
                rejected = client.post("/api/admin/bills/status", json={"bill_id": bill["id"], "status": "partial"})
                self.assertEqual(rejected.status_code, 400)
                self.assertEqual(rejected.json()["error"]["code"], "VALIDATION_ERROR")

                accepted = client.post(
                    "/api/admin/bills/status",
                    json={"bill_id": bill["id"], "status": "partial", "paid_amount": 40000},
                )
                self.assertEqual(accepted.status_code, 200)
                self.assertEqual(accepted.json()["data"]["bill"]["paid_amount"], 40000)
            finally:
                app_config.DB_PATH = original_db_path

    def test_payment_transaction_ledger_rejects_update_and_delete(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            migrate_database(database)
            student = create_student(database, {"nim": "20260002", "full_name": "Mahasiswa Ledger"})
            bill = create_bill(
                database, {"student_id": student["id"], "briva": "BRIVA-LEDGER", "amount": 100000, "period": "2026.1"}
            )
            update_bill_status(database, bill["id"], "paid", recorded_by="operator-1")
            conn = connect(database)
            transaction = conn.execute(
                "select id from payment_transactions where bill_id = ?", (bill["id"],)
            ).fetchone()
            with self.assertRaises(sqlite3.DatabaseError):
                conn.execute("update payment_transactions set notes = 'ubah' where id = ?", (transaction["id"],))
            with self.assertRaises(sqlite3.DatabaseError):
                conn.execute("delete from payment_transactions where id = ?", (transaction["id"],))
            conn.close()

    def test_admin_bills_rich_filters_and_sorting(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "test.sqlite"
            with mock.patch("Backend.app.config.DB_PATH", database):
                from Backend.app.main import app
                from Backend.app.services import list_study_programs, create_student, create_bill

                conn = connect(database)
                init_db(conn)
                prodis = list_study_programs(database)
                p1 = prodis[0]
                p2 = prodis[1]

                # Create students with different prodis and entry periods
                st1 = create_student(
                    database,
                    {
                        "nim": "01001",
                        "full_name": "Mahasiswa Satu",
                        "study_program_id": p1["id"],
                        "entry_period": "2024.1",
                    },
                )
                st2 = create_student(
                    database,
                    {
                        "nim": "02002",
                        "full_name": "Mahasiswa Dua",
                        "study_program_id": p2["id"],
                        "entry_period": "2025.2",
                    },
                )

                # Create bills
                create_bill(
                    database,
                    {
                        "student_id": st1["id"],
                        "briva": "1111",
                        "amount": 1000000,
                        "period": "2025.1",
                        "bill_type": "UKT",
                    },
                )
                create_bill(
                    database,
                    {
                        "student_id": st2["id"],
                        "briva": "2222",
                        "amount": 2500000,
                        "period": "2025.2",
                        "bill_type": "WISUDA",
                    },
                )
                conn.close()

                fake_admin = {"id": "admin-1", "email": "admin@salut.id", "role": "admin", "full_name": "Admin Test"}
                with mock.patch("Backend.app.main.find_admin_by_session", return_value=fake_admin):
                    client = TestClient(app)
                    try:
                        # 1. Filter by study program
                        res_prodi = client.get(f"/api/admin/bills?study_program_id={p1['id']}")
                        self.assertEqual(res_prodi.status_code, 200)
                        bills_p = res_prodi.json()["data"]["bills"]
                        self.assertEqual(len(bills_p), 1)
                        self.assertEqual(bills_p[0]["nim"], "01001")

                        # 2. Filter by period
                        res_period = client.get("/api/admin/bills?period=2025.2")
                        self.assertEqual(res_period.status_code, 200)
                        bills_per = res_period.json()["data"]["bills"]
                        self.assertEqual(len(bills_per), 1)
                        self.assertEqual(bills_per[0]["period"], "2025.2")

                        # 3. Filter by bill type
                        res_type = client.get("/api/admin/bills?bill_type=WISUDA")
                        self.assertEqual(res_type.status_code, 200)
                        bills_t = res_type.json()["data"]["bills"]
                        self.assertEqual(len(bills_t), 1)
                        self.assertEqual(bills_t[0]["bill_type"], "WISUDA")

                        # 4. Filter by student entry_period
                        res_entry = client.get("/api/admin/bills?entry_period=2024.1")
                        self.assertEqual(res_entry.status_code, 200)
                        bills_e = res_entry.json()["data"]["bills"]
                        self.assertEqual(len(bills_e), 1)
                        self.assertEqual(bills_e[0]["nim"], "01001")

                        # 5. Sort by amount desc
                        res_sort = client.get("/api/admin/bills?sort_by=amount_desc")
                        self.assertEqual(res_sort.status_code, 200)
                        bills_s = res_sort.json()["data"]["bills"]
                        self.assertEqual(len(bills_s), 2)
                        self.assertEqual(bills_s[0]["amount"], 2500000)
                        self.assertEqual(bills_s[1]["amount"], 1000000)
                    finally:
                        client.close()


if __name__ == "__main__":
    unittest.main()
