"""API Contract, OpenAPI schema parity, and error response consistency tests."""

from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from Backend.app import config as app_config
from Backend.app.main import app
from Backend.app.security import hash_password
from Backend.app.version import APP_VERSION
from Backend.db import connect, database_transaction, init_db, migrate_database
from Backend.tests.test_base import BackendBaseTestCase


class ContractOpenAPITests(BackendBaseTestCase):
    """Test suite validating OpenAPI contract alignment, security schemas, and runtime parity."""

    def setUp(self) -> None:
        super().setUp()
        self.client = TestClient(app, raise_server_exceptions=False)
        self.schema = app.openapi()

    def test_openapi_metadata_and_counts(self) -> None:
        """Verify OpenAPI 3.1 metadata, exact 30 paths, and exact 41 operations."""
        self.assertEqual(self.schema["openapi"], "3.1.0")
        self.assertEqual(self.schema["info"]["title"], "Salut Cek Pembayaran")
        self.assertEqual(self.schema["info"]["version"], APP_VERSION)

        paths: dict[str, Any] = self.schema["paths"]
        self.assertEqual(len(paths), 30)

        total_operations = sum(
            1
            for path_item in paths.values()
            for method in path_item
            if method in {"get", "post", "patch", "delete", "put"}
        )
        self.assertEqual(total_operations, 41)

    def test_openapi_security_schemes(self) -> None:
        """Verify cookieAuth security scheme is configured and applied to protected admin routes."""
        security_schemes = self.schema["components"]["securitySchemes"]
        self.assertIn("cookieAuth", security_schemes)
        cookie_auth = security_schemes["cookieAuth"]
        self.assertEqual(cookie_auth["type"], "apiKey")
        self.assertEqual(cookie_auth["in"], "cookie")
        self.assertEqual(cookie_auth["name"], "salut_admin_session")

        for path, path_item in self.schema["paths"].items():
            for method, operation in path_item.items():
                if method not in {"get", "post", "patch", "delete", "put"}:
                    continue
                if path.startswith("/api/admin/") and path not in {"/api/admin/login", "/api/admin/logout"}:
                    self.assertIn(
                        "security",
                        operation,
                        f"Expected security on protected admin operation: {method.upper()} {path}",
                    )
                    self.assertEqual(operation["security"], [{"cookieAuth": []}])

    def test_openapi_contains_no_422_status_code(self) -> None:
        """Verify that no OpenAPI path operation advertises a 422 Validation Error."""
        for path, path_item in self.schema["paths"].items():
            for method, operation in path_item.items():
                if method not in {"get", "post", "patch", "delete", "put"}:
                    continue
                responses = operation.get("responses", {})
                self.assertNotIn(
                    "422",
                    responses,
                    f"Found prohibited 422 status response on {method.upper()} {path}",
                )
                self.assertNotIn(
                    422,
                    responses,
                    f"Found prohibited 422 status response on {method.upper()} {path}",
                )

        # Also verify no HTTPValidationError schema in components
        schemas = self.schema.get("components", {}).get("schemas", {})
        self.assertNotIn("HTTPValidationError", schemas)
        self.assertNotIn("ValidationError", schemas)

    def test_openapi_all_operations_have_tags_and_summaries(self) -> None:
        """Verify every operation has non-empty tags, summary, and operationId."""
        for path, path_item in self.schema["paths"].items():
            for method, operation in path_item.items():
                if method not in {"get", "post", "patch", "delete", "put"}:
                    continue
                self.assertTrue(operation.get("tags"), f"Missing tags on {method.upper()} {path}")
                self.assertTrue(operation.get("summary"), f"Missing summary on {method.upper()} {path}")
                self.assertTrue(operation.get("operationId"), f"Missing operationId on {method.upper()} {path}")
                self.assertTrue(operation.get("responses"), f"Missing responses on {method.upper()} {path}")

    def test_openapi_components_schema_completeness(self) -> None:
        """Verify core schema models exist in components."""
        schemas = self.schema["components"]["schemas"]
        required_schemas = [
            "ErrorDetail",
            "ErrorResponse",
            "HealthResponse",
            "LookupRequest",
            "LookupResponse",
            "AdminLoginRequest",
            "AdminAuthResponse",
            "BillSingleResponse",
            "BillsListResponse",
            "StudentListResponse",
            "Student360DetailResponse",
            "DashboardStatsResponse",
            "FinancialSummaryResponse",
            "ImportPreviewResponse",
            "ImportCommitResponse",
        ]
        for name in required_schemas:
            with self.subTest(schema=name):
                self.assertIn(name, schemas)

    def test_lookup_contract_student_without_bills_returns_200_empty_list(self) -> None:
        """Contract: Registered student with zero active bills returns HTTP 200 with empty bills list."""
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = Path(temp_dir) / "salut.sqlite"
            migrate_database(db_path)
            with database_transaction(db_path) as conn:
                conn.execute(
                    "insert into students (id, nim, full_name, name_norm) values (?, ?, ?, ?)",
                    ("student-nobills", "050999999", "Mahasiswa Tanpa Tagihan", "mahasiswa tanpa tagihan"),
                )

            original_db = app_config.DB_PATH
            app_config.DB_PATH = db_path
            try:
                response = self.client.post("/api/lookup", json={"nim": "050999999"})
                self.assertEqual(response.status_code, 200)
                data = response.json()
                self.assertTrue(data["success"])
                self.assertEqual(data["data"]["student"]["nim"], "050999999")
                self.assertEqual(data["data"]["bills"], [])
                self.assertEqual(data["data"]["payment_status"], "unpaid")
                self.assertIn("request_id", data)
            finally:
                app_config.DB_PATH = original_db

    def test_lookup_contract_unknown_or_deleted_student_returns_404(self) -> None:
        """Contract: Non-existent or soft-deleted student returns HTTP 404 NOT_FOUND."""
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = Path(temp_dir) / "salut.sqlite"
            migrate_database(db_path)
            with database_transaction(db_path) as conn:
                conn.execute(
                    "insert into students (id, nim, full_name, name_norm, deleted_at) values (?, ?, ?, ?, datetime('now'))",
                    ("student-del", "050888888", "Mahasiswa Hapus", "mahasiswa hapus"),
                )

            original_db = app_config.DB_PATH
            app_config.DB_PATH = db_path
            try:
                # Deleted student lookup
                res_deleted = self.client.post("/api/lookup", json={"nim": "050888888"})
                self.assertEqual(res_deleted.status_code, 404)
                data_del = res_deleted.json()
                self.assertFalse(data_del["success"])
                self.assertEqual(data_del["error"]["code"], "NOT_FOUND")

                # Non-existent student lookup
                res_unknown = self.client.post("/api/lookup", json={"nim": "050777777"})
                self.assertEqual(res_unknown.status_code, 404)
                data_unk = res_unknown.json()
                self.assertFalse(data_unk["success"])
                self.assertEqual(data_unk["error"]["code"], "NOT_FOUND")
            finally:
                app_config.DB_PATH = original_db

    def test_student_360_detail_without_bills_returns_200_empty_list(self) -> None:
        """Contract: Admin Student 360 detail for student with no bills returns 200 with empty bills."""
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = Path(temp_dir) / "salut.sqlite"
            conn = connect(db_path)
            init_db(conn)
            with conn:
                conn.execute(
                    "insert into admin_users (id, email, password_hash, full_name, role) values (?, ?, ?, ?, ?)",
                    (
                        "admin-super",
                        "super@example.test",
                        hash_password("SuperSecret123!"),
                        "Super Admin",
                        "super_admin",
                    ),
                )
                conn.execute(
                    "insert into students (id, nim, full_name, name_norm) values (?, ?, ?, ?)",
                    ("student-active-01", "050111222", "Mahasiswa Aktif", "mahasiswa aktif"),
                )
            conn.close()

            original_db = app_config.DB_PATH
            app_config.DB_PATH = db_path
            try:
                client = TestClient(app)
                login_resp = client.post(
                    "/api/admin/login",
                    json={"email": "super@example.test", "password": "SuperSecret123!"},
                )
                self.assertEqual(login_resp.status_code, 200)

                response = client.get("/api/admin/students/student-active-01/detail")
                self.assertEqual(response.status_code, 200)
                payload = response.json()
                self.assertTrue(payload["success"])
                self.assertEqual(payload["data"]["student"]["nim"], "050111222")
                self.assertEqual(payload["data"]["bills"], [])
                self.assertEqual(payload["data"]["summary"]["total_bills"], 0)
                self.assertEqual(payload["data"]["summary"]["total_amount"], 0)
            finally:
                app_config.DB_PATH = original_db

    def test_student_360_detail_unknown_student_returns_404(self) -> None:
        """Contract: Admin Student 360 detail for non-existent student returns 404."""
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = Path(temp_dir) / "salut.sqlite"
            conn = connect(db_path)
            init_db(conn)
            with conn:
                conn.execute(
                    "insert into admin_users (id, email, password_hash, full_name, role) values (?, ?, ?, ?, ?)",
                    (
                        "admin-super",
                        "super@example.test",
                        hash_password("SuperSecret123!"),
                        "Super Admin",
                        "super_admin",
                    ),
                )
            conn.close()

            original_db = app_config.DB_PATH
            app_config.DB_PATH = db_path
            try:
                client = TestClient(app)
                login_resp = client.post(
                    "/api/admin/login",
                    json={"email": "super@example.test", "password": "SuperSecret123!"},
                )
                self.assertEqual(login_resp.status_code, 200)

                response = client.get("/api/admin/students/non-existent-id/detail")
                self.assertEqual(response.status_code, 404)
                payload = response.json()
                self.assertFalse(payload["success"])
                self.assertEqual(payload["error"]["code"], "NOT_FOUND")
            finally:
                app_config.DB_PATH = original_db

    def test_validation_error_runtime_returns_400(self) -> None:
        """Verify runtime validation returns HTTP 400 VALIDATION_ERROR envelope."""
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = Path(temp_dir) / "salut.sqlite"
            migrate_database(db_path)

            original_db = app_config.DB_PATH
            app_config.DB_PATH = db_path
            try:
                # Invalid NIM format (letters in NIM)
                response = self.client.post("/api/lookup", json={"nim": "050ABC123"})
                self.assertEqual(response.status_code, 400)
                payload = response.json()
                self.assertFalse(payload["success"])
                self.assertEqual(payload["error"]["code"], "VALIDATION_ERROR")
                self.assertIn("request_id", payload)
            finally:
                app_config.DB_PATH = original_db
