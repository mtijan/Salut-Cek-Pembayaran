"""Disk capacity monitoring utility.

This module inspects disk usage across designated filesystem paths and alerts when
usage surpasses a configured percentage threshold (default 85%).
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from pathlib import Path

from Backend.app.notifications import WebhookDeliveryError, notify_disk_alert


def disk_capacity_report(paths: list[str | Path], threshold_percent: float = 85.0) -> dict[str, object]:
    """Inspect disk usage across designated filesystem paths and generate threshold alert report."""
    if not 0 < threshold_percent < 100:
        raise ValueError("Threshold kapasitas disk harus di antara 0 dan 100 persen.")
    if not paths:
        raise ValueError("Minimal satu path kapasitas disk wajib diperiksa.")

    results: list[dict[str, object]] = []
    for raw_path in paths:
        path = Path(raw_path).resolve()
        usage = shutil.disk_usage(path)
        used_percent = round((usage.used / usage.total) * 100, 2) if usage.total else 100.0
        results.append(
            {
                "path": str(path),
                "used_percent": used_percent,
                "free_bytes": usage.free,
                "threshold_percent": threshold_percent,
                "alert": used_percent >= threshold_percent,
            }
        )

    return {
        "status": "alert" if any(item["alert"] for item in results) else "ok",
        "filesystems": results,
    }


def _positive_float_env(name: str, default: float) -> float:
    try:
        value = float(os.environ.get(name, str(default)))
    except ValueError as exc:
        raise ValueError(f"{name} wajib berupa angka positif.") from exc
    if value <= 0:
        raise ValueError(f"{name} wajib berupa angka positif.")
    return value


def _positive_int_env(name: str, default: int) -> int:
    try:
        value = int(os.environ.get(name, str(default)))
    except ValueError as exc:
        raise ValueError(f"{name} wajib berupa bilangan bulat positif.") from exc
    if value < 1:
        raise ValueError(f"{name} wajib berupa bilangan bulat positif.")
    return value


def main(argv: list[str] | None = None) -> int:
    """Run the capacity check and optionally deliver a sanitized HTTPS webhook alert."""
    parser = argparse.ArgumentParser(description="Periksa kapasitas filesystem aplikasi dan backup.")
    parser.add_argument(
        "--path", action="append", required=True, dest="paths", help="Path yang diperiksa; dapat diulang."
    )
    parser.add_argument("--threshold-percent", type=float, default=85.0, help="Ambang pemakaian disk (default 85).")
    args = parser.parse_args(argv)

    report = disk_capacity_report(args.paths, args.threshold_percent)
    print(json.dumps(report, ensure_ascii=False, sort_keys=True))
    if report["status"] == "ok":
        return 0

    webhook_url = os.environ.get("DISK_ALERT_WEBHOOK_URL", "").strip()
    if webhook_url:
        try:
            notify_disk_alert(
                report,
                webhook_url,
                timeout_seconds=_positive_float_env("DISK_ALERT_TIMEOUT_SECONDS", 5.0),
                max_attempts=_positive_int_env("DISK_ALERT_MAX_ATTEMPTS", 3),
                backoff_seconds=_positive_float_env("DISK_ALERT_BACKOFF_SECONDS", 0.5),
            )
        except (ValueError, WebhookDeliveryError):
            print("ERROR: Notifikasi kapasitas disk gagal.", file=sys.stderr)
            return 2
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
