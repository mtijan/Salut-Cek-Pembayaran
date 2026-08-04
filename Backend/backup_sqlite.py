from __future__ import annotations

import argparse
import shutil
import sqlite3
from datetime import UTC, datetime
from pathlib import Path


def backup_database(source: Path, destination_dir: Path) -> Path:
    if not source.exists():
        raise FileNotFoundError(f"Database tidak ditemukan: {source}")

    destination_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    destination = destination_dir / f"salut-{timestamp}.sqlite"
    with sqlite3.connect(source) as source_conn, sqlite3.connect(destination) as destination_conn:
        source_conn.backup(destination_conn)
    archive = shutil.make_archive(str(destination), "zip", destination_dir, destination.name)
    destination.unlink(missing_ok=True)
    return Path(archive)


def main() -> None:
    parser = argparse.ArgumentParser(description="Buat backup konsisten SQLite Salut Cek Pembayaran.")
    parser.add_argument("--source", required=True, help="Path database SQLite sumber.")
    parser.add_argument("--destination", required=True, help="Folder backup yang tidak berada di webroot.")
    args = parser.parse_args()
    print(backup_database(Path(args.source), Path(args.destination)))


if __name__ == "__main__":
    main()
