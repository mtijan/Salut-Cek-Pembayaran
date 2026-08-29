from __future__ import annotations

import tempfile
from pathlib import Path
from unittest import mock

from fastapi.testclient import TestClient

from Backend.app.services import (
    bill_row_to_dict,
    create_bill,
    create_student,
    get_bill_detail,
    get_student_detail,
    list_payment_transactions,
    record_bill_payment,
    update_bill,
    update_bill_status,
)
from Backend.db import connect, init_db, migrate_database
from Backend.test_base import BackendBaseTestCase


class BillingPaymentTests(BackendBaseTestCase):
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
