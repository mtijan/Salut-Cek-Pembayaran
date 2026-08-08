from __future__ import annotations

import json
import sys
import sqlite3
import tempfile
import unittest
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import server
from Backend.app import config as app_config
from Backend.app.config import ROLE_PERMISSIONS
from Backend.app.rate_limit import RateLimiter
from Backend.app.services import list_imported_bill_groups, update_bill_status
from import_excel import import_workbook, preview_workbook
from db import connect, init_db
from fastapi.testclient import TestClient


class CoreBehaviorTests(unittest.TestCase):
    def test_workbook_preview_has_no_critical_rows(self) -> None:
        workbook = Path(__file__).resolve().parents[1] / "Data_Sinkron_BRIVA_UKT_2023_1_sd_2025_2.xlsx"
        preview = preview_workbook(workbook)
        self.assertEqual(preview["valid_rows"], 409)
        self.assertEqual(preview["critical_rows"], 0)
        self.assertEqual(preview["issue_rows"], 11)
        self.assertEqual(preview["multiple_bill_rows"], 2)

    def test_rate_limiter_blocks_after_limit(self) -> None:
        limiter = RateLimiter()
        self.assertIsNone(limiter.check("lookup", "127.0.0.1", 2, 60))
        self.assertIsNone(limiter.check("lookup", "127.0.0.1", 2, 60))
        self.assertIsNotNone(limiter.check("lookup", "127.0.0.1", 2, 60))

    def test_viewer_cannot_import(self) -> None:
        self.assertNotIn("import", ROLE_PERMISSIONS["viewer"])
        self.assertIn("import", ROLE_PERMISSIONS["admin"])

    def test_lookup_uses_nim_only_without_returning_name(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database = Path(temporary_directory) / "salut.sqlite"
            conn = connect(database)
            init_db(conn)
            with conn:
                conn.execute(
                    "insert into students (id, nim, full_name, name_norm) values (?, ?, ?, ?)",
                    ("student-1", "050117077", "Syahla Taqiyyah", "syahla taqiyyah"),
                )
                conn.execute(
                    """
                    insert into bills (id, student_id, briva, amount, period, bill_type, instructions, source_file)
                    values (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        "bill-1",
                        "student-1",
                        "178100023200040",
                        1850000,
                        "2025.2",
                        "UKT BRIVA",
                        "Bayar melalui BRIVA BRI dengan nomor VA yang tampil.",
                        "unit-test.xlsx",
                    ),
                )
                conn.execute(
                    """
                    insert into bills (id, student_id, briva, amount, period, bill_type, instructions, source_file)
                    values (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        "bill-2",
                        "student-1",
                        "178100023200041",
                        750000,
                        "2025.2",
                        "UKT BRIVA",
                        "Bayar melalui BRIVA BRI dengan nomor VA yang tampil.",
                        "unit-test.xlsx",
                    ),
                )
            conn.close()

            original_db_path = app_config.DB_PATH
            app_config.DB_PATH = database
            try:
                client = TestClient(server.app)
                response = client.post("/api/lookup", json={"nim": "050117077", "full_name": "Tidak Dipakai"})
                result = response.json()
            finally:
                app_config.DB_PATH = original_db_path

            self.assertEqual(response.status_code, 200)
            self.assertTrue(result["success"])
            self.assertEqual(result["data"]["student"]["nim"], "050117077")
            self.assertEqual(result["data"]["student"]["full_name"], "Syahla Taqiyyah")
            self.assertEqual(result["data"]["student"]["program_study"], "S1 Ilmu Hukum")
            self.assertEqual(result["data"]["student"]["payment_period"], "Semester Ganjil 2026")
            self.assertEqual(set(result["data"]["student"]), {"nim", "full_name", "program_study", "payment_period"})
            self.assertEqual([bill["bill_label"] for bill in result["data"]["bills"]], ["Tagihan 1", "Tagihan 2"])

    def test_reupload_is_unchanged_and_amount_update_requires_confirmation(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            temp = Path(temporary_directory)
            database = temp / "salut.sqlite"
            initial = temp / "initial.xlsx"
            updated = temp / "updated.xlsx"
            self._write_workbook(initial, [("01001", "Ayu Sari", "12345", 100000)])
            self._write_workbook(updated, [("01001", "Ayu Sari", "12345", 125000)])

            first_preview = preview_workbook(initial, database)
            self.assertEqual(first_preview["new_rows"], 1)
            self.assertEqual(first_preview["critical_rows"], 0)
            self.assertEqual(import_workbook(initial, database)["created"], 1)

            same_preview = preview_workbook(initial, database)
            self.assertEqual(same_preview["unchanged_rows"], 1)
            self.assertEqual(same_preview["update_rows"], 0)
            self.assertEqual(import_workbook(initial, database)["imported"], 0)

            update_preview = preview_workbook(updated, database)
            self.assertEqual(update_preview["amount_change_rows"], 1)
            self.assertTrue(update_preview["requires_update_confirmation"])
            with self.assertRaisesRegex(ValueError, "memerlukan konfirmasi"):
                import_workbook(updated, database)
            self.assertEqual(import_workbook(updated, database, confirm_updates=True)["updated"], 1)

            conn = sqlite3.connect(database)
            amount = conn.execute("select amount from bills where briva = '12345'").fetchone()[0]
            conn.close()
            self.assertEqual(amount, 125000)

    def test_briva_replacement_and_paid_bill_protection(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            temp = Path(temporary_directory)
            database = temp / "salut.sqlite"
            initial = temp / "initial.xlsx"
            replacement = temp / "replacement.xlsx"
            changed_amount = temp / "changed-amount.xlsx"
            self._write_workbook(initial, [("01002", "Bima Putra", "20001", 100000)])
            self._write_workbook(replacement, [("01002", "Bima Putra", "20002", 100000)])
            self._write_workbook(changed_amount, [("01002", "Bima Putra", "20002", 150000)])
            import_workbook(initial, database)

            replacement_preview = preview_workbook(replacement, database)
            self.assertEqual(replacement_preview["briva_change_rows"], 1)
            self.assertTrue(replacement_preview["requires_update_confirmation"])
            import_workbook(replacement, database, confirm_updates=True)

            conn = sqlite3.connect(database)
            self.assertEqual(conn.execute("select count(*) from bills").fetchone()[0], 1)
            self.assertEqual(conn.execute("select briva from bills").fetchone()[0], "20002")
            conn.execute("update bills set status = 'paid'")
            conn.commit()
            conn.close()

            paid_preview = preview_workbook(changed_amount, database)
            self.assertGreater(paid_preview["critical_rows"], 0)
            self.assertGreater(paid_preview["conflict_rows"], 0)

    def test_same_briva_for_different_nim_is_critical(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            workbook = Path(temporary_directory) / "duplicate-briva-different-nim.xlsx"
            self._write_workbook(
                workbook,
                [
                    ("01003", "Citra P", "30001", 100000),
                    ("01004", "Dina R", "30001", 100000),
                ],
            )
            preview = preview_workbook(workbook)
            self.assertGreater(preview["critical_rows"], 0)
            self.assertEqual(preview["duplicate_briva_conflict_rows"], 2)

    def test_same_nim_with_same_briva_imports_multiple_bills_idempotently(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            temp = Path(temporary_directory)
            database = temp / "salut.sqlite"
            workbook = temp / "Tagihan tambahan bebas namanya.xlsx"
            self._write_workbook(
                workbook,
                [
                    ("01004", "Dina Rahma", "40001", 100000),
                    ("01004", "Dina Rahma", "40001", 150000),
                ],
            )

            preview = preview_workbook(workbook, database)
            self.assertEqual(preview["critical_rows"], 0)
            self.assertEqual(preview["multiple_bill_rows"], 2)
            self.assertEqual(preview["new_rows"], 2)
            result = import_workbook(workbook, database)
            self.assertEqual(result["created"], 2)
            self.assertEqual(import_workbook(workbook, database)["unchanged"], 2)

            conn = sqlite3.connect(database)
            count = conn.execute("select count(*) from bills").fetchone()[0]
            briva_count = conn.execute("select count(*) from bills where briva = '40001'").fetchone()[0]
            source_files = conn.execute("select distinct source_file from bills").fetchall()
            conn.close()
            self.assertEqual(count, 2)
            self.assertEqual(briva_count, 2)
            self.assertEqual(source_files[0][0], "Tagihan tambahan bebas namanya.xlsx")

    def test_duplicate_bill_import_backfills_legacy_row_without_source_number(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            temp = Path(temporary_directory)
            database = temp / "salut.sqlite"
            workbook = temp / "legacy-source.xlsx"
            self._write_workbook(workbook, [("01006", "Fajar Hadi", "60001", 100000)])
            import_workbook(workbook, database)

            conn = sqlite3.connect(database)
            conn.execute("update bills set source_row_number = null")
            conn.commit()
            conn.close()

            self._write_workbook(
                workbook,
                [
                    ("01006", "Fajar Hadi", "60001", 100000),
                    ("01006", "Fajar Hadi", "60001", 100000),
                ],
            )

            preview = preview_workbook(workbook, database)
            self.assertEqual(preview["unchanged_rows"], 1)
            self.assertEqual(preview["new_rows"], 1)
            self.assertEqual(preview["multiple_bill_rows"], 2)

            result = import_workbook(workbook, database)
            self.assertEqual(result["created"], 1)
            self.assertEqual(result["unchanged"], 1)

            conn = sqlite3.connect(database)
            count = conn.execute("select count(*) from bills where briva = '60001'").fetchone()[0]
            source_rows = conn.execute("select source_row_number from bills where briva = '60001' order by source_row_number").fetchall()
            conn.close()
            self.assertEqual(count, 2)
            self.assertEqual([row[0] for row in source_rows], [None, 3])

            second_preview = preview_workbook(workbook, database)
            self.assertEqual(second_preview["new_rows"], 0)
            self.assertEqual(second_preview["unchanged_rows"], 2)

    def test_admin_bill_groups_and_status_update(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            temp = Path(temporary_directory)
            database = temp / "salut.sqlite"
            workbook = temp / "batch-admin.xlsx"
            self._write_workbook(workbook, [("01005", "Eka Putri", "50001", 125000)])
            import_workbook(workbook, database)

            groups = list_imported_bill_groups(database)
            self.assertEqual(len(groups), 1)
            self.assertEqual(groups[0]["file_name"], "batch-admin.xlsx")
            self.assertEqual(groups[0]["unpaid"], 1)
            bill_id = groups[0]["bills"][0]["id"]

            updated = update_bill_status(database, bill_id, "paid")
            self.assertIsNotNone(updated)
            self.assertEqual(updated["status"], "paid")
            groups = list_imported_bill_groups(database)
            self.assertEqual(groups[0]["paid"], 1)

    @staticmethod
    def _write_workbook(path: Path, rows: list[tuple[str, str, str, int]]) -> None:
        def inline(cell: str, value: str) -> str:
            return f'<c r="{cell}" t="inlineStr"><is><t>{value}</t></is></c>'

        def worksheet(headers: list[str], values: list[tuple[str, str, str, int]], issue_sheet: bool = False) -> str:
            columns = "ABCDEF"
            header_cells = "".join(inline(f"{column}1", value) for column, value in zip(columns, headers))
            data_rows = []
            for index, (nim, name, briva, amount) in enumerate(values, start=2):
                data_rows.append(
                    f'<row r="{index}">{inline(f"A{index}", str(index - 1))}{inline(f"B{index}", nim)}'
                    f'{inline(f"C{index}", name)}{inline(f"D{index}", briva)}<c r="E{index}"><v>{amount}</v></c>'
                    f'{inline(f"F{index}", "") if issue_sheet else ""}</row>'
                )
            return (
                '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
                f'<sheetData><row r="1">{header_cells}</row>{"".join(data_rows)}</sheetData></worksheet>'
            )

        workbook = (
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            '<sheets><sheet name="Data Sinkron" sheetId="1" r:id="rId1"/>'
            '<sheet name="Data Belum Lengkap" sheetId="2" r:id="rId2"/></sheets></workbook>'
        )
        relationships = (
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>'
            '</Relationships>'
        )
        with zipfile.ZipFile(path, "w") as archive:
            archive.writestr("xl/workbook.xml", workbook)
            archive.writestr("xl/_rels/workbook.xml.rels", relationships)
            archive.writestr("xl/worksheets/sheet1.xml", worksheet(["No.", "NIM", "Nama Mahasiswa", "BRIVA", "Jumlah"], rows))
            archive.writestr(
                "xl/worksheets/sheet2.xml",
                worksheet(["No.", "NIM", "Nama Mahasiswa", "BRIVA", "Jumlah", "Keterangan"], [], issue_sheet=True),
            )


if __name__ == "__main__":
    unittest.main()
