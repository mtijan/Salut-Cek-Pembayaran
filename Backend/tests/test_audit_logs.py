from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import server
from Backend.app import config as app_config
from Backend.app.security import hash_password
from Backend.app.services.audit import REDACTED_VALUE, list_audit_logs
from Backend.db import connect, init_db
from Backend.tests.test_base import BackendBaseTestCase
from fastapi.testclient import TestClient


class AuditLogViewerTests(BackendBaseTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.temp_dir = tempfile.TemporaryDirectory()
        self.database_path = Path(self.temp_dir.name) / "salut.sqlite"
        conn = connect(self.database_path)
        init_db(conn)
        with conn:
            conn.executemany(
                """
                insert into admin_users (id, email, password_hash, full_name, role, is_active)
                values (?, ?, ?, ?, ?, 1)
                """,
                [
                    (
                        "super-1",
                        "super@synthetic.test",
                        hash_password("SuperPassword123!"),
                        "Super Test",
                        "super_admin",
                    ),
                    (
                        "admin-1",
                        "admin@synthetic.test",
                        hash_password("AdminPassword123!"),
                        "Admin Test",
                        "admin",
                    ),
                ],
            )
            conn.execute(
                """
                insert into audit_logs (id, actor_id, action, entity_type, entity_id, metadata)
                values (?, ?, ?, ?, ?, ?)
                """,
                (
                    "audit-1",
                    "super-1",
                    "student.update",
                    "student",
                    "student-1",
                    json.dumps(
                        {
                            "nim": "990000001",
                            "email": "student@synthetic.test",
                            "user_email": "nested@synthetic.test",
                            "password": "never-return-this",
                            "nested": {
                                "api_token_hash": "never-return-token",
                                "token": "never-return-token",
                                "status": "aktif",
                            },
                            "reason": "Koreksi data sintetis",
                        }
                    ),
                ),
            )
        conn.close()
        self.client = TestClient(server.app)

    def tearDown(self) -> None:
        self.temp_dir.cleanup()
        super().tearDown()

    def _login(self, email: str, password: str) -> None:
        response = self.client.post("/api/admin/login", json={"email": email, "password": password})
        self.assertEqual(response.status_code, 200)

    def test_super_admin_can_list_filtered_redacted_audit_logs(self) -> None:
        with mock.patch.object(app_config, "DB_PATH", self.database_path):
            self._login("super@synthetic.test", "SuperPassword123!")
            response = self.client.get(
                "/api/admin/audit-logs",
                params={"action": "student.update", "entity_type": "student", "limit": 10},
            )

        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        self.assertEqual(data["pagination"], {"total": 1, "limit": 10, "offset": 0})
        entry = data["audit_logs"][0]
        self.assertEqual(entry["actor_name"], "Super Test")
        self.assertEqual(entry["metadata"]["nim"], REDACTED_VALUE)
        self.assertEqual(entry["metadata"]["email"], REDACTED_VALUE)
        self.assertEqual(entry["metadata"]["user_email"], REDACTED_VALUE)
        self.assertEqual(entry["metadata"]["password"], REDACTED_VALUE)
        self.assertEqual(entry["metadata"]["nested"]["token"], REDACTED_VALUE)
        self.assertEqual(entry["metadata"]["nested"]["api_token_hash"], REDACTED_VALUE)
        self.assertEqual(entry["metadata"]["nested"]["status"], "aktif")
        self.assertNotIn("never-return", response.text)

    def test_non_privileged_admin_cannot_view_audit_logs(self) -> None:
        with mock.patch.object(app_config, "DB_PATH", self.database_path):
            self._login("admin@synthetic.test", "AdminPassword123!")
            response = self.client.get("/api/admin/audit-logs")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["error"]["code"], "FORBIDDEN")

    def test_service_paginates_and_drops_invalid_metadata(self) -> None:
        conn = connect(self.database_path)
        with conn:
            conn.execute(
                """
                insert into audit_logs (id, actor_id, action, entity_type, entity_id, metadata)
                values ('audit-2', null, 'system.cleanup', 'system', null, 'not-json')
                """
            )
        conn.close()

        page = list_audit_logs(self.database_path, limit=1, offset=1)
        self.assertEqual(page["pagination"], {"total": 2, "limit": 1, "offset": 1})
        self.assertEqual(len(page["audit_logs"]), 1)
