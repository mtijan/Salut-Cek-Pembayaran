from __future__ import annotations

import tempfile
import sqlite3
from pathlib import Path
from unittest import mock

from fastapi.testclient import TestClient

from Backend.app import config as app_config
from Backend.app.main import app
from Backend.app.domain.billing import BillInactiveError
from Backend.app.repositories.bills import BillRepository
from Backend.app.repositories.imports import ImportRepository
from Backend.app.security import hash_password
from Backend.app.services import (
    bulk_update_bill_activation,
    create_bill,
    create_student,
    get_dashboard_stats,
    get_financial_summary,
    preview_bill_activation,
    record_bill_payment,
    update_bill_activation,
    update_bill_status,
)
from Backend.db import LATEST_SCHEMA_VERSION, database_connection, database_transaction, migrate_database
from Backend.tests.test_base import BackendBaseTestCase


class BillActivationLifecycleTests(BackendBaseTestCase):
    def _seed(self, database: Path) -> dict[str, object]:
        migrate_database(database)
        with database_transaction(database) as conn:
            conn.execute(
                "insert into admin_users (id, email, password_hash, full_name, role) values (?, ?, ?, ?, ?)",
                (
                    "admin-activation",
                    "activation@example.test",
                    hash_password("Password123!"),
                    "Admin Activation",
                    "admin",
                ),
            )
        student_a = create_student(
            database,
            {"nim": "610001", "full_name": "Mahasiswa Pengganti", "study_program_id": "sp_sifo"},
        )
        student_b = create_student(
            database,
            {"nim": "610002", "full_name": "Mahasiswa Tanpa Pengganti", "study_program_id": "sp_sifo"},
        )
        old_a = create_bill(
            database,
            {"student_id": student_a["id"], "briva": "61000101", "amount": 100000, "period": "2026.1"},
        )
        old_b = create_bill(
            database,
            {"student_id": student_b["id"], "briva": "61000201", "amount": 200000, "period": "2026.1"},
        )
        replacement = create_bill(
            database,
            {"student_id": student_a["id"], "briva": "61000102", "amount": 150000, "period": "2026.2"},
        )
        return {
            "student_a": student_a,
            "student_b": student_b,
            "old_a": old_a,
            "old_b": old_b,
            "replacement": replacement,
        }

    def test_schema_v6_defaults_existing_and_new_bills_to_active(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            seeded = self._seed(database)
            with database_connection(database) as conn:
                version = conn.execute("select max(version) from schema_migrations").fetchone()[0]
                row = conn.execute(
                    "select is_active, deactivated_at, deactivated_by, deactivation_reason from bills where id = ?",
                    (seeded["old_a"]["id"],),
                ).fetchone()
                index = conn.execute(
                    "select 1 from sqlite_master where type = 'index' and name = 'idx_bills_activation_period'"
                ).fetchone()
            self.assertEqual(version, LATEST_SCHEMA_VERSION)
            self.assertEqual(tuple(row), (1, None, None, None))
            self.assertIsNotNone(index)

    def test_version_five_database_migrates_without_changing_payment_state(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "legacy-v5.sqlite"
            conn = sqlite3.connect(database)
            try:
                conn.executescript(
                    """
                    create table schema_migrations (version integer primary key, applied_at text);
                    insert into schema_migrations (version, applied_at) values (5, datetime('now'));
                    create table students (
                      id text primary key, nim text not null, full_name text not null,
                      name_norm text not null, deleted_at text
                    );
                    create table bills (
                      id text primary key, student_id text not null, briva text not null,
                      amount integer not null, paid_amount integer not null default 0,
                      period text not null, bill_type text not null, status text not null,
                      payment_method text not null, instructions text not null, source_file text not null,
                      deleted_at text, created_at text, updated_at text
                    );
                    insert into students values ('legacy-student', '620001', 'Legacy Student', 'legacy student', null);
                    insert into bills values (
                      'legacy-bill', 'legacy-student', '62000101', 500000, 200000,
                      '2026.1', 'UKT', 'partial', 'BRIVA', 'Bayar', 'legacy.xlsx',
                      null, datetime('now'), datetime('now')
                    );
                    """
                )
                conn.commit()
            finally:
                conn.close()
            migrate_database(database)
            with database_connection(database) as migrated:
                row = migrated.execute(
                    "select amount, paid_amount, status, is_active, deactivated_at from bills where id = 'legacy-bill'"
                ).fetchone()
            self.assertEqual(tuple(row), (500000, 200000, "partial", 1, None))

    def test_individual_deactivation_hides_public_bill_and_blocks_payment(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            seeded = self._seed(database)
            bill_id = str(seeded["old_a"]["id"])
            updated = update_bill_activation(
                database,
                bill_id,
                False,
                "Periode lama ditutup",
                actor_id="admin-activation",
            )
            self.assertFalse(bool(updated["is_active"]))
            with database_connection(database) as conn:
                public_bills = BillRepository(conn).list_active_for_public_lookup(str(seeded["student_a"]["id"]))
                audit = conn.execute(
                    "select action from audit_logs where entity_id = ? order by created_at desc limit 1", (bill_id,)
                ).fetchone()
            self.assertEqual([row["period"] for row in public_bills], ["2026.2"])
            self.assertEqual(audit["action"], "bill.activation.update")
            with self.assertRaises(BillInactiveError):
                record_bill_payment(database, bill_id, {"payment_amount": 10000})
            with self.assertRaises(BillInactiveError):
                update_bill_status(database, bill_id, "paid")

            reactivated = update_bill_activation(
                database,
                bill_id,
                True,
                "Koreksi penutupan periode",
                actor_id="admin-activation",
            )
            self.assertTrue(bool(reactivated["is_active"]))
            self.assertIsNone(reactivated["deactivated_at"])

    def test_safe_bulk_mode_only_targets_students_with_active_replacement(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            seeded = self._seed(database)
            scope = {
                "period": "2026.1",
                "study_program_id": "sp_sifo",
                "mode": "with_replacement",
                "replacement_period": "2026.2",
                "is_active": False,
                "confirm_all_programs": False,
            }
            preview = preview_bill_activation(database, scope)
            self.assertEqual(preview["summary"]["total_count"], 1)
            self.assertEqual(preview["summary"]["student_count"], 1)

            result = bulk_update_bill_activation(
                database,
                {**scope, "reason": "Semester pengganti sudah tersedia"},
                actor_id="admin-activation",
            )
            self.assertEqual(result["updated_count"], 1)
            with database_connection(database) as conn:
                states = {
                    row["id"]: row["is_active"]
                    for row in conn.execute(
                        "select id, is_active from bills where id in (?, ?)",
                        (seeded["old_a"]["id"], seeded["old_b"]["id"]),
                    )
                }
            self.assertEqual(states[str(seeded["old_a"]["id"])], 0)
            self.assertEqual(states[str(seeded["old_b"]["id"])], 1)

    def test_import_update_preserves_inactive_state_and_metadata(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            seeded = self._seed(database)
            bill_id = str(seeded["old_a"]["id"])
            student_id = str(seeded["student_a"]["id"])
            update_bill_activation(
                database,
                bill_id,
                False,
                "Periode lama ditutup sebelum upload ulang",
                actor_id="admin-activation",
            )
            with database_transaction(database) as conn:
                ImportRepository(conn).update_bill(
                    bill_id,
                    student_id=student_id,
                    briva="61000101",
                    amount=125000,
                    period="2026.1",
                    bill_type="UKT",
                    due_date="2026-12-31",
                    source_file="upload-ulang.xlsx",
                    row_number=2,
                )
            with database_connection(database) as conn:
                row = conn.execute(
                    """
                    select amount, is_active, deactivated_by, deactivation_reason
                    from bills where id = ?
                    """,
                    (bill_id,),
                ).fetchone()
            self.assertEqual(row["amount"], 125000)
            self.assertEqual(row["is_active"], 0)
            self.assertEqual(row["deactivated_by"], "admin-activation")
            self.assertEqual(row["deactivation_reason"], "Periode lama ditutup sebelum upload ulang")

    def test_all_program_scope_requires_confirmation_and_preview_is_read_only(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            self._seed(database)
            scope = {
                "period": "2026.1",
                "mode": "all",
                "is_active": False,
                "confirm_all_programs": False,
            }
            with self.assertRaisesRegex(ValueError, "semua program studi"):
                preview_bill_activation(database, scope)
            preview = preview_bill_activation(database, {**scope, "confirm_all_programs": True})
            self.assertEqual(preview["summary"]["total_count"], 2)
            with database_connection(database) as conn:
                active_count = conn.execute(
                    "select count(*) from bills where period = '2026.1' and is_active = 1"
                ).fetchone()[0]
            self.assertEqual(active_count, 2)

    def test_bulk_audit_failure_rolls_back_business_update(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            self._seed(database)
            payload = {
                "period": "2026.1",
                "study_program_id": "sp_sifo",
                "mode": "all",
                "is_active": False,
                "reason": "Uji rollback audit",
            }
            with mock.patch(
                "Backend.app.services.billing_commands._audit.write_audit", side_effect=RuntimeError("audit failed")
            ):
                with self.assertRaisesRegex(RuntimeError, "audit failed"):
                    bulk_update_bill_activation(database, payload, actor_id="admin-activation")
            with database_connection(database) as conn:
                inactive_count = conn.execute(
                    "select count(*) from bills where period = '2026.1' and is_active = 0"
                ).fetchone()[0]
            self.assertEqual(inactive_count, 0)

    def test_dashboard_excludes_inactive_but_financial_report_remains_historical(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            seeded = self._seed(database)
            update_bill_activation(
                database,
                str(seeded["old_a"]["id"]),
                False,
                "Ditutup untuk dashboard",
                actor_id="admin-activation",
            )
            dashboard = get_dashboard_stats(database)
            report = get_financial_summary(database, period="2026.1")
            self.assertEqual(dashboard["total_bills"], 2)
            self.assertEqual(report["totals"]["billed_amount"], 300000)
            self.assertEqual(report["totals"]["total_bills"], 2)

    def test_activation_api_preview_apply_filter_and_payment_conflict(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            seeded = self._seed(database)
            original_db_path = app_config.DB_PATH
            app_config.DB_PATH = database
            try:
                client = TestClient(app)
                login = client.post(
                    "/api/admin/login",
                    json={"email": "activation@example.test", "password": "Password123!"},
                )
                self.assertEqual(login.status_code, 200)
                scope = {
                    "period": "2026.1",
                    "study_program_id": "sp_sifo",
                    "mode": "with_replacement",
                    "replacement_period": "2026.2",
                    "is_active": False,
                    "confirm_all_programs": False,
                }
                preview = client.post("/api/admin/bills/activation/preview", json=scope)
                self.assertEqual(preview.status_code, 200)
                self.assertEqual(preview.json()["data"]["summary"]["total_count"], 1)
                applied = client.post(
                    "/api/admin/bills/activation/bulk",
                    json={**scope, "reason": "API safe scope"},
                )
                self.assertEqual(applied.status_code, 200)
                inactive = client.get("/api/admin/bills?activation=inactive")
                self.assertEqual(inactive.json()["data"]["pagination"]["total"], 1)
                payment = client.post(
                    f"/api/admin/bills/{seeded['old_a']['id']}/payments",
                    json={"payment_amount": 10000},
                )
                self.assertEqual(payment.status_code, 409)
                self.assertEqual(payment.json()["error"]["code"], "BILL_INACTIVE")
            finally:
                app_config.DB_PATH = original_db_path
