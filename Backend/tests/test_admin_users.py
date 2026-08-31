from __future__ import annotations

import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import server
from Backend.app import config as app_config
from Backend.app.security import hash_password
from Backend.db import connect, init_db
from Backend.tests.test_base import BackendBaseTestCase
from fastapi.testclient import TestClient


class AdminUserManagementTests(BackendBaseTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.temp_dir = tempfile.TemporaryDirectory()
        self.database_path = Path(self.temp_dir.name) / "salut.sqlite"
        conn = connect(self.database_path)
        init_db(conn)
        with conn:
            # Seed super admin
            conn.execute(
                """
                insert into admin_users (id, email, password_hash, full_name, role, is_active)
                values (?, ?, ?, ?, ?, ?)
                """,
                ("super-1", "super@salut.test", hash_password("SuperSecret123!"), "Super Admin", "super_admin", 1),
            )
            # Seed standard admin
            conn.execute(
                """
                insert into admin_users (id, email, password_hash, full_name, role, is_active)
                values (?, ?, ?, ?, ?, ?)
                """,
                ("admin-1", "admin@salut.test", hash_password("AdminSecret123!"), "Regular Admin", "admin", 1),
            )
            # Seed viewer
            conn.execute(
                """
                insert into admin_users (id, email, password_hash, full_name, role, is_active)
                values (?, ?, ?, ?, ?, ?)
                """,
                ("viewer-1", "viewer@salut.test", hash_password("ViewerSecret123!"), "Viewer User", "viewer", 1),
            )
        conn.close()

        self.original_db_path = app_config.DB_PATH
        app_config.DB_PATH = self.database_path
        self.client = TestClient(server.app)

    def tearDown(self) -> None:
        app_config.DB_PATH = self.original_db_path
        self.temp_dir.cleanup()
        super().tearDown()

    def _login(self, email: str, password: str) -> str:
        res = self.client.post("/api/admin/login", json={"email": email, "password": password})
        self.assertEqual(res.status_code, 200)
        cookie = res.cookies.get(app_config.SESSION_COOKIE)
        self.assertIsNotNone(cookie)
        return str(cookie)

    @staticmethod
    def _session_headers(cookie: str) -> dict[str, str]:
        return {"Cookie": f"{app_config.SESSION_COOKIE}={cookie}"}

    def test_super_admin_can_crud_users(self) -> None:
        super_cookie = self._login("super@salut.test", "SuperSecret123!")
        headers = self._session_headers(super_cookie)

        # 1. List initial users
        list_res = self.client.get("/api/admin/users", headers=headers)
        self.assertEqual(list_res.status_code, 200)
        initial_users = list_res.json()["data"]["users"]
        self.assertEqual(len(initial_users), 3)

        # 2. Create new admin_akademik
        create_payload = {
            "email": "akademik@salut.test",
            "password": "AkademikPass123!",
            "full_name": "Staff Akademik",
            "role": "admin_akademik",
            "is_active": True,
        }
        create_res = self.client.post("/api/admin/users", json=create_payload, headers=headers)
        self.assertEqual(create_res.status_code, 200)
        created_user = create_res.json()["data"]["user"]
        self.assertEqual(created_user["email"], "akademik@salut.test")
        self.assertEqual(created_user["role"], "admin_akademik")
        self.assertIn("manage_students", created_user["permissions"])
        new_id = created_user["id"]

        # 3. Get user detail
        detail_res = self.client.get(f"/api/admin/users/{new_id}", headers=headers)
        self.assertEqual(detail_res.status_code, 200)
        self.assertEqual(detail_res.json()["data"]["user"]["id"], new_id)

        # 4. Update user
        update_payload = {"full_name": "Staff Akademik Senior", "role": "admin_keuangan"}
        update_res = self.client.patch(f"/api/admin/users/{new_id}", json=update_payload, headers=headers)
        self.assertEqual(update_res.status_code, 200)
        self.assertEqual(update_res.json()["data"]["user"]["full_name"], "Staff Akademik Senior")
        self.assertEqual(update_res.json()["data"]["user"]["role"], "admin_keuangan")

        # 5. Delete user
        del_res = self.client.delete(f"/api/admin/users/{new_id}", headers=headers)
        self.assertEqual(del_res.status_code, 200)
        self.assertTrue(del_res.json()["data"]["deleted"])

        # Verify not found after delete
        not_found_res = self.client.get(f"/api/admin/users/{new_id}", headers=headers)
        self.assertEqual(not_found_res.status_code, 404)

    def test_non_super_admin_cannot_access_users_api(self) -> None:
        for email, pwd in [
            ("admin@salut.test", "AdminSecret123!"),
            ("viewer@salut.test", "ViewerSecret123!"),
        ]:
            with self.subTest(user=email):
                cookie = self._login(email, pwd)
                headers = self._session_headers(cookie)

                # GET list
                self.assertEqual(self.client.get("/api/admin/users", headers=headers).status_code, 403)
                # POST create
                self.assertEqual(
                    self.client.post(
                        "/api/admin/users",
                        json={"email": "x@salut.test", "password": "Pass12345678!"},
                        headers=headers,
                    ).status_code,
                    403,
                )
                # GET detail
                self.assertEqual(self.client.get("/api/admin/users/admin-1", headers=headers).status_code, 403)
                # PATCH update
                self.assertEqual(
                    self.client.patch("/api/admin/users/admin-1", json={"full_name": "X"}, headers=headers).status_code,
                    403,
                )
                # DELETE
                self.assertEqual(self.client.delete("/api/admin/users/admin-1", headers=headers).status_code, 403)
                # POST reset-password
                self.assertEqual(
                    self.client.post(
                        "/api/admin/users/admin-1/reset-password",
                        json={"password": "NewPass1234!"},
                        headers=headers,
                    ).status_code,
                    403,
                )

    def test_unauthenticated_request_rejected(self) -> None:
        self.assertEqual(self.client.get("/api/admin/users").status_code, 401)
        self.assertEqual(self.client.post("/api/admin/users", json={}).status_code, 401)
        self.assertEqual(self.client.get("/api/admin/users/super-1").status_code, 401)
        self.assertEqual(self.client.patch("/api/admin/users/super-1", json={}).status_code, 401)
        self.assertEqual(self.client.delete("/api/admin/users/super-1").status_code, 401)
        self.assertEqual(self.client.post("/api/admin/users/super-1/reset-password", json={}).status_code, 401)

    def test_last_active_super_admin_cannot_be_deleted(self) -> None:
        super_cookie = self._login("super@salut.test", "SuperSecret123!")
        headers = self._session_headers(super_cookie)

        del_res = self.client.delete("/api/admin/users/super-1", headers=headers)
        self.assertEqual(del_res.status_code, 400)
        self.assertEqual(del_res.json()["error"]["code"], "VALIDATION_ERROR")
        self.assertIn("super_admin aktif terakhir", del_res.json()["error"]["message"])

    def test_last_active_super_admin_cannot_be_deactivated_or_demoted(self) -> None:
        super_cookie = self._login("super@salut.test", "SuperSecret123!")
        headers = self._session_headers(super_cookie)

        # Attempt to deactivate
        deact_res = self.client.patch("/api/admin/users/super-1", json={"is_active": False}, headers=headers)
        self.assertEqual(deact_res.status_code, 400)
        self.assertIn("super_admin aktif terakhir", deact_res.json()["error"]["message"])

        # Attempt to demote role
        demote_res = self.client.patch("/api/admin/users/super-1", json={"role": "admin"}, headers=headers)
        self.assertEqual(demote_res.status_code, 400)
        self.assertIn("super_admin aktif terakhir", demote_res.json()["error"]["message"])

    def test_password_reset_revokes_active_sessions(self) -> None:
        # 1. Login as admin-1 to establish an active session
        admin_cookie = self._login("admin@salut.test", "AdminSecret123!")
        admin_headers = self._session_headers(admin_cookie)

        # Verify admin-1 session is active
        me_res = self.client.get("/api/admin/me", headers=admin_headers)
        self.assertEqual(me_res.status_code, 200)

        # 2. Login as super admin and reset admin-1 password
        super_cookie = self._login("super@salut.test", "SuperSecret123!")
        super_headers = self._session_headers(super_cookie)

        reset_res = self.client.post(
            "/api/admin/users/admin-1/reset-password",
            json={"password": "BrandNewSecret123!"},
            headers=super_headers,
        )
        self.assertEqual(reset_res.status_code, 200)
        self.assertTrue(reset_res.json()["data"]["reset"])

        # 3. Verify old admin-1 session is immediately rejected (revoked)
        me_after = self.client.get("/api/admin/me", headers=admin_headers)
        self.assertEqual(me_after.status_code, 401)

        # 4. Verify admin-1 can login with new password
        new_cookie = self._login("admin@salut.test", "BrandNewSecret123!")
        self.assertIsNotNone(new_cookie)

    def test_deactivation_revokes_active_sessions(self) -> None:
        # 1. Login as admin-1
        admin_cookie = self._login("admin@salut.test", "AdminSecret123!")
        admin_headers = self._session_headers(admin_cookie)

        # 2. Super admin deactivates admin-1
        super_cookie = self._login("super@salut.test", "SuperSecret123!")
        super_headers = self._session_headers(super_cookie)

        deact_res = self.client.patch("/api/admin/users/admin-1", json={"is_active": False}, headers=super_headers)
        self.assertEqual(deact_res.status_code, 200)
        self.assertFalse(deact_res.json()["data"]["user"]["is_active"])

        # 3. Verify session revoked
        me_after = self.client.get("/api/admin/me", headers=admin_headers)
        self.assertEqual(me_after.status_code, 401)

        # 4. Verify deactivated user cannot log in
        login_res = self.client.post(
            "/api/admin/login", json={"email": "admin@salut.test", "password": "AdminSecret123!"}
        )
        self.assertEqual(login_res.status_code, 401)

    def test_validation_errors_on_creation(self) -> None:
        super_cookie = self._login("super@salut.test", "SuperSecret123!")
        headers = self._session_headers(super_cookie)

        # Duplicate email
        res1 = self.client.post(
            "/api/admin/users",
            json={"email": "admin@salut.test", "password": "ValidPassword123!"},
            headers=headers,
        )
        self.assertEqual(res1.status_code, 400)
        self.assertIn("sudah terdaftar", res1.json()["error"]["message"])

        # Weak password (< 8 chars)
        res2 = self.client.post(
            "/api/admin/users",
            json={"email": "newbie@salut.test", "password": "short"},
            headers=headers,
        )
        self.assertEqual(res2.status_code, 400)
        self.assertIn("minimal 8 karakter", res2.json()["error"]["message"])

        # Invalid role
        res3 = self.client.post(
            "/api/admin/users",
            json={"email": "newbie@salut.test", "password": "ValidPassword123!", "role": "hacker_role"},
            headers=headers,
        )
        self.assertEqual(res3.status_code, 400)
        self.assertIn("tidak valid", res3.json()["error"]["message"])

    def test_audit_trail_recorded_on_user_mutations(self) -> None:
        super_cookie = self._login("super@salut.test", "SuperSecret123!")
        headers = self._session_headers(super_cookie)

        # Create
        res = self.client.post(
            "/api/admin/users",
            json={"email": "audited@salut.test", "password": "AuditPassword123!", "full_name": "Audit Test"},
            headers=headers,
        )
        user_id = res.json()["data"]["user"]["id"]

        # Update
        self.client.patch(f"/api/admin/users/{user_id}", json={"full_name": "Audit Test Renamed"}, headers=headers)

        # Reset Password
        self.client.post(
            f"/api/admin/users/{user_id}/reset-password",
            json={"password": "NewAuditPassword123!"},
            headers=headers,
        )

        # Delete
        self.client.delete(f"/api/admin/users/{user_id}", headers=headers)

        # Check audit log rows
        conn = connect(self.database_path)
        actions = [
            row["action"]
            for row in conn.execute(
                "select action from audit_logs where entity_id = ? order by created_at asc", (user_id,)
            ).fetchall()
        ]
        conn.close()

        self.assertIn("user.create", actions)
        self.assertIn("user.update", actions)
        self.assertIn("user.password_reset", actions)
        self.assertIn("user.delete", actions)
