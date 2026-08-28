from __future__ import annotations

import ast
from concurrent.futures import ThreadPoolExecutor
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import openpyxl

from Backend.app import services
from Backend.db import (
    LATEST_SCHEMA_VERSION,
    connect,
    database_connection,
    database_transaction,
    init_db,
    migrate_database,
)
from Backend.import_excel import import_workbook


class DatabaseLifecycleTests(unittest.TestCase):
    @staticmethod
    def _initialize(database: Path) -> None:
        conn = connect(database)
        try:
            init_db(conn)
        finally:
            conn.close()

    @staticmethod
    def _write_workbook(path: Path) -> None:
        workbook = openpyxl.Workbook()
        data_sheet = workbook.active
        data_sheet.title = "Data Sinkron"
        data_sheet.append(["No.", "NIM", "Nama Mahasiswa", "BRIVA", "Jumlah"])
        data_sheet.append([1, "910001", "Mahasiswa P1", "990001", 125000])
        issue_sheet = workbook.create_sheet("Data Belum Lengkap")
        issue_sheet.append(["No.", "NIM", "Nama Mahasiswa", "BRIVA", "Jumlah", "Keterangan"])
        workbook.save(path)
        workbook.close()

    def test_explicit_migration_reaches_latest_schema_version(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            migrate_database(database)
            with database_connection(database) as conn:
                version = conn.execute("select max(version) from schema_migrations").fetchone()[0]
            self.assertEqual(version, LATEST_SCHEMA_VERSION)

    def test_ensure_database_bootstraps_an_empty_database(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            with mock.patch.multiple(
                services.config,
                DB_PATH=database,
                APP_ENV="development",
                ADMIN_BOOTSTRAP_EMAIL="p1-admin@example.test",
                ADMIN_BOOTSTRAP_PASSWORD="P1-Test-Password-Only",
            ):
                services.ensure_database()
            with database_connection(database) as conn:
                version = conn.execute("select max(version) from schema_migrations").fetchone()[0]
                admin_total = conn.execute("select count(*) from admin_users").fetchone()[0]
            self.assertEqual(version, LATEST_SCHEMA_VERSION)
            self.assertEqual(admin_total, 1)

    def test_migration_is_idempotent(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            migrate_database(database)
            with database_connection(database) as conn:
                first_versions = [
                    tuple(row)
                    for row in conn.execute(
                        "select version, applied_at from schema_migrations order by version"
                    ).fetchall()
                ]
            migrate_database(database)
            with database_connection(database) as conn:
                second_versions = [
                    tuple(row)
                    for row in conn.execute(
                        "select version, applied_at from schema_migrations order by version"
                    ).fetchall()
                ]
            self.assertEqual(first_versions, second_versions)
            self.assertEqual([int(row[0]) for row in second_versions], [LATEST_SCHEMA_VERSION])

    def test_runtime_modules_do_not_call_init_db(self) -> None:
        backend_root = Path(__file__).resolve().parent
        violations: list[str] = []
        service_paths: list[Path] = []
        services_dir = backend_root / "app" / "services"
        if services_dir.is_dir():
            service_paths.extend(services_dir.glob("*.py"))
        else:
            # Fallback: monolith file if package does not exist.
            service_paths.append(backend_root / "app" / "services.py")
        for relative_path in service_paths + [backend_root / "import_excel.py"]:
            tree = ast.parse(Path(relative_path).read_text(encoding="utf-8"))
            for node in ast.walk(tree):
                if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "init_db":
                    violations.append(f"{relative_path.relative_to(backend_root)}:{node.lineno}")
        self.assertEqual(violations, [])

    def test_import_cli_migrates_before_import(self) -> None:
        source = (Path(__file__).resolve().parent / "import_excel.py").read_text(encoding="utf-8")
        tree = ast.parse(source)
        main_function = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "main")
        calls = [
            (node.func.id, node.lineno)
            for node in ast.walk(main_function)
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
        ]
        call_lines = {name: line for name, line in calls}
        self.assertIn("migrate_database", call_lines)
        self.assertIn("import_workbook", call_lines)
        self.assertLess(call_lines["migrate_database"], call_lines["import_workbook"])

    def test_maintenance_bootstraps_before_cleanup(self) -> None:
        source = (Path(__file__).resolve().parent / "maintenance.py").read_text(encoding="utf-8")
        tree = ast.parse(source)
        main_function = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "main")
        call_lines = {
            node.func.id: node.lineno
            for node in ast.walk(main_function)
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
        }
        self.assertLess(call_lines["ensure_database"], call_lines["cleanup_operational_data"])

    def test_direct_read_does_not_initialize_empty_database(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            with self.assertRaises(sqlite3.OperationalError):
                services.list_students(database)
            with database_connection(database) as conn:
                tables = conn.execute(
                    "select name from sqlite_master where type = 'table' and name not like 'sqlite_%'"
                ).fetchall()
            self.assertEqual(tables, [])

    def test_read_service_closes_connection_after_query_failure(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            tracked_connection = connect(database)
            with mock.patch("Backend.db.connect", return_value=tracked_connection):
                with self.assertRaises(sqlite3.OperationalError):
                    services.list_students(database)
            with self.assertRaises(sqlite3.ProgrammingError):
                tracked_connection.execute("select 1")

    def test_read_service_executes_no_schema_or_data_writes(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            migrate_database(database)
            statements: list[str] = []
            traced_connection = connect(database)
            traced_connection.set_trace_callback(statements.append)
            with mock.patch("Backend.db.connect", return_value=traced_connection):
                services.list_students(database)
            forbidden = ("CREATE", "ALTER", "DROP", "INSERT", "UPDATE", "DELETE", "REPLACE")
            writes = [statement for statement in statements if statement.lstrip().upper().startswith(forbidden)]
            self.assertEqual(writes, [])

    def test_concurrent_reads_and_write_complete_without_lock_errors(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            migrate_database(database)
            services.create_student(database, {"nim": "910006", "full_name": "Concurrency Awal"})

            def read_students() -> int:
                return len(services.list_students(database))

            with ThreadPoolExecutor(max_workers=6) as executor:
                read_futures = [executor.submit(read_students) for _ in range(12)]
                write_future = executor.submit(
                    services.create_student,
                    database,
                    {"nim": "910007", "full_name": "Concurrency Baru"},
                )
                read_counts = [future.result() for future in read_futures]
                created = write_future.result()

            self.assertTrue(all(count >= 1 for count in read_counts))
            self.assertEqual(created["nim"], "910007")
            self.assertEqual(len(services.list_students(database)), 2)

    def test_database_connection_closes_after_success(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            with database_connection(database) as conn:
                conn.execute("select 1").fetchone()
            with self.assertRaises(sqlite3.ProgrammingError):
                conn.execute("select 1")

    def test_database_transaction_rolls_back_and_closes_after_failure(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            migrate_database(database)
            with self.assertRaisesRegex(RuntimeError, "forced transaction failure"):
                with database_transaction(database) as conn:
                    conn.execute(
                        "insert into students (id, nim, full_name, name_norm) values (?, ?, ?, ?)",
                        ("rollback-student", "910004", "Rollback", "rollback"),
                    )
                    raise RuntimeError("forced transaction failure")
            with self.assertRaises(sqlite3.ProgrammingError):
                conn.execute("select 1")
            with database_connection(database) as verify_conn:
                row = verify_conn.execute("select id from students where id = ?", ("rollback-student",)).fetchone()
            self.assertIsNone(row)

    def test_student_mutation_rolls_back_when_audit_write_fails(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            self._initialize(database)

            with mock.patch("Backend.app.services.audit.write_audit", side_effect=RuntimeError("forced audit failure")):
                with self.assertRaisesRegex(RuntimeError, "forced audit failure"):
                    services.create_student(
                        database,
                        {"nim": "910002", "full_name": "Mahasiswa Rollback"},
                        actor_id="actor-p1",
                    )

            conn = connect(database)
            try:
                row = conn.execute("select id from students where nim = ?", ("910002",)).fetchone()
            finally:
                conn.close()
            self.assertIsNone(row)

    def test_student_update_rolls_back_when_audit_write_fails(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            self._initialize(database)
            student = services.create_student(
                database,
                {"nim": "910005", "full_name": "Nama Sebelum"},
            )

            with mock.patch("Backend.app.services.audit.write_audit", side_effect=RuntimeError("forced audit failure")):
                with self.assertRaisesRegex(RuntimeError, "forced audit failure"):
                    services.update_student(
                        database,
                        str(student["id"]),
                        {"nim": "910005", "full_name": "Nama Sesudah"},
                        actor_id="actor-p1",
                    )

            with database_connection(database) as conn:
                row = conn.execute("select full_name from students where id = ?", (student["id"],)).fetchone()
            self.assertEqual(row["full_name"], "Nama Sebelum")

    def test_bill_and_ledger_roll_back_when_audit_write_fails(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            self._initialize(database)
            student = services.create_student(
                database,
                {"nim": "910003", "full_name": "Mahasiswa Tagihan"},
            )

            with mock.patch("Backend.app.services.audit.write_audit", side_effect=RuntimeError("forced audit failure")):
                with self.assertRaisesRegex(RuntimeError, "forced audit failure"):
                    services.create_bill(
                        database,
                        {
                            "student_id": student["id"],
                            "briva": "990002",
                            "amount": 250000,
                            "period": "2026.1",
                            "status": "paid",
                        },
                        actor_id="actor-p1",
                    )

            conn = connect(database)
            try:
                bill_count = conn.execute("select count(*) from bills where briva = ?", ("990002",)).fetchone()[0]
                ledger_count = conn.execute("select count(*) from payment_transactions").fetchone()[0]
            finally:
                conn.close()
            self.assertEqual(bill_count, 0)
            self.assertEqual(ledger_count, 0)

    def test_import_batch_rolls_back_when_audit_write_fails(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            database = root / "salut.sqlite"
            workbook = root / "p1-import.xlsx"
            self._initialize(database)
            self._write_workbook(workbook)

            with mock.patch("Backend.app.services.audit.write_audit", side_effect=RuntimeError("forced audit failure")):
                with self.assertRaisesRegex(RuntimeError, "forced audit failure"):
                    import_workbook(workbook, database, actor_id="actor-p1")

            conn = connect(database)
            try:
                student_count = conn.execute("select count(*) from students where nim = ?", ("910001",)).fetchone()[0]
                bill_count = conn.execute(
                    "select count(*) from bills where source_file = ?", (workbook.name,)
                ).fetchone()[0]
                issue_count = conn.execute(
                    "select count(*) from import_issues where source_file = ?", (workbook.name,)
                ).fetchone()[0]
            finally:
                conn.close()
            self.assertEqual(student_count, 0)
            self.assertEqual(bill_count, 0)
            self.assertEqual(issue_count, 0)

            retry_result = import_workbook(workbook, database)
            self.assertEqual(retry_result["created"], 1)
            self.assertEqual(retry_result["updated"], 0)
            second_retry = import_workbook(workbook, database)
            self.assertEqual(second_retry["created"], 0)
            self.assertEqual(second_retry["updated"], 0)
            self.assertEqual(second_retry["unchanged"], 1)
            with database_connection(database) as verify_conn:
                self.assertEqual(
                    verify_conn.execute("select count(*) from students where nim = ?", ("910001",)).fetchone()[0], 1
                )
                self.assertEqual(
                    verify_conn.execute(
                        "select count(*) from bills where source_file = ?", (workbook.name,)
                    ).fetchone()[0],
                    1,
                )

    def test_import_group_delete_rolls_back_when_audit_write_fails(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            database = root / "salut.sqlite"
            workbook = root / "p1-delete-import.xlsx"
            self._initialize(database)
            self._write_workbook(workbook)
            import_workbook(workbook, database)

            with mock.patch("Backend.app.services.audit.write_audit", side_effect=RuntimeError("forced audit failure")):
                with self.assertRaisesRegex(RuntimeError, "forced audit failure"):
                    services.delete_imported_bill_group(
                        database,
                        workbook.name,
                        actor_id="actor-p1",
                        reason="Uji rollback P1",
                    )

            with database_connection(database) as conn:
                active_bills = conn.execute(
                    "select count(*) from bills where source_file = ? and deleted_at is null",
                    (workbook.name,),
                ).fetchone()[0]
            self.assertEqual(active_bills, 1)


if __name__ == "__main__":
    unittest.main()
