from __future__ import annotations


def sanitize_filename(filename: str) -> str:
    cleaned = "".join(character for character in filename if character.isalnum() or character in "._- ")
    return cleaned.strip() or "import.xlsx"
