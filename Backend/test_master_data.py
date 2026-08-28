from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from Backend.app.services import (
    create_student,
    list_students,
)
from db import connect, init_db, migrate_database
from Backend.test_base import BackendBaseTestCase


class MasterDataTests(BackendBaseTestCase):
    def test_schema_migration_and_master_data(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            conn = connect(database)
            init_db(conn)
            prodi_count = conn.execute("select count(*) as cnt from study_programs").fetchone()["cnt"]
            period_count = conn.execute("select count(*) as cnt from academic_periods").fetchone()["cnt"]
            bill_type_count = conn.execute("select count(*) as cnt from bill_types").fetchone()["cnt"]
            conn.close()

            self.assertGreaterEqual(prodi_count, 5)
            self.assertGreaterEqual(period_count, 2)
            self.assertGreaterEqual(bill_type_count, 3)

    def test_schema_migration_runs_once_and_does_not_restore_deleted_master_data(self) -> None:
        """A normal service initialization must not rerun seed data or migrations."""
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            conn = connect(database)
            init_db(conn)
            version = conn.execute("select max(version) as version from schema_migrations").fetchone()["version"]
            self.assertEqual(version, 2)
            conn.execute("delete from study_programs where id = ?", ("sp_hkum",))
            conn.commit()
            conn.close()

            # This mirrors a later service request opening the same database.
            conn = connect(database)
            init_db(conn)
            deleted = conn.execute("select id from study_programs where id = ?", ("sp_hkum",)).fetchone()
            conn.close()
            self.assertIsNone(deleted)

    def test_automatic_academic_period_registration_handles_readable_id_collisions(self) -> None:
        from Backend.db import ensure_academic_period

        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            conn = connect(database)
            init_db(conn)
            with conn:
                ensure_academic_period(conn, "2025.1")
            rows = conn.execute(
                "select id, code from academic_periods where code in ('20251', '2025.1') order by code"
            ).fetchall()
            conn.close()

            self.assertEqual({row["code"] for row in rows}, {"20251", "2025.1"})
            self.assertEqual(len({row["id"] for row in rows}), 2)

    def test_study_programs_crud(self) -> None:
        from Backend.app.services import (
            create_study_program,
            delete_study_program,
            list_study_programs,
            update_study_program,
        )

        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            migrate_database(database)
            # Invalid code length (< 4 or > 4) must fail
            with self.assertRaises(ValueError):
                create_study_program(database, {"code": "TI", "name": "Teknik Informatika"})
            with self.assertRaises(ValueError):
                create_study_program(database, {"code": "TINFOR", "name": "Teknik Informatika"})

            # Create with valid 4-character code
            created = create_study_program(
                database, {"code": "TINF", "name": "Teknik Informatika", "degree": "S1", "faculty": "FST"}
            )
            self.assertEqual(created["code"], "TINF")
            self.assertEqual(created["name"], "Teknik Informatika")

            # List
            prodis = list_study_programs(database)
            self.assertTrue(any(p["code"] == "TINF" for p in prodis))

            # Update
            updated = update_study_program(database, created["id"], {"name": "S1 Teknik Informatika"})
            self.assertIsNotNone(updated)
            self.assertEqual(updated["name"], "S1 Teknik Informatika")

            # Delete
            deleted = delete_study_program(database, created["id"])
            self.assertTrue(deleted)
            prodis_after = list_study_programs(database)
            self.assertFalse(any(p["code"] == "TINF" for p in prodis_after))

            conn = connect(database)
            inactive = conn.execute("select is_active from study_programs where id = ?", (created["id"],)).fetchone()
            conn.close()
            self.assertEqual(inactive["is_active"], 0)

    def test_academic_periods_crud(self) -> None:
        from Backend.app.services import create_academic_period, list_academic_periods, update_academic_period

        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            migrate_database(database)
            # Create
            created = create_academic_period(
                database,
                {
                    "code": "20261",
                    "name": "2026/2027 Ganjil",
                    "semester_type": "ganjil",
                    "is_active": 1,
                    "default_due_date": "2026-09-30",
                },
            )
            self.assertEqual(created["code"], "20261")
            self.assertEqual(created["is_active"], 1)

            # Check that only one period is active
            periods = list_academic_periods(database)
            active_periods = [p for p in periods if p["is_active"] == 1]
            self.assertEqual(len(active_periods), 1)
            self.assertEqual(active_periods[0]["code"], "20261")

            # Update
            updated = update_academic_period(database, created["id"], {"name": "2026/2027 Semester Ganjil"})
            self.assertIsNotNone(updated)
            self.assertEqual(updated["name"], "2026/2027 Semester Ganjil")

    def test_study_program_4_char_codes_and_student_filtering(self) -> None:
        from Backend.app.services import list_study_programs
        from Backend.db import connect, init_db, resolve_study_program_id

        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            conn = connect(database)
            init_db(conn)
            conn.close()

            # Verify all seeded prodis have exactly 4 character codes
            prodis = list_study_programs(database)
            self.assertGreaterEqual(len(prodis), 30)
            for p in prodis:
                self.assertEqual(len(p["code"]), 4, f"Prodi {p['code']} length is not 4")
                self.assertTrue(p["code"].isupper(), f"Prodi {p['code']} is not uppercase")

            # Test resolve_study_program_id
            conn = connect(database)
            self.assertIsNotNone(resolve_study_program_id(conn, "FHISIP - Ilmu Hukum"))
            self.assertIsNotNone(resolve_study_program_id(conn, "FEB - Manajemen"))
            self.assertIsNotNone(resolve_study_program_id(conn, "FST - Sistem Informasi"))
            self.assertIsNotNone(resolve_study_program_id(conn, "FKIP - PGSD"))
            conn.close()

            # Create students with different prodis
            create_student(
                database,
                {
                    "nim": "1001",
                    "full_name": "Mahasiswa Hukum",
                    "program_study": "FHISIP - Ilmu Hukum",
                    "study_program_id": "sp_hkum",
                },
            )
            create_student(
                database,
                {
                    "nim": "1002",
                    "full_name": "Mahasiswa Sistem Informasi",
                    "program_study": "FST - Sistem Informasi",
                    "study_program_id": "sp_sifo",
                },
            )

            # Filter by study_program_id
            hukum_list = list_students(database, study_program_id="sp_hkum")
            self.assertEqual(len(hukum_list), 1)
            self.assertEqual(hukum_list[0]["nim"], "1001")
            self.assertEqual(hukum_list[0]["study_program_code"], "HKUM")

            sifo_list = list_students(database, study_program_id="sp_sifo")
            self.assertEqual(len(sifo_list), 1)
            self.assertEqual(sifo_list[0]["nim"], "1002")
            self.assertEqual(sifo_list[0]["study_program_code"], "SIFO")

            # Search by prodi code in general search
            code_search = list_students(database, query="HKUM")
            self.assertEqual(len(code_search), 1)
            self.assertEqual(code_search[0]["nim"], "1001")

            # Search by prodi name in general search
            name_search = list_students(database, query="Sistem Informasi")
            self.assertEqual(len(name_search), 1)
            self.assertEqual(name_search[0]["nim"], "1002")


if __name__ == "__main__":
    unittest.main()
