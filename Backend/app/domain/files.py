"""File handling and filename sanitization utilities."""

from __future__ import annotations


def sanitize_filename(filename: str) -> str:
    """Sanitize uploaded file name by stripping dangerous path traversal characters and reserved characters."""
    cleaned = "".join(character for character in filename if character.isalnum() or character in "._- ")
    cleaned = cleaned.strip(". ")
    if not cleaned or cleaned.startswith("."):
        return "import.xlsx"
    if not cleaned.lower().endswith(".xlsx"):
        cleaned = f"{cleaned}.xlsx"
    return cleaned
