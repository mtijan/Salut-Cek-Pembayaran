from __future__ import annotations

import io
import sys
import tempfile
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from Backend import admin_cli
from Backend.app.security import hash_password, verify_password
from Backend.app.services.auth import authenticate_admin, create_admin_session, find_admin_by_session
from Backend.db import connect, database_connection, init_db
from Backend.tests.test_base import BackendBaseTestCase


class AdminCLITests(BackendBaseTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.temp_dir = tempfile.TemporaryDirectory()
        self.database_path = Path(self.temp_dir.name) / "salut.sqlite"
        conn = connect(self.database_path)
        init_db(conn)
        with conn:
            conn.execute(
                """
                insert into admin_users (id, email, password_hash, full_name, role, is_active)
                values (?, ?, ?, ?, ?, ?)
                """,
                ("super-1", "super@salut.test", hash_password("SuperSecret123!"), "Super Admin", "super_admin", 1),
            )
            conn.execute(
                """
                insert into admin_users (id, email, password_hash, full_name, role, is_active)
                values (?, ?, ?, ?, ?, ?)
                """,
                ("admin-1", "admin@salut.test", hash_password("AdminSecret123!"), "Regular Admin", "admin", 1),
            )
        conn.close()

    def tearDown(self) -> None:
        self.temp_dir.cleanup()
        super().tearDown()

    def test_cli_create_superadmin_success(self) -> None:
        exit_code = admin_cli.main(
            [
                "create-superadmin",
                "--email",
                "newsuper@salut.test",
                "--name",
                "New Super Admin",
                "--password",
                "NewSuperPassword123!",
                "--db",
                str(self.database_path),
            ]
        )
        self.assertEqual(exit_code, 0)

        with database_connection(self.database_path) as conn:
            row = conn.execute("select * from admin_users where email = 'newsuper@salut.test'").fetchone()
            self.assertIsNotNone(row)
            self.assertEqual(row["role"], "super_admin")
            self.assertEqual(row["full_name"], "New Super Admin")
            self.assertEqual(row["is_active"], 1)
            self.assertTrue(verify_password("NewSuperPassword123!", row["password_hash"]))

    def test_cli_create_superadmin_validation_failure(self) -> None:
        # Short password
        exit_code = admin_cli.main(
            [
                "create-superadmin",
                "--email",
                "bad@salut.test",
                "--password",
                "short",
                "--db",
                str(self.database_path),
            ]
        )
        self.assertEqual(exit_code, 1)

        # Invalid email
        exit_code = admin_cli.main(
            [
                "create-superadmin",
                "--email",
                "not-an-email",
                "--password",
                "ValidPass123!",
                "--db",
                str(self.database_path),
            ]
        )
        self.assertEqual(exit_code, 1)

    def test_cli_reset_password_and_session_revocation(self) -> None:
        # 1. Create active session for admin-1
        with database_connection(self.database_path) as conn:
            admin_row = conn.execute("select * from admin_users where id = 'admin-1'").fetchone()

        with mock.patch("Backend.app.config.DB_PATH", self.database_path):
            token = create_admin_session(admin_row)
            self.assertIsNotNone(find_admin_by_session(token))

            # 2. Reset password via CLI
            exit_code = admin_cli.main(
                [
                    "reset-password",
                    "--email",
                    "admin@salut.test",
                    "--password",
                    "NewAdminSecret123!",
                    "--db",
                    str(self.database_path),
                ]
            )
            self.assertEqual(exit_code, 0)

            # 3. Verify session was revoked
            self.assertIsNone(find_admin_by_session(token))

            # 4. Verify new password can authenticate
            authed = authenticate_admin("admin@salut.test", "NewAdminSecret123!")
            self.assertIsNotNone(authed)

    def test_cli_list_admins_does_not_leak_hashes(self) -> None:
        stdout_capture = io.StringIO()
        with mock.patch("sys.stdout", stdout_capture):
            exit_code = admin_cli.main(["list", "--db", str(self.database_path)])
        self.assertEqual(exit_code, 0)
        output = stdout_capture.getvalue()
        self.assertIn("super@salut.test", output)
        self.assertIn("admin@salut.test", output)
        self.assertIn("super_admin", output)
        # Verify no raw hash or salt leaked
        self.assertNotIn("pbkdf2", output)
        self.assertNotIn("password_hash", output)

    def test_cli_set_active_and_last_super_admin_protection(self) -> None:
        # Deactivating regular admin succeeds
        exit_code = admin_cli.main(
            [
                "set-active",
                "--email",
                "admin@salut.test",
                "--active",
                "0",
                "--db",
                str(self.database_path),
            ]
        )
        self.assertEqual(exit_code, 0)

        with database_connection(self.database_path) as conn:
            row = conn.execute("select is_active from admin_users where id = 'admin-1'").fetchone()
            self.assertEqual(row["is_active"], 0)

        # Deactivating the only active super_admin fails
        stderr_capture = io.StringIO()
        with mock.patch("sys.stderr", stderr_capture):
            exit_code = admin_cli.main(
                [
                    "set-active",
                    "--email",
                    "super@salut.test",
                    "--active",
                    "0",
                    "--db",
                    str(self.database_path),
                ]
            )
        self.assertEqual(exit_code, 1)
        self.assertIn("super_admin aktif terakhir", stderr_capture.getvalue())
