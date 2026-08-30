from __future__ import annotations

import sys
import unittest
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


class BackendBaseTestCase(unittest.TestCase):
    def setUp(self) -> None:
        super().setUp()
        from Backend.app.rate_limit import RATE_LIMITER

        with RATE_LIMITER._lock:
            RATE_LIMITER._entries.clear()
            RATE_LIMITER._windows.clear()

    def tearDown(self) -> None:
        from Backend.app.rate_limit import RATE_LIMITER

        with RATE_LIMITER._lock:
            RATE_LIMITER._entries.clear()
            RATE_LIMITER._windows.clear()
        super().tearDown()

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
                    f"{inline(f'F{index}', '') if issue_sheet else ''}</row>"
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
            "</Relationships>"
        )
        with zipfile.ZipFile(path, "w") as archive:
            archive.writestr("xl/workbook.xml", workbook)
            archive.writestr("xl/_rels/workbook.xml.rels", relationships)
            archive.writestr(
                "xl/worksheets/sheet1.xml", worksheet(["No.", "NIM", "Nama Mahasiswa", "BRIVA", "Jumlah"], rows)
            )
            archive.writestr(
                "xl/worksheets/sheet2.xml",
                worksheet(["No.", "NIM", "Nama Mahasiswa", "BRIVA", "Jumlah", "Keterangan"], [], issue_sheet=True),
            )

    @staticmethod
    def _write_current_workbook(path: Path, rows: list[tuple[str, str, str, str, str, str, int, str]]) -> None:
        def inline(cell: str, value: str) -> str:
            return f'<c r="{cell}" t="inlineStr"><is><t>{value}</t></is></c>'

        headers = [
            "NIM",
            "Nama",
            "Registrasi Awal",
            " No  Hp ",
            "Program Studi",
            "No Rek",
            "Jumlah",
            "Batas Pembayaran",
        ]
        columns = "ABCDEFGH"
        header_cells = "".join(inline(f"{column}1", value) for column, value in zip(columns, headers))
        data_rows = []
        for index, row in enumerate(rows, start=2):
            values = [str(value) for value in row]
            cells = "".join(
                f'<c r="{column}{index}"><v>{value}</v></c>'
                if column == "G" and value.isdigit()
                else inline(f"{column}{index}", value)
                for column, value in zip(columns, values)
            )
            data_rows.append(f'<row r="{index}">{cells}</row>')

        workbook = (
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            '<sheets><sheet name="customer_20260808" sheetId="1" r:id="rId1"/></sheets></workbook>'
        )
        relationships = (
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            "</Relationships>"
        )
        worksheet = (
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            f'<sheetData><row r="1">{header_cells}</row>{"".join(data_rows)}</sheetData></worksheet>'
        )
        with zipfile.ZipFile(path, "w") as archive:
            archive.writestr("xl/workbook.xml", workbook)
            archive.writestr("xl/_rels/workbook.xml.rels", relationships)
            archive.writestr("xl/worksheets/sheet1.xml", worksheet)

    @staticmethod
    def _write_master_13_workbook(path: Path, rows: list[tuple]) -> None:
        import openpyxl

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Master"
        headers = [
            "NIM",
            "Nama",
            "NO KTP",
            "Tempat Lahir",
            "Tanggal Lahir",
            "Nama Ibu Kandung",
            "e-Mail",
            "No Kontak",
            "Registrasi Awal",
            "Program Studi",
            "No Rek",
            "Jumlah",
            "Batas Pembayaran",
        ]
        ws.append(headers)
        for row in rows:
            ws.append(list(row))
        wb.save(path)
