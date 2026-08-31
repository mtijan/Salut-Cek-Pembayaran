"""Backup integrity verification utility.

This module validates archive structure, SQLite integrity, application schema,
foreign keys, and an isolated SQLite restore smoke copy.
"""

from __future__ import annotations

import argparse
import shutil
import sqlite3
import tempfile
import zipfile
from pathlib import Path

from Backend.backup_sqlite import backup_timestamp
from Backend.db import LATEST_SCHEMA_VERSION


def _schema_version(connection: sqlite3.Connection) -> int:
    try:
        row = connection.execute("select max(version) from schema_migrations").fetchone()
    except sqlite3.Error as exc:
        raise RuntimeError("Backup bukan database aplikasi: schema_migrations tidak tersedia.") from exc
    version = int(row[0]) if row and row[0] is not None else 0
    if version < 1 or version > LATEST_SCHEMA_VERSION:
        raise RuntimeError(f"Schema backup version {version} tidak didukung aplikasi version {LATEST_SCHEMA_VERSION}.")
    return version


def _require_schema_object(connection: sqlite3.Connection, object_type: str, name: str) -> None:
    row = connection.execute(
        "select 1 from sqlite_master where type = ? and name = ?",
        (object_type, name),
    ).fetchone()
    if not row:
        raise RuntimeError(f"Schema backup tidak lengkap: {object_type} {name} tidak tersedia.")


def verify_application_schema(connection: sqlite3.Connection) -> int:
    """Validate version-aware critical tables, columns, indexes, and triggers."""
    version = _schema_version(connection)
    required_columns = {
        "students": {"id", "nim", "full_name", "deleted_at"},
        "bills": {"id", "student_id", "briva", "amount", "paid_amount", "due_date", "deleted_at"},
        "admin_users": {"id", "email", "role", "is_active"},
    }
    if version >= 2:
        required_columns["payment_transactions"] = {"id", "bill_id", "student_id", "amount"}
    if version >= 3:
        required_columns["import_previews"] = {"token", "admin_id", "claim_id", "claimed_at"}
    if version >= 4:
        required_columns["due_date_backfill_runs"] = {
            "id",
            "status",
            "backup_archive",
            "rollback_backup_archive",
        }
        required_columns["due_date_backfill_changes"] = {
            "run_id",
            "bill_id",
            "old_due_date",
            "new_due_date",
            "old_updated_at",
            "new_updated_at",
        }

    for table, expected_columns in required_columns.items():
        _require_schema_object(connection, "table", table)
        actual_columns = {str(row[1]) for row in connection.execute(f'pragma table_info("{table}")')}
        missing = sorted(expected_columns - actual_columns)
        if missing:
            raise RuntimeError(f"Schema backup tidak lengkap: kolom {table} hilang ({', '.join(missing)}).")

    _require_schema_object(connection, "index", "idx_bills_student_id")
    if version >= 2:
        _require_schema_object(connection, "trigger", "payment_transactions_no_update")
        _require_schema_object(connection, "trigger", "payment_transactions_no_delete")
    if version >= 4:
        _require_schema_object(connection, "index", "idx_due_date_backfill_changes_bill_id")
    return version


def _verify_database(connection: sqlite3.Connection) -> int:
    integrity = connection.execute("pragma integrity_check").fetchone()[0]
    if integrity != "ok":
        raise RuntimeError(f"SQLite integrity_check gagal: {integrity}")
    if connection.execute("pragma foreign_key_check").fetchone():
        raise RuntimeError("SQLite foreign_key_check menemukan relasi yang rusak.")
    return verify_application_schema(connection)


def verify_backup(archive: Path) -> dict[str, object]:
    """Verify one backup and an isolated restore copy without touching the source database."""
    if not archive.is_file():
        raise FileNotFoundError(f"Backup tidak ditemukan: {archive}")
    with tempfile.TemporaryDirectory(prefix="salut-backup-verify-") as temporary_directory:
        temporary_path = Path(temporary_directory)
        with zipfile.ZipFile(archive) as zip_file:
            members = [member for member in zip_file.infolist() if not member.is_dir()]
            if (
                len(members) != 1
                or not members[0].filename.endswith(".sqlite")
                or Path(members[0].filename).name != members[0].filename
            ):
                raise ValueError("Arsip backup harus berisi tepat satu file SQLite.")
            database_path = temporary_path / members[0].filename
            with zip_file.open(members[0]) as source, database_path.open("wb") as destination:
                shutil.copyfileobj(source, destination)

        source_connection = sqlite3.connect(database_path)
        restored_path = temporary_path / "restore-smoke.sqlite"
        restored_connection = sqlite3.connect(restored_path)
        try:
            source_version = _verify_database(source_connection)
            source_connection.backup(restored_connection)
            restored_version = _verify_database(restored_connection)
        finally:
            restored_connection.close()
            source_connection.close()
        if restored_version != source_version:
            raise RuntimeError("Restore smoke menghasilkan schema version yang berbeda.")
        return {
            "schema_version": source_version,
            "integrity_check": "ok",
            "foreign_key_check": "ok",
            "restore_smoke": "ok",
        }


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
        selected_archive = max((item for item in candidates if item[0] is not None), default=(None, None))[1]
        if selected_archive is None:
            raise FileNotFoundError("Tidak ada backup Salut yang dapat diverifikasi.")
        archive = selected_archive
    report = verify_backup(archive)
    print(f"Backup verified: {archive} (schema v{report['schema_version']}, restore smoke ok)")


if __name__ == "__main__":
    main()
