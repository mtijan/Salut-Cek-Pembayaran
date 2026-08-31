from __future__ import annotations

import json
import unittest
from pathlib import Path
from unittest import mock
from urllib.error import URLError

from Backend.app.notifications import (
    WebhookDeliveryError,
    build_disk_alert_payload,
    notify_disk_alert,
    send_json_webhook,
)
from Backend.check_disk_capacity import disk_capacity_report, main


class OperationsTests(unittest.TestCase):
    class FakeResponse:
        status = 204

        def __enter__(self):
            return self

        def __exit__(self, *_: object) -> None:
            return None

        def getcode(self) -> int:
            return self.status

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

    def test_disk_alert_payload_omits_filesystem_paths(self) -> None:
        report = {
            "status": "alert",
            "filesystems": [
                {
                    "path": "/private/application/path",
                    "used_percent": 91.5,
                    "free_bytes": 1234,
                    "threshold_percent": 85.0,
                    "alert": True,
                }
            ],
        }
        payload = build_disk_alert_payload(report)
        serialized = json.dumps(payload)
        self.assertNotIn("/private/application/path", serialized)
        self.assertEqual(payload["alerting_filesystem_count"], 1)
        self.assertEqual(payload["max_used_percent"], 91.5)

    def test_disk_alert_webhook_retries_with_bounded_backoff(self) -> None:
        attempts: list[int] = []
        sleeps: list[float] = []

        def fake_opener(*_: object, **__: object):
            attempts.append(1)
            if len(attempts) < 3:
                raise URLError("synthetic failure")
            return self.FakeResponse()

        send_json_webhook(
            "https://alerts.example.test/disk",
            {"event": "disk_capacity_alert"},
            max_attempts=3,
            backoff_seconds=0.25,
            opener=fake_opener,
            sleeper=sleeps.append,
        )
        self.assertEqual(len(attempts), 3)
        self.assertEqual(sleeps, [0.25, 0.5])

    def test_disk_alert_webhook_rejects_insecure_or_failed_delivery(self) -> None:
        with self.assertRaisesRegex(ValueError, "HTTPS"):
            send_json_webhook("http://alerts.example.test/disk", {}, opener=lambda *_args, **_kwargs: None)
        with self.assertRaisesRegex(WebhookDeliveryError, "batas percobaan"):
            send_json_webhook(
                "https://alerts.example.test/disk",
                {},
                max_attempts=1,
                opener=lambda *_args, **_kwargs: (_ for _ in ()).throw(URLError("synthetic failure")),
            )

    def test_disk_alert_notification_is_disabled_for_ok_or_unconfigured_reports(self) -> None:
        def unexpected_opener(*_: object, **__: object):
            raise AssertionError("webhook must remain disabled")

        self.assertFalse(notify_disk_alert({"status": "ok", "filesystems": []}, "", opener=unexpected_opener))
        self.assertFalse(notify_disk_alert({"status": "alert", "filesystems": []}, "", opener=unexpected_opener))

    def test_disk_capacity_cli_preserves_exit_codes_without_webhook(self) -> None:
        ok_usage = mock.Mock(total=1000, used=700, free=300)
        alert_usage = mock.Mock(total=1000, used=900, free=100)
        with (
            mock.patch.dict("os.environ", {"DISK_ALERT_WEBHOOK_URL": ""}, clear=False),
            mock.patch("Backend.check_disk_capacity.shutil.disk_usage", return_value=ok_usage),
            mock.patch("builtins.print"),
        ):
            self.assertEqual(main(["--path", "."]), 0)
        with (
            mock.patch.dict("os.environ", {"DISK_ALERT_WEBHOOK_URL": ""}, clear=False),
            mock.patch("Backend.check_disk_capacity.shutil.disk_usage", return_value=alert_usage),
            mock.patch("builtins.print"),
        ):
            self.assertEqual(main(["--path", "."]), 1)

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
        self.assertIn("EnvironmentFile=/etc/salut-cek-pembayaran.env", service)
        self.assertIn("TimeoutStartSec=30", service)
        self.assertIn("OnCalendar=", timer)


if __name__ == "__main__":
    unittest.main()
