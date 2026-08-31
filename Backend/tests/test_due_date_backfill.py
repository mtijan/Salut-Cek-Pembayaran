from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from Backend.db import database_connection, database_transaction, migrate_database
from Backend.due_date_backfill import (
    apply_due_date_backfill,
    inventory_due_dates,
    normalize_historical_due_date,
    rollback_due_date_backfill,
)
from Backend.verify_backup import verify_backup


class DueDateBackfillTests(unittest.TestCase):
    @staticmethod
    def _database(directory: Path, due_dates: list[str]) -> Path:
        database = directory / "salut.sqlite"
        migrate_database(database)
        with database_transaction(database) as conn:
            conn.execute(
                "insert into students (id, nim, full_name, name_norm) values (?, ?, ?, ?)",
                ("backfill-student", "920001", "Synthetic Student", "synthetic student"),
            )
            for index, due_date in enumerate(due_dates, start=1):
                conn.execute(
                    """
                    insert into bills
                      (id, student_id, briva, amount, period, bill_type, instructions, due_date, source_file, updated_at)
                    values (?, 'backfill-student', ?, 100000, '2026.1', 'UKT', 'Bayar', ?, 'synthetic.xlsx', ?)
                    """,
                    (
                        f"backfill-bill-{index}",
                        f"99200{index}",
                        due_date,
                        f"2026-01-{index:02d} 00:00:00",
                    ),
                )
        return database

    def test_normalizer_accepts_only_explicit_supported_formats(self) -> None:
        self.assertEqual(
            normalize_historical_due_date("07 Agustus 2026 Pukul 11.59 WIB"), ("2026-08-07", "indonesian_text")
        )
        self.assertEqual(normalize_historical_due_date("7/8/2026"), ("2026-08-07", "day_first_numeric"))
        self.assertEqual(normalize_historical_due_date("2026-08-07 00:00:00"), ("2026-08-07", "iso_datetime"))
        self.assertEqual(normalize_historical_due_date("2026-08-07"), (None, "iso"))
        self.assertEqual(normalize_historical_due_date("akhir semester"), (None, "unrecognized"))

    def test_inventory_is_aggregate_and_contains_no_row_or_student_identity(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = self._database(
                Path(temporary_directory),
                ["07 Agustus 2026 Pukul 11.59 WIB", "2026-08-08", "akhir semester"],
            )
            report = inventory_due_dates(database)
            serialized = json.dumps(report, sort_keys=True)
            self.assertEqual(report["normalizable"], 1)
            self.assertEqual(report["already_iso"], 1)
            self.assertEqual(report["unresolved"], 1)
            self.assertNotIn("backfill-bill", serialized)
            self.assertNotIn("Synthetic Student", serialized)
            self.assertNotIn("07 Agustus", serialized)

    def test_apply_requires_clean_inventory_then_backup_and_rollback_round_trip(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            database = self._database(directory, ["07 Agustus 2026 Pukul 11.59 WIB", "8/8/2026", "2026-08-09"])
            backups = directory / "backups"

            applied = apply_due_date_backfill(database, backups)
            self.assertEqual(applied["status"], "applied")
            self.assertEqual(applied["normalizable"], 2)
            self.assertEqual(verify_backup(Path(str(applied["backup_archive"])))["restore_smoke"], "ok")
            with database_connection(database) as conn:
                normalized = [row[0] for row in conn.execute("select due_date from bills order by id")]
                status = conn.execute(
                    "select status from due_date_backfill_runs where id = ?", (applied["run_id"],)
                ).fetchone()[0]
            self.assertEqual(normalized, ["2026-08-07", "2026-08-08", "2026-08-09"])
            self.assertEqual(status, "applied")

            rolled_back = rollback_due_date_backfill(database, backups, str(applied["run_id"]))
            self.assertEqual(rolled_back["restored"], 2)
            self.assertNotEqual(rolled_back["backup_archive"], applied["backup_archive"])
            with database_connection(database) as conn:
                restored = [row[0] for row in conn.execute("select due_date from bills order by id")]
                restored_updates = [row[0] for row in conn.execute("select updated_at from bills order by id")]
                status = conn.execute(
                    "select status from due_date_backfill_runs where id = ?", (applied["run_id"],)
                ).fetchone()[0]
            self.assertEqual(restored, ["07 Agustus 2026 Pukul 11.59 WIB", "8/8/2026", "2026-08-09"])
            self.assertEqual(
                restored_updates,
                ["2026-01-01 00:00:00", "2026-01-02 00:00:00", "2026-01-03 00:00:00"],
            )
            self.assertEqual(status, "rolled_back")

    def test_unresolved_values_block_apply_unless_explicitly_allowed(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            database = self._database(directory, ["07 Agustus 2026", "akhir semester"])
            backups = directory / "backups"
            with self.assertRaisesRegex(RuntimeError, "tidak dikenali"):
                apply_due_date_backfill(database, backups)
            self.assertEqual(list(backups.glob("*.zip")) if backups.exists() else [], [])

            applied = apply_due_date_backfill(database, backups, allow_unresolved=True)
            self.assertEqual(applied["normalizable"], 1)
            self.assertEqual(applied["unresolved"], 1)
            with database_connection(database) as conn:
                values = [row[0] for row in conn.execute("select due_date from bills order by id")]
            self.assertEqual(values, ["2026-08-07", "akhir semester"])
