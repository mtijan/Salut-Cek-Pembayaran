from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))

import server
from Backend.app import config as app_config
from Backend.app.config import ROLE_PERMISSIONS
from Backend.app.rate_limit import RateLimiter
from db import connect, init_db
from fastapi.testclient import TestClient
from Backend.test_base import BackendBaseTestCase


class AuthAndRBACTests(BackendBaseTestCase):
    def test_rate_limiter_blocks_after_limit(self) -> None:
        limiter = RateLimiter()
        self.assertIsNone(limiter.check("lookup", "127.0.0.1", 2, 60))
        self.assertIsNone(limiter.check("lookup", "127.0.0.1", 2, 60))
        self.assertIsNotNone(limiter.check("lookup", "127.0.0.1", 2, 60))

    def test_viewer_cannot_import(self) -> None:
        self.assertNotIn("import", ROLE_PERMISSIONS["viewer"])
        self.assertIn("import", ROLE_PERMISSIONS["admin"])

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

    def test_anonymous_admin_endpoints_rejected(self) -> None:
        client = TestClient(server.app)
        self.assertEqual(client.get("/api/admin/students").status_code, 401)
        self.assertEqual(client.get("/api/admin/bills").status_code, 401)
        self.assertEqual(client.get("/api/admin/imported-bills").status_code, 401)
        self.assertEqual(
            client.request(
                "DELETE", "/api/admin/imported-files", json={"file_name": "x.xlsx", "reason": "test"}
            ).status_code,
            401,
        )

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
                    resp = client.post(
                        "/api/lookup", json={"nim": "000000"}, headers={"X-Forwarded-For": f"10.0.0.{i}"}
                    )
                resp = client.post("/api/lookup", json={"nim": "000000"}, headers={"X-Forwarded-For": "10.0.0.99"})
                self.assertEqual(resp.status_code, 429)
            finally:
                app_config.DB_PATH = original_db_path
                app_config.TRUST_PROXY_HEADERS = original_trust

    def test_login_rate_limit_is_checked_before_a_correct_password_can_bypass_it(self) -> None:
        from Backend.app import main as app_main

        fake_admin = {
            "id": "admin-rate-limit",
            "email": "limited@example.test",
            "full_name": "Admin Limited",
            "role": "admin",
        }
        limiter = RateLimiter()
        with (
            mock.patch.object(app_main, "RATE_LIMITER", limiter),
            mock.patch.object(
                app_main, "authenticate_admin", side_effect=[None, None, None, None, None, fake_admin]
            ) as authenticate,
        ):
            client = TestClient(app_main.app)
            try:
                for _ in range(5):
                    response = client.post(
                        "/api/admin/login",
                        json={"email": fake_admin["email"], "password": "wrong-password"},
                    )
                    self.assertEqual(response.status_code, 401)

                blocked = client.post(
                    "/api/admin/login",
                    json={"email": fake_admin["email"], "password": "correct-password"},
                )
            finally:
                client.close()

        self.assertEqual(blocked.status_code, 429)
        self.assertEqual(authenticate.call_count, 5)

    def test_granular_rbac_roles(self) -> None:
        from Backend.app.config import ROLE_PERMISSIONS

        self.assertIn("manage_master_data", ROLE_PERMISSIONS["admin_akademik"])
        self.assertIn("manage_students", ROLE_PERMISSIONS["admin_akademik"])
        self.assertNotIn("import", ROLE_PERMISSIONS["admin_akademik"])

        self.assertIn("import", ROLE_PERMISSIONS["admin_keuangan"])
        self.assertIn("manage_billing", ROLE_PERMISSIONS["admin_keuangan"])
        self.assertNotIn("manage_master_data", ROLE_PERMISSIONS["admin_keuangan"])

        self.assertIn("view_reports", ROLE_PERMISSIONS["viewer"])
        self.assertIn("view_students", ROLE_PERMISSIONS["viewer"])
        self.assertIn("view_billing", ROLE_PERMISSIONS["viewer"])
        self.assertIn("view_master_data", ROLE_PERMISSIONS["viewer"])
        self.assertIn("view_imports", ROLE_PERMISSIONS["viewer"])
        self.assertNotIn("manage_students", ROLE_PERMISSIONS["viewer"])
        self.assertNotIn("manage_billing", ROLE_PERMISSIONS["viewer"])

        self.assertIn("manage_users", ROLE_PERMISSIONS["super_admin"])


if __name__ == "__main__":
    unittest.main()
