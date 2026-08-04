from __future__ import annotations

import sys
import sqlite3
import tempfile
import unittest
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from import_excel import import_workbook, preview_workbook
from server import ROLE_PERMISSIONS, RateLimiter


class CoreBehaviorTests(unittest.TestCase):
    def test_workbook_preview_has_no_critical_rows(self) -> None:
        workbook = Path(__file__).resolve().parents[1] / "Data_Sinkron_BRIVA_UKT_2023_1_sd_2025_2.xlsx"
        preview = preview_workbook(workbook)
        self.assertEqual(preview["valid_rows"], 408)
        self.assertEqual(preview["critical_rows"], 0)
        self.assertEqual(preview["issue_rows"], 9)

    def test_rate_limiter_blocks_after_limit(self) -> None:
        limiter = RateLimiter()
        self.assertIsNone(limiter.check("lookup", "127.0.0.1", 2, 60))
        self.assertIsNone(limiter.check("lookup", "127.0.0.1", 2, 60))
        self.assertIsNotNone(limiter.check("lookup", "127.0.0.1", 2, 60))

    def test_viewer_cannot_import(self) -> None:
        self.assertNotIn("import", ROLE_PERMISSIONS["viewer"])
        self.assertIn("import", ROLE_PERMISSIONS["admin"])

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

    def test_duplicate_briva_and_nim_are_critical(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            workbook = Path(temporary_directory) / "duplicate.xlsx"
            self._write_workbook(
                workbook,
                [
                    ("01003", "Citra P", "30001", 100000),
                    ("01003", "Citra P", "30001", 100000),
                ],
            )
            preview = preview_workbook(workbook)
            self.assertGreater(preview["critical_rows"], 0)
            self.assertEqual(preview["duplicate_briva_rows"], 2)
            self.assertEqual(preview["duplicate_nim_rows"], 2)

    @staticmethod
    def _write_workbook(path: Path, rows: list[tuple[str, str, str, int]]) -> None:
        def inline(cell: str, value: str) -> str:
            return f'<c r="{cell}" t="inlineStr"><is><t>{value}</t></is></c>'

        def worksheet(headers: list[str], values: list[tuple[str, str, str, int]]) -> str:
            header_cells = "".join(inline(f"{column}1", value) for column, value in zip("ABCD", headers))
            data_rows = []
            for index, (nim, name, briva, amount) in enumerate(values, start=2):
                data_rows.append(
                    f'<row r="{index}">{inline(f"A{index}", nim)}{inline(f"B{index}", name)}'
                    f'{inline(f"C{index}", briva)}<c r="D{index}"><v>{amount}</v></c></row>'
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
            archive.writestr("xl/worksheets/sheet1.xml", worksheet(["NIM", "Nama Mahasiswa", "BRIVA", "Jumlah"], rows))
            archive.writestr("xl/worksheets/sheet2.xml", worksheet(["Keterangan", "", "", ""], []))


if __name__ == "__main__":
    unittest.main()
