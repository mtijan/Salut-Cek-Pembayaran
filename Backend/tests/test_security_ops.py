from __future__ import annotations

import sys
import sqlite3
import tempfile
import unittest
import zipfile
from datetime import datetime
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import server
from Backend.app import config as app_config
from Backend.app.version import APP_VERSION
from Backend.app.services import (
    validate_runtime_configuration,
)
from db import LATEST_SCHEMA_VERSION, connect, init_db
from fastapi.testclient import TestClient
from Backend.tests.test_base import BackendBaseTestCase


class SecurityAndOperationsTests(BackendBaseTestCase):
    def test_production_runtime_configuration_rejects_placeholder_values(self) -> None:
        with (
            mock.patch.object(app_config, "APP_ENV", "production"),
            mock.patch.object(app_config, "PROCESS_WORKERS", 1),
            mock.patch.object(app_config, "LOOKUP_HASH_SECRET", "change-this-to-a-secure-random-secret"),
            mock.patch.object(app_config, "ADMIN_BOOTSTRAP_EMAIL", "admin@example.com"),
            mock.patch.object(app_config, "ADMIN_BOOTSTRAP_PASSWORD", "AdminSecurePassword123!"),
        ):
            with self.assertRaisesRegex(RuntimeError, "placeholder atau lemah"):
                validate_runtime_configuration()

        with (
            mock.patch.object(app_config, "APP_ENV", "production"),
            mock.patch.object(app_config, "PROCESS_WORKERS", 1),
            mock.patch.object(app_config, "LOOKUP_HASH_SECRET", "0123456789abcdef0123456789abcdef"),
            mock.patch.object(app_config, "ADMIN_BOOTSTRAP_EMAIL", "operator@salut.id"),
            mock.patch.object(app_config, "ADMIN_BOOTSTRAP_PASSWORD", "SangatKuat-2026!"),
        ):
            validate_runtime_configuration()

    def test_production_runtime_configuration_rejects_in_memory_limiter_scale_out(self) -> None:
        for worker_count in (0, 2):
            with self.subTest(worker_count=worker_count):
                with (
                    mock.patch.object(app_config, "APP_ENV", "production"),
                    mock.patch.object(app_config, "PROCESS_WORKERS", worker_count),
                    mock.patch.object(app_config, "LOOKUP_HASH_SECRET", "0123456789abcdef0123456789abcdef"),
                    mock.patch.object(app_config, "ADMIN_BOOTSTRAP_EMAIL", "operator@salut.id"),
                    mock.patch.object(app_config, "ADMIN_BOOTSTRAP_PASSWORD", "SangatKuat-2026!"),
                ):
                    with self.assertRaisesRegex(RuntimeError, "hanya aman untuk satu worker"):
                        validate_runtime_configuration()

    def test_public_health_does_not_leak_counts(self) -> None:
        client = TestClient(server.app)
        response = client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["data"],
            {"status": "ok", "version": APP_VERSION, "release_id": app_config.RELEASE_ID},
        )

    def test_release_id_auto_follows_git_head(self) -> None:
        with mock.patch.object(app_config, "_read_git_release_id", return_value="554ab37"):
            self.assertEqual(app_config.resolve_release_id("auto"), "554ab37")
            self.assertEqual(app_config.resolve_release_id("git"), "554ab37")

    def test_release_id_manual_override_still_supported(self) -> None:
        with mock.patch.object(app_config, "_read_git_release_id") as git_reader:
            self.assertEqual(app_config.resolve_release_id("release-label"), "release-label")
            git_reader.assert_not_called()

    def test_application_csp_blocks_inline_style_elements_and_external_fonts(self) -> None:
        response = TestClient(server.app).get("/")
        self.assertEqual(response.status_code, 200)
        directives = {}
        for directive in response.headers["content-security-policy"].split(";"):
            parts = directive.strip().split()
            if parts:
                directives[parts[0]] = parts[1:]

        self.assertEqual(directives["script-src"], ["'self'"])
        self.assertEqual(directives["style-src"], ["'self'"])
        self.assertEqual(directives["style-src-elem"], ["'self'"])
        self.assertEqual(directives["font-src"], ["'self'"])
        self.assertEqual(directives["object-src"], ["'none'"])
        self.assertEqual(directives["form-action"], ["'self'"])
        self.assertNotIn("fonts.googleapis.com", response.headers["content-security-policy"])
        self.assertNotIn("fonts.gstatic.com", response.headers["content-security-policy"])
        self.assertNotIn("style-src-attr", directives)
        self.assertNotIn("'unsafe-inline'", directives["style-src"])

    def test_backup_rotation_keeps_daily_weekly_and_monthly_restore_points(self) -> None:
        from datetime import timedelta, timezone
        from Backend.backup_sqlite import prune_backups

        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            now = datetime(2026, 8, 22, tzinfo=timezone.utc)
            for day in range(0, 500, 3):
                timestamp = now - timedelta(days=day)
                (directory / f"salut-{timestamp.strftime('%Y%m%dT%H%M%SZ')}.sqlite.zip").touch()
            removed = prune_backups(directory, now)
            retained = list(directory.glob("salut-*.sqlite.zip"))
            self.assertGreater(len(removed), 0)
            self.assertLessEqual(len(retained), 14 + 8 + 12)
            self.assertTrue(any("20260822" in path.name for path in retained))

        backup_source = (Path(__file__).resolve().parents[1] / "backup_sqlite.py").read_text(encoding="utf-8")
        self.assertNotIn("from datetime import UTC", backup_source)

    def test_sqlite_backup_can_be_verified_from_archive(self) -> None:
        from Backend.backup_sqlite import backup_database
        from Backend.verify_backup import verify_backup

        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            database = directory / "source.sqlite"
            conn = connect(database)
            init_db(conn)
            conn.close()
            archive = backup_database(database, directory / "backups")
            report = verify_backup(archive)
            self.assertEqual(report["schema_version"], LATEST_SCHEMA_VERSION)
            self.assertEqual(report["restore_smoke"], "ok")

    def test_backup_verification_rejects_incomplete_application_schema(self) -> None:
        from Backend.verify_backup import verify_backup

        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            database = directory / "incomplete.sqlite"
            conn = sqlite3.connect(database)
            conn.execute("create table schema_migrations (version integer primary key)")
            conn.execute("insert into schema_migrations (version) values (?)", (LATEST_SCHEMA_VERSION,))
            conn.commit()
            conn.close()
            archive = directory / "incomplete.sqlite.zip"
            with zipfile.ZipFile(archive, "w") as zip_file:
                zip_file.write(database, database.name)
            with self.assertRaisesRegex(RuntimeError, "Schema backup tidak lengkap"):
                verify_backup(archive)

    def test_backup_verification_rejects_nested_archive_member(self) -> None:
        from Backend.verify_backup import verify_backup

        with tempfile.TemporaryDirectory() as temporary_directory:
            archive = Path(temporary_directory) / "nested.sqlite.zip"
            with zipfile.ZipFile(archive, "w") as zip_file:
                zip_file.writestr("../nested.sqlite", b"not-a-database")
            with self.assertRaisesRegex(ValueError, "tepat satu file SQLite"):
                verify_backup(archive)

    def test_python_systemd_jobs_use_package_module_entrypoints(self) -> None:
        project_root = Path(__file__).resolve().parents[2]
        maintenance_unit_path = project_root / "deploy" / "salut-cek-pembayaran-maintenance.service"
        verify_unit_path = project_root / "deploy" / "salut-cek-pembayaran-backup-verify.service"
        if not maintenance_unit_path.is_file() or not verify_unit_path.is_file():
            self.skipTest("internal deployment bundle is not part of the public repository")

        maintenance_unit = maintenance_unit_path.read_text(encoding="utf-8")
        verify_unit = verify_unit_path.read_text(encoding="utf-8")
        self.assertIn("python -m Backend.maintenance", maintenance_unit)
        self.assertIn("python -m Backend.verify_backup", verify_unit)
        self.assertNotIn("python /opt/salut-cek-pembayaran/Backend/maintenance.py", maintenance_unit)
        self.assertNotIn("python3 /opt/salut-cek-pembayaran/Backend/verify_backup.py", verify_unit)


if __name__ == "__main__":
    unittest.main()


if __name__ == "__main__":
    unittest.main()
