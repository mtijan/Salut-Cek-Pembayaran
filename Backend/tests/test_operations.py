from __future__ import annotations

import unittest
from pathlib import Path
from unittest import mock

from Backend.check_disk_capacity import disk_capacity_report


class OperationsTests(unittest.TestCase):
    def test_disk_capacity_report_is_ok_below_threshold(self) -> None:
        usage = mock.Mock(total=1000, used=700, free=300)
        with mock.patch("Backend.check_disk_capacity.shutil.disk_usage", return_value=usage):
            report = disk_capacity_report([Path(".")], threshold_percent=85)
        self.assertEqual(report["status"], "ok")
        self.assertEqual(report["filesystems"][0]["used_percent"], 70.0)

    def test_disk_capacity_report_alerts_at_threshold(self) -> None:
        usage = mock.Mock(total=1000, used=850, free=150)
        with mock.patch("Backend.check_disk_capacity.shutil.disk_usage", return_value=usage):
            report = disk_capacity_report([Path(".")], threshold_percent=85)
        self.assertEqual(report["status"], "alert")
        self.assertTrue(report["filesystems"][0]["alert"])

    def test_disk_capacity_report_rejects_invalid_input(self) -> None:
        with self.assertRaisesRegex(ValueError, "Minimal satu path"):
            disk_capacity_report([])
        with self.assertRaisesRegex(ValueError, "di antara 0 dan 100"):
            disk_capacity_report([Path(".")], threshold_percent=100)

    def test_disk_capacity_systemd_unit_uses_package_entrypoint(self) -> None:
        project_root = Path(__file__).resolve().parents[2]
        service_path = project_root / "deploy" / "salut-cek-pembayaran-disk-capacity.service"
        timer_path = project_root / "deploy" / "salut-cek-pembayaran-disk-capacity.timer"
        if not service_path.is_file() or not timer_path.is_file():
            self.skipTest("internal deployment bundle is not part of the public repository")

        service = service_path.read_text(encoding="utf-8")
        timer = timer_path.read_text(encoding="utf-8")
        self.assertIn("WorkingDirectory=/opt/salut-cek-pembayaran", service)
        self.assertIn("python -m Backend.check_disk_capacity", service)
        self.assertIn("--threshold-percent 85", service)
        self.assertIn("/var/lib/salut-cek-pembayaran", service)
        self.assertIn("/var/backups/salut-cek-pembayaran", service)
        self.assertIn("OnCalendar=", timer)


if __name__ == "__main__":
    unittest.main()
