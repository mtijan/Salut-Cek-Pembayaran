from __future__ import annotations

import sqlite3
from datetime import date

from Backend.app.domain.common import format_due_date, rupiah
from Backend.excel_reader import normalize_text


def bill_row_to_dict(row: sqlite3.Row) -> dict[str, object]:
    keys = row.keys()
    due_date = row["due_date"] if "due_date" in keys and row["due_date"] else ""
    amount = int(row["amount"]) if "amount" in keys and row["amount"] is not None else 0
    status = str(row["status"]) if "status" in keys and row["status"] else "unpaid"
    raw_paid = row["paid_amount"] if "paid_amount" in keys and row["paid_amount"] is not None else 0
    paid_amount = amount if status == "paid" else 0 if status == "unpaid" else int(raw_paid or 0)
    remaining_amount = max(0, amount - paid_amount)
    student_nim = str(row["nim"]) if "nim" in keys and row["nim"] else ""
    student_name = str(row["full_name"]) if "full_name" in keys and row["full_name"] else ""
    program_study = str(row["program_study"]) if "program_study" in keys and row["program_study"] else ""
    study_program_name = (
        str(row["study_program_name"])
        if "study_program_name" in keys and row["study_program_name"]
        else program_study
    )
    return {
        "id": row["id"],
        "student_id": row["student_id"] if "student_id" in keys and row["student_id"] else "",
        "nim": student_nim,
        "full_name": student_name,
        "student_nim": student_nim,
        "student_name": student_name,
        "study_program_name": study_program_name,
        "period": row["period"] if "period" in keys else "",
        "bill_type": row["bill_type"] if "bill_type" in keys else "",
        "status": status,
        "amount": amount,
        "amount_formatted": rupiah(amount),
        "paid_amount": paid_amount,
        "paid_amount_formatted": rupiah(paid_amount),
        "remaining_amount": remaining_amount,
        "remaining_amount_formatted": rupiah(remaining_amount),
        "payment_method": row["payment_method"] if "payment_method" in keys else "BRIVA",
        "briva": row["briva"] if "briva" in keys else "",
        "instructions": row["instructions"] if "instructions" in keys and row["instructions"] else "",
        "due_date": due_date,
        "due_date_formatted": format_due_date(due_date),
        "source_file": row["source_file"] if "source_file" in keys else "",
        "source_row_number": row["source_row_number"] if "source_row_number" in keys else None,
    }


def joined_bill_select() -> str:
    return """
        select b.id, b.student_id, b.briva, b.amount, coalesce(b.paid_amount, 0) as paid_amount,
               b.period, b.bill_type, b.status, b.payment_method, b.instructions, b.due_date, b.created_at,
               b.source_file, b.source_row_number, s.nim, s.full_name, s.program_study,
               sp.name as study_program_name
        from bills b
        join students s on s.id = b.student_id
        left join study_programs sp on sp.id = s.study_program_id
    """


def validate_due_date_value(due_date: object) -> str | None:
    due_date_str = str(due_date or "").strip()
    if not due_date_str:
        return None
    try:
        parsed = date.fromisoformat(due_date_str)
    except ValueError as exc:
        raise ValueError("Format tanggal harus YYYY-MM-DD.") from exc
    return parsed.isoformat()


def validate_payment_metadata(
    payment_date: object = None,
    reference_number: object = None,
    notes: object = None,
) -> tuple[str | None, str | None, str | None]:
    normalized_date = validate_due_date_value(payment_date) if payment_date else None
    reference = normalize_text(reference_number) or None
    note = normalize_text(notes) or None
    if reference and len(reference) > 100:
        raise ValueError("Nomor referensi maksimal 100 karakter.")
    if note and len(note) > 1000:
        raise ValueError("Catatan pembayaran maksimal 1000 karakter.")
    return normalized_date, reference, note


def validate_amount(value: object) -> int:
    text = str(value or "").replace(".", "").replace(",", "").strip()
    if not text.isdigit():
        raise ValueError("Nominal tagihan wajib berupa angka.")
    amount = int(text)
    if amount <= 0:
        raise ValueError("Nominal tagihan harus lebih dari 0.")
    return amount


def validate_paid_amount(value: object, total_amount: int, status: str) -> int:
    if status == "paid":
        return total_amount
    if status == "unpaid":
        return 0
    if value is None or value == "":
        raise ValueError("Nominal yang dibayarkan wajib diisi untuk status Bayar Sebagian.")
    text = str(value).replace(".", "").replace(",", "").strip()
    if not text.isdigit():
        raise ValueError("Nominal yang dibayarkan wajib berupa angka.")
    paid = int(text)
    if paid <= 0:
        raise ValueError("Nominal bayar sebagian harus lebih dari 0.")
    if paid >= total_amount:
        raise ValueError(
            "Nominal bayar sebagian harus lebih kecil dari total tagihan. Jika sudah lunas, silakan pilih status Lunas."
        )
    return paid


def normalize_status_value(status: object) -> str:
    value = str(status or "unpaid").strip().lower()
    if value not in {"paid", "partial", "unpaid"}:
        raise ValueError("Status hanya boleh paid, partial, atau unpaid.")
    return value


def normalize_payment_status_alias(status: object) -> str:
    value = str(status or "unpaid").strip().lower()
    aliases = {
        "paid": "paid",
        "lunas": "paid",
        "partial": "partial",
        "bayar sebagian": "partial",
        "lunas sebagian": "partial",
        "dicicil": "partial",
        "cicil": "partial",
        "unpaid": "unpaid",
        "belum lunas": "unpaid",
    }
    return aliases.get(value, "unpaid")


def summarize_payment_status(statuses: list[object]) -> str:
    normalized = [normalize_payment_status_alias(status) for status in statuses]
    if normalized and all(status == "paid" for status in normalized):
        return "paid"
    if "partial" in normalized:
        return "partial"
    return "unpaid"
