from __future__ import annotations

import sqlite3

from Backend.app.domain.common import format_entry_period, rupiah
from Backend.excel_reader import normalize_nim, normalize_text


ACADEMIC_STATUSES = {"aktif", "cuti", "lulus", "nonaktif", "keluar"}


def validate_nim_value(value: object) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    if any(character.isalpha() for character in raw):
        raise ValueError("NIM hanya boleh berisi angka (pemisah spasi atau tanda hubung diperbolehkan).")
    normalized = normalize_nim(raw)
    if not normalized:
        raise ValueError("NIM hanya boleh berisi angka.")
    return normalized


def validate_academic_status(value: object) -> str:
    status = normalize_text(value).lower() or "aktif"
    if status not in ACADEMIC_STATUSES:
        raise ValueError("Status akademik harus salah satu dari: aktif, cuti, lulus, nonaktif, keluar.")
    return status


def student_row_to_dict(row: sqlite3.Row) -> dict[str, object]:
    keys = row.keys()
    entry_period = row["entry_period"] if "entry_period" in keys and row["entry_period"] else ""
    entry_semester = row["entry_semester"] if "entry_semester" in keys and row["entry_semester"] else ""
    program_study = row["program_study"] if "program_study" in keys and row["program_study"] else ""
    total_amount = int(row["total_amount"] or 0) if "total_amount" in keys else 0
    return {
        "id": row["id"],
        "nim": row["nim"],
        "full_name": row["full_name"],
        "no_ktp": row["no_ktp"] if "no_ktp" in keys and row["no_ktp"] else "",
        "tempat_lahir": row["tempat_lahir"] if "tempat_lahir" in keys and row["tempat_lahir"] else "",
        "tanggal_lahir": row["tanggal_lahir"] if "tanggal_lahir" in keys and row["tanggal_lahir"] else "",
        "nama_ibu_kandung": row["nama_ibu_kandung"] if "nama_ibu_kandung" in keys and row["nama_ibu_kandung"] else "",
        "program_study": program_study,
        "study_program_id": row["study_program_id"] if "study_program_id" in keys and row["study_program_id"] else "",
        "study_program_name": row["study_program_name"]
        if "study_program_name" in keys and row["study_program_name"]
        else program_study,
        "study_program_code": row["study_program_code"]
        if "study_program_code" in keys and row["study_program_code"]
        else "",
        "academic_status": row["academic_status"] if "academic_status" in keys and row["academic_status"] else "aktif",
        "entry_year": row["entry_year"] if "entry_year" in keys and row["entry_year"] is not None else None,
        "entry_semester": entry_semester,
        "entry_period": entry_period,
        "entry_period_formatted": format_entry_period(entry_period, entry_semester),
        "email": row["email"] if "email" in keys and row["email"] else "",
        "address": row["address"] if "address" in keys and row["address"] else "",
        "phone_number": row["phone_number"] if "phone_number" in keys and row["phone_number"] else "",
        "initial_registration": row["initial_registration"]
        if "initial_registration" in keys and row["initial_registration"]
        else "",
        "bill_count": row["bill_count"] if "bill_count" in keys else 0,
        "total_amount": total_amount,
        "total_amount_formatted": rupiah(total_amount),
    }
