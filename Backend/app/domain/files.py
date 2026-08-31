"""File handling and filename sanitization utilities."""

from __future__ import annotations


def sanitize_filename(filename: str) -> str:
    """Sanitize uploaded file name by stripping dangerous path traversal characters."""
    cleaned = "".join(character for character in filename if character.isalnum() or character in "._- ")
    return cleaned.strip() or "import.xlsx"
