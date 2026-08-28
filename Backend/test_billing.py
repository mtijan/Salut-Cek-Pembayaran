from __future__ import annotations

import sys
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))

import server
from Backend.app import config as app_config
from Backend.app.services import (
    create_bill,
    create_student,
    get_bill_detail,
    get_student_detail,
    list_bills,
    list_imported_bill_groups,
    list_payment_transactions,
    record_bill_payment,
    summarize_payment_status,
    update_bill,
    update_bill_status,
    bill_row_to_dict,
)
from import_excel import import_workbook
from db import connect, init_db, migrate_database
from fastapi.testclient import TestClient
from Backend.test_base import BackendBaseTestCase


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
        hook_path = Path(__file__).resolve().parents[1] / "Frontend-Admin" / "src" / "hooks" / "useBillsPage.js"
        source = (
            hook_path.read_text(encoding="utf-8")
            if hook_path.exists()
            else (Path(__file__).resolve().parents[1] / "Frontend-Admin" / "src" / "pages" / "BillsPage.jsx").read_text(
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

    def test_bill_edit_retains_student_and_supports_partial_payment(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            conn = connect(database)
            init_db(conn)
            conn.close()

            # 1. Create a student and bill
            st = create_student(database, {"nim": "050117077", "full_name": "Syahla Taqiyyah"})
            bill = create_bill(
                database,
                {
                    "student_id": st["id"],
                    "briva": "178100023200040",
                    "amount": 2000000,
                    "period": "20251",
                    "bill_type": "UKT",
                    "status": "unpaid",
                },
            )
            self.assertIsNotNone(bill)
            self.assertEqual(bill["nim"], "050117077")
            self.assertEqual(bill["status"], "unpaid")
            self.assertEqual(bill["paid_amount"], 0)

            # 2. Update bill without sending nim/full_name, setting status to partial
            updated = update_bill(
                database,
                bill["id"],
                {
                    "briva": "178100023200040",
                    "amount": 2000000,
                    "paid_amount": 1200000,
                    "period": "20251",
                    "bill_type": "UKT",
                    "status": "partial",
                },
            )
            self.assertIsNotNone(updated)
            self.assertEqual(updated["nim"], "050117077")
            self.assertEqual(updated["status"], "partial")
            self.assertEqual(updated["paid_amount"], 1200000)

            # Verify dictionary formatting
            b_dict = bill_row_to_dict(updated)
            self.assertEqual(b_dict["paid_amount"], 1200000)
            self.assertEqual(b_dict["paid_amount_formatted"], "Rp 1.200.000")
            self.assertEqual(b_dict["remaining_amount"], 800000)
            self.assertEqual(b_dict["remaining_amount_formatted"], "Rp 800.000")

            # 3. Test validation errors on partial payment
            with self.assertRaises(ValueError):
                # paid_amount >= amount
                update_bill(
                    database,
                    bill["id"],
                    {
                        "briva": "178100023200040",
                        "amount": 2000000,
                        "paid_amount": 2000000,
                        "period": "20251",
                        "status": "partial",
                    },
                )

            with self.assertRaises(ValueError):
                # paid_amount <= 0
                update_bill(
                    database,
                    bill["id"],
                    {
                        "briva": "178100023200040",
                        "amount": 2000000,
                        "paid_amount": 0,
                        "period": "20251",
                        "status": "partial",
                    },
                )

            # 4. Update bill status to paid automatically sets paid_amount = amount
            paid_row = update_bill_status(database, bill["id"], "paid")
            self.assertIsNotNone(paid_row)
            self.assertEqual(paid_row["status"], "paid")
            self.assertEqual(paid_row["paid_amount"], 2000000)
            paid_dict = bill_row_to_dict(paid_row)
            self.assertEqual(paid_dict["remaining_amount"], 0)

            # 5. Check custom period auto-registration
            custom_bill = create_bill(
                database,
                {
                    "student_id": st["id"],
                    "briva": "178100023200041",
                    "amount": 500000,
                    "period": "20261",
                    "bill_type": "WISUDA",
                    "status": "unpaid",
                },
            )
            self.assertIsNotNone(custom_bill)
            self.assertEqual(custom_bill["period"], "20261")

            conn = connect(database)
            period_row = conn.execute("select * from academic_periods where code = '20261'").fetchone()
            conn.close()
            self.assertIsNotNone(period_row)
            self.assertEqual(period_row["code"], "20261")

    def test_payment_transactions_history_recording_and_retrieval(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "test.sqlite"
            conn = connect(database)
            init_db(conn)
            conn.execute(
                "insert into admin_users (id, email, password_hash, full_name, role) values (?, ?, ?, ?, ?)",
                ("admin-123", "admin@salut.id", "hash", "Admin SALUT", "admin"),
            )
            conn.commit()
            conn.close()

            student = create_student(
                database,
                {
                    "nim": "099887766",
                    "full_name": "Budi Santoso",
                    "program_study": "S1 Ilmu Hukum",
                },
            )

            bill = create_bill(
                database,
                {
                    "student_id": student["id"],
                    "briva": "178100023299999",
                    "amount": 2000000,
                    "paid_amount": 0,
                    "period": "20251",
                    "status": "unpaid",
                },
            )

            # 1. Update status to partial (Bayar 1.000.000)
            updated = update_bill_status(
                database,
                bill["id"],
                "partial",
                paid_amount=1000000,
                recorded_by="admin-123",
                payment_date="2026-08-20",
                reference_number="BRI-REF-001",
                notes="Cicilan pertama",
            )
            self.assertIsNotNone(updated)
            self.assertEqual(updated["status"], "partial")
            self.assertEqual(updated["paid_amount"], 1000000)

            # 2. Check transaction log recorded
            txs = list_payment_transactions(database, bill_id=bill["id"])
            self.assertEqual(txs["pagination"]["total"], 1)
            t1 = txs["transactions"][0]
            self.assertEqual(t1["transaction_type"], "payment")
            self.assertEqual(t1["amount"], 1000000)
            self.assertEqual(t1["running_paid_total"], 1000000)
            self.assertEqual(t1["previous_status"], "unpaid")
            self.assertEqual(t1["new_status"], "partial")
            self.assertEqual(t1["recorded_by"], "admin-123")
            self.assertEqual(t1["payment_date"], "2026-08-20")
            self.assertEqual(t1["reference_number"], "BRI-REF-001")
            self.assertEqual(t1["notes"], "Cicilan pertama")

            # 3. Update status to paid (Pelunasan sisa)
            updated2 = update_bill_status(database, bill["id"], "paid", recorded_by="admin-123")
            self.assertEqual(updated2["status"], "paid")
            self.assertEqual(updated2["paid_amount"], 2000000)

            txs2 = list_payment_transactions(database, bill_id=bill["id"])
            self.assertEqual(txs2["pagination"]["total"], 2)
            t2 = txs2["transactions"][0]  # newest first
            self.assertEqual(t2["transaction_type"], "payment")
            self.assertEqual(t2["amount"], 1000000)  # delta was 2.000.000 - 1.000.000
            self.assertEqual(t2["running_paid_total"], 2000000)
            self.assertEqual(t2["previous_status"], "partial")
            self.assertEqual(t2["new_status"], "paid")

            # 4. Student 360 detail includes payment_history
            detail = get_student_detail(database, student["id"])
            self.assertIsNotNone(detail)
            self.assertIn("payment_history", detail)
            self.assertEqual(len(detail["payment_history"]), 2)
            self.assertEqual(detail["payment_history_pagination"]["total"], 2)

    def test_payment_metadata_rejects_invalid_date_and_oversized_text(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "test.sqlite"
            migrate_database(database)
            student = create_student(database, {"nim": "088776655", "full_name": "Metadata Test"})
            bill = create_bill(
                database, {"student_id": student["id"], "briva": "BRIVA-META", "amount": 100000, "period": "2026.1"}
            )
            with self.assertRaisesRegex(ValueError, "Format tanggal"):
                update_bill_status(database, bill["id"], "paid", payment_date="2026-99-99")
            with self.assertRaisesRegex(ValueError, "Nomor referensi maksimal"):
                update_bill_status(database, bill["id"], "paid", reference_number="x" * 101)
            with self.assertRaisesRegex(ValueError, "Catatan pembayaran maksimal"):
                update_bill_status(database, bill["id"], "paid", notes="x" * 1001)

    def test_bill_detail_and_incremental_payments(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "test.sqlite"
            migrate_database(database)
            student = create_student(database, {"nim": "099112233", "full_name": "Bayar Bertahap Test"})
            bill = create_bill(
                database,
                {"student_id": student["id"], "briva": "17810009999", "amount": 1500000, "period": "2026.1"},
            )

            # 1. Fetch detail for new bill
            detail = get_bill_detail(database, bill["id"])
            self.assertIsNotNone(detail)
            self.assertEqual(detail["bill"]["amount"], 1500000)
            self.assertEqual(detail["bill"]["paid_amount"], 0)
            self.assertEqual(detail["bill"]["remaining_amount"], 1500000)
            self.assertEqual(detail["bill"]["status"], "unpaid")
            self.assertEqual(detail["student"]["nim"], "099112233")
            self.assertEqual(len(detail["transactions"]), 0)

            # 2. First partial payment: 500.000
            res1 = record_bill_payment(
                database,
                bill["id"],
                {
                    "payment_amount": 500000,
                    "payment_date": "2026-08-25",
                    "payment_method": "BRIVA",
                    "reference_number": "TRX-001",
                    "notes": "Cicilan ke-1",
                },
                actor_id="admin-test",
            )
            self.assertEqual(res1["bill"]["paid_amount"], 500000)
            self.assertEqual(res1["bill"]["remaining_amount"], 1000000)
            self.assertEqual(res1["bill"]["status"], "partial")
            self.assertEqual(len(res1["transactions"]), 1)
            self.assertEqual(res1["transactions"][0]["amount"], 500000)
            self.assertEqual(res1["transactions"][0]["running_paid_total"], 500000)
            self.assertEqual(res1["transactions"][0]["new_status"], "partial")

            # 3. Reject payment exceeding remaining balance
            with self.assertRaisesRegex(ValueError, "melebihi sisa tagihan"):
                record_bill_payment(
                    database,
                    bill["id"],
                    {"payment_amount": 1000001},
                    actor_id="admin-test",
                )

            # 4. Second partial payment: 1.000.000 (pays remaining balance)
            res2 = record_bill_payment(
                database,
                bill["id"],
                {
                    "payment_amount": 1000000,
                    "payment_date": "2026-08-25",
                    "payment_method": "Transfer Bank",
                    "reference_number": "TRX-002",
                    "notes": "Pelunasan sisa tagihan",
                },
                actor_id="admin-test",
            )
            self.assertEqual(res2["bill"]["paid_amount"], 1500000)
            self.assertEqual(res2["bill"]["remaining_amount"], 0)
            self.assertEqual(res2["bill"]["status"], "paid")
            self.assertEqual(len(res2["transactions"]), 2)
            self.assertEqual(res2["transactions"][0]["amount"], 1000000)
            self.assertEqual(res2["transactions"][0]["running_paid_total"], 1500000)
            self.assertEqual(res2["transactions"][0]["new_status"], "paid")

            # 5. Reject payment on fully paid bill
            with self.assertRaisesRegex(ValueError, "sudah lunas"):
                record_bill_payment(
                    database,
                    bill["id"],
                    {"payment_amount": 100000},
                    actor_id="admin-test",
                )

    def test_bill_payment_api_endpoints(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "test.sqlite"
            with mock.patch("Backend.app.config.DB_PATH", database):
                from Backend.app.main import app

                conn = connect(database)
                init_db(conn)
                conn.close()

                fake_admin = {"id": "admin-1", "email": "admin@salut.id", "role": "admin", "full_name": "Admin Test"}
                with mock.patch("Backend.app.main.find_admin_by_session", return_value=fake_admin):
                    client = TestClient(app)
                    try:
                        # Create student & bill
                        student = create_student(database, {"nim": "077889900", "full_name": "API Pay Test"})
                        bill = create_bill(
                            database,
                            {"student_id": student["id"], "briva": "17810007777", "amount": 800000, "period": "2026.1"},
                        )

                        # GET bill detail
                        res_get = client.get(f"/api/admin/bills/{bill['id']}")
                        self.assertEqual(res_get.status_code, 200)
                        data_get = res_get.json()["data"]
                        self.assertEqual(data_get["bill"]["amount"], 800000)
                        self.assertEqual(data_get["student"]["nim"], "077889900")

                        # POST record payment
                        res_pay = client.post(
                            f"/api/admin/bills/{bill['id']}/payments",
                            json={
                                "payment_amount": 400000,
                                "payment_method": "BRIVA",
                                "reference_number": "REF-API-1",
                                "notes": "Bayar setengah via API",
                            },
                        )
                        self.assertEqual(res_pay.status_code, 200)
                        data_pay = res_pay.json()["data"]
                        self.assertEqual(data_pay["bill"]["paid_amount"], 400000)
                        self.assertEqual(data_pay["bill"]["status"], "partial")
                        self.assertEqual(len(data_pay["transactions"]), 1)
                    finally:
                        client.close()

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
