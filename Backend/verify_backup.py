from __future__ import annotations

import argparse
import sqlite3
import tempfile
import zipfile
from pathlib import Path

from Backend.backup_sqlite import backup_timestamp


def verify_backup(archive: Path) -> None:
    if not archive.is_file():
        raise FileNotFoundError(f"Backup tidak ditemukan: {archive}")
    with tempfile.TemporaryDirectory(prefix="salut-backup-verify-") as temporary_directory:
        temporary_path = Path(temporary_directory)
        with zipfile.ZipFile(archive) as zip_file:
            members = [member for member in zip_file.infolist() if not member.is_dir()]
            if len(members) != 1 or not members[0].filename.endswith(".sqlite"):
                raise ValueError("Arsip backup harus berisi tepat satu file SQLite.")
            zip_file.extract(members[0], temporary_path)
        database_path = temporary_path / members[0].filename
        connection = sqlite3.connect(database_path)
        try:
            result = connection.execute("pragma integrity_check").fetchone()[0]
        finally:
            connection.close()
        if result != "ok":
            raise RuntimeError(f"SQLite integrity_check gagal: {result}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Verifikasi restore sementara dan integritas backup SQLite.")
    parser.add_argument("--archive", help="Path backup ZIP yang ingin diverifikasi.")
    parser.add_argument("--directory", help="Folder backup; backup terbaru akan dipilih.")
    args = parser.parse_args()
    if bool(args.archive) == bool(args.directory):
        parser.error("Pilih tepat satu: --archive atau --directory.")
    if args.archive:
        archive = Path(args.archive)
    else:
        candidates = [(backup_timestamp(path), path) for path in Path(args.directory).glob("salut-*.sqlite.zip")]
        archive = max((item for item in candidates if item[0] is not None), default=(None, None))[1]
        if archive is None:
            raise FileNotFoundError("Tidak ada backup Salut yang dapat diverifikasi.")
    verify_backup(archive)
    print(f"Backup verified: {archive}")


if __name__ == "__main__":
    main()
