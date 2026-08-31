"""Disk capacity monitoring utility.

This module inspects disk usage across designated filesystem paths and alerts when
usage surpasses a configured percentage threshold (default 85%).
"""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path


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


def main() -> None:
    parser = argparse.ArgumentParser(description="Periksa kapasitas filesystem aplikasi dan backup.")
    parser.add_argument(
        "--path", action="append", required=True, dest="paths", help="Path yang diperiksa; dapat diulang."
    )
    parser.add_argument("--threshold-percent", type=float, default=85.0, help="Ambang pemakaian disk (default 85).")
    args = parser.parse_args()

    report = disk_capacity_report(args.paths, args.threshold_percent)
    print(json.dumps(report, ensure_ascii=False, sort_keys=True))
    if report["status"] != "ok":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
