"""Automated SQLite database backup and rotation utility.

This module uses SQLite's online backup API to create consistent, compressed point-in-time
zip snapshots and retains a grandfather-father-son (GFS) rotation scheme: 14 daily, 8 weekly, and 12 monthly restore points.
"""

from __future__ import annotations

import argparse
import shutil
import sqlite3
from datetime import datetime, timezone
from pathlib import Path


BACKUP_PREFIX = "salut-"
BACKUP_SUFFIX = ".sqlite.zip"


def backup_timestamp(path: Path) -> datetime | None:
    """Parse UTC datetime timestamp from backup filename."""
    name = path.name
    if not name.startswith(BACKUP_PREFIX) or not name.endswith(BACKUP_SUFFIX):
        return None
    try:
        return datetime.strptime(name[len(BACKUP_PREFIX) : -len(BACKUP_SUFFIX)], "%Y%m%dT%H%M%SZ").replace(
            tzinfo=timezone.utc
        )
    except ValueError:
        return None


def prune_backups(destination_dir: Path, now: datetime | None = None) -> list[Path]:
    """Keep 14 daily, 8 weekly, and 12 monthly backup restore points."""
    now = now or datetime.now(timezone.utc)
    backups = [
        (timestamp, path)
        for path in destination_dir.glob("salut-*.sqlite.zip")
        if (timestamp := backup_timestamp(path))
    ]
    backups.sort(reverse=True, key=lambda item: item[0])
    keep: set[Path] = set()
    weekly: set[tuple[int, int]] = set()
    monthly: set[tuple[int, int]] = set()
    for timestamp, path in backups:
        age_days = (now.date() - timestamp.date()).days
        if age_days <= 13:
            keep.add(path)
            continue
        year, week, _ = timestamp.isocalendar()
        if age_days <= 7 * 8 and (year, week) not in weekly:
            weekly.add((year, week))
            keep.add(path)
            continue
        month_key = (timestamp.year, timestamp.month)
        if age_days <= 366 and month_key not in monthly:
            monthly.add(month_key)
            keep.add(path)

    removed: list[Path] = []
    for _, path in backups:
        if path not in keep:
            path.unlink()
            removed.append(path)
    return removed


def backup_database(source: Path, destination_dir: Path) -> Path:
    """Create point-in-time SQLite online backup and zip archive, then prune old backups."""
    if not source.exists():
        raise FileNotFoundError(f"Database tidak ditemukan: {source}")

    destination_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    destination = destination_dir / f"salut-{timestamp}.sqlite"
    source_conn = sqlite3.connect(source)
    destination_conn = sqlite3.connect(destination)
    try:
        source_conn.backup(destination_conn)
    finally:
        destination_conn.close()
        source_conn.close()
    archive = shutil.make_archive(str(destination), "zip", destination_dir, destination.name)
    destination.unlink(missing_ok=True)
    archive_path = Path(archive)
    prune_backups(destination_dir)
    return archive_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Buat backup konsisten SQLite Salut Cek Pembayaran.")
    parser.add_argument("--source", required=True, help="Path database SQLite sumber.")
    parser.add_argument("--destination", required=True, help="Folder backup yang tidak berada di webroot.")
    args = parser.parse_args()
    print(backup_database(Path(args.source), Path(args.destination)))


if __name__ == "__main__":
    main()
