from __future__ import annotations

import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
NS = {"a": MAIN_NS, "r": REL_NS, "p": PKG_REL_NS}


def normalize_text(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def clean_excel_text(value: object) -> str:
    """Remove Excel text markers without changing meaningful punctuation in the value."""
    return normalize_text(value).lstrip("'`").strip()


def normalize_name(value: object) -> str:
    return clean_excel_text(value).casefold()


def normalize_imported_name(value: object) -> str:
    """Format student name to clean Capital Each Word (Title Case)."""
    text = clean_excel_text(value)
    if not text:
        return ""
    words = text.split()
    return " ".join(word.capitalize() for word in words)


def clean_demographic_value(value: object) -> str | None:
    """Clean demographic fields (e.g. KTP, Tempat Lahir, Tgl Lahir, Ibu, Email), converting '-', '', 'None' to None."""
    cleaned = clean_excel_text(value)
    if not cleaned or cleaned in {"-", "None", "null", "N/A"}:
        return None
    return cleaned


def normalize_nim(value: object) -> str:
    return re.sub(r"\D+", "", str(value or ""))


def _column_name(cell_ref: str) -> str:
    return re.sub(r"\d+", "", cell_ref)


MAX_UNCOMPRESSED_FILE_BYTES = 20 * 1024 * 1024
MAX_UNCOMPRESSED_TOTAL_BYTES = 30 * 1024 * 1024
MAX_WORKSHEET_ROWS = 5000


def _validate_zip_archive(zf: zipfile.ZipFile) -> None:
    total_size = 0
    for info in zf.infolist():
        if info.file_size > MAX_UNCOMPRESSED_FILE_BYTES:
            raise ValueError(f"File uncompressed '{info.filename}' melebihi batas maksimum 20 MB.")
        total_size += info.file_size
        if total_size > MAX_UNCOMPRESSED_TOTAL_BYTES:
            raise ValueError("Total uncompressed size workbook melebihi batas maksimum 30 MB.")


def _parse_xml(content: bytes) -> ET.Element:
    try:
        return ET.fromstring(content)
    except ET.ParseError as exc:
        raise ValueError("Struktur XML file Excel tidak valid.") from exc


def _shared_strings(zf: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in zf.namelist():
        return []
    root = _parse_xml(zf.read("xl/sharedStrings.xml"))
    strings: list[str] = []
    for item in root.findall("a:si", NS):
        strings.append("".join(node.text or "" for node in item.findall(".//a:t", NS)))
    return strings


def _cell_value(cell: ET.Element, shared: list[str]) -> str:
    value_node = cell.find("a:v", NS)
    if value_node is None:
        inline = cell.find("a:is", NS)
        if inline is None:
            return ""
        return normalize_text("".join(node.text or "" for node in inline.findall(".//a:t", NS)))

    raw = value_node.text or ""
    if cell.attrib.get("t") == "s" and raw:
        idx = int(raw)
        if 0 <= idx < len(shared):
            return normalize_text(shared[idx])
        return ""
    return normalize_text(raw)


def _sheet_targets(zf: zipfile.ZipFile) -> dict[str, str]:
    workbook = _parse_xml(zf.read("xl/workbook.xml"))
    rels = _parse_xml(zf.read("xl/_rels/workbook.xml.rels"))
    rel_targets = {
        rel.attrib["Id"]: rel.attrib["Target"].lstrip("/")
        for rel in rels.findall("p:Relationship", NS)
    }

    sheets: dict[str, str] = {}
    for sheet in workbook.findall(".//a:sheet", NS):
        name = sheet.attrib["name"]
        rel_id = sheet.attrib[f"{{{REL_NS}}}id"]
        target = rel_targets.get(rel_id, "")
        if target:
            if not target.startswith("xl/"):
                target = f"xl/{target}"
            sheets[name] = target
    return sheets


def _open_zip(path: str | Path) -> zipfile.ZipFile:
    try:
        zf = zipfile.ZipFile(Path(path))
        _validate_zip_archive(zf)
        return zf
    except zipfile.BadZipFile as exc:
        raise ValueError("File Excel rusak atau berformat tidak valid.") from exc


def read_sheet(path: str | Path, sheet_name: str) -> list[dict[str, str]]:
    with _open_zip(path) as zf:
        shared = _shared_strings(zf)
        targets = _sheet_targets(zf)
        if sheet_name not in targets:
            available = ", ".join(targets)
            raise ValueError(f"Sheet '{sheet_name}' tidak ditemukan. Sheet tersedia: {available}")

        root = _parse_xml(zf.read(targets[sheet_name]))
        rows = root.findall(".//a:sheetData/a:row", NS)
        if not rows:
            return []
        if len(rows) - 1 > MAX_WORKSHEET_ROWS:
            raise ValueError(f"Jumlah baris worksheet melebihi batas maksimum {MAX_WORKSHEET_ROWS}.")

        header_cells = {
            _column_name(cell.attrib["r"]): _cell_value(cell, shared)
            for cell in rows[0].findall("a:c", NS)
        }
        records: list[dict[str, str]] = []
        for row in rows[1:]:
            record: dict[str, str] = {"_row_number": row.attrib.get("r", "")}
            for cell in row.findall("a:c", NS):
                column = _column_name(cell.attrib["r"])
                header = header_cells.get(column, column)
                record[header] = _cell_value(cell, shared)
            if any(value for key, value in record.items() if key != "_row_number"):
                records.append(record)
        return records


def read_sheet_headers(path: str | Path, sheet_name: str) -> list[str]:
    with _open_zip(path) as zf:
        shared = _shared_strings(zf)
        targets = _sheet_targets(zf)
        if sheet_name not in targets:
            available = ", ".join(targets)
            raise ValueError(f"Sheet '{sheet_name}' tidak ditemukan. Sheet tersedia: {available}")

        root = _parse_xml(zf.read(targets[sheet_name]))
        rows = root.findall(".//a:sheetData/a:row", NS)
        if not rows:
            return []
        return [_cell_value(cell, shared) for cell in rows[0].findall("a:c", NS)]


def workbook_sheet_names(path: str | Path) -> list[str]:
    with _open_zip(path) as zf:
        return list(_sheet_targets(zf).keys())
