from __future__ import annotations


MONTH_NAMES_ID = (
    "",
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
)


def rupiah(value: int) -> str:
    return "Rp " + f"{value:,}".replace(",", ".")


def format_due_date(due_date_str: str | None) -> str:
    if not due_date_str:
        return ""
    cleaned = str(due_date_str).strip()
    try:
        parts = cleaned.split("-")
        if len(parts) == 3:
            year, month, day = int(parts[0]), int(parts[1]), int(parts[2])
            if 1 <= month <= 12 and 1 <= day <= 31:
                return f"{day} {MONTH_NAMES_ID[month]} {year}"
    except (ValueError, IndexError):
        pass
    return cleaned


def format_entry_period(entry_period: str | None, entry_semester: str | None = None) -> str:
    if not entry_period:
        return ""
    period = str(entry_period).strip()
    if "." in period:
        parts = period.split(".")
        semester_number = parts[1] if len(parts) > 1 else ""
        semester_name = (
            "Ganjil" if semester_number == "1" else "Genap" if semester_number == "2" else f"Semester {semester_number}"
        )
        return f"{period} ({semester_name})"
    if entry_semester:
        normalized_semester = str(entry_semester).lower()
        semester_name = (
            "Ganjil"
            if normalized_semester == "ganjil"
            else "Genap"
            if normalized_semester == "genap"
            else str(entry_semester).title()
        )
        return f"{period} ({semester_name})"
    return period
