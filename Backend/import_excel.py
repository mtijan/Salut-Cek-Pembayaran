"""Excel workbook ingestion CLI and database import runner.

This script executes the import pipeline, ingesting student master data and billing records
from Excel workbooks into the SQLite database with transaction safety and conflict resolution.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


from Backend.app.use_cases.import_workbook import commit_analyzed_workbook
from Backend.db import DEFAULT_DB_PATH, migrate_database

from Backend.importing.analysis import _analyze_workbook, preview_workbook
from Backend.importing.workbook import (
    DEFAULT_BILL_TYPE,
    DEFAULT_WORKBOOK,
    generate_master_data_template,
)

__all__ = ["generate_master_data_template", "import_workbook", "preview_workbook"]


def import_workbook(
    workbook_path: str | Path = DEFAULT_WORKBOOK,
    db_path: str | Path = DEFAULT_DB_PATH,
    period: str | None = None,
    bill_type: str = DEFAULT_BILL_TYPE,
    source_file_name: str | None = None,
    confirm_updates: bool = False,
    actor_id: str | None = None,
) -> dict[str, object]:
    """Execute spreadsheet import transaction, creating/updating students and billing items."""
    workbook = Path(workbook_path)
    source_file = source_file_name or workbook.name
    analysis = _analyze_workbook(workbook, db_path, period, source_file)
    if analysis["critical_rows"]:
        raise ValueError("Import dibatalkan karena ada duplikasi atau konflik kritis.")
    if analysis["requires_update_confirmation"] and not confirm_updates:
        raise ValueError("Perubahan nominal atau BRIVA memerlukan konfirmasi admin.")

    return commit_analyzed_workbook(
        workbook,
        db_path,
        analysis,
        source_file=source_file,
        bill_type=bill_type,
        actor_id=actor_id,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Import data BRIVA UKT ke SQLite.")
    parser.add_argument("--file", default=str(DEFAULT_WORKBOOK), help="Path file .xlsx")
    parser.add_argument("--db", default=str(DEFAULT_DB_PATH), help="Path file SQLite")
    parser.add_argument("--period", help="Opsional. Default mengikuti struktur workbook.")
    parser.add_argument("--confirm-updates", action="store_true", help="Setujui perubahan nominal atau BRIVA.")
    args = parser.parse_args()

    migrate_database(args.db)
    result = import_workbook(args.file, args.db, args.period, confirm_updates=args.confirm_updates)
    print(f"Changed rows: {result['imported']}")
    print(f"Unchanged rows: {result['unchanged']}")
    print(f"Issue rows: {result['issues']}")
    print(f"Database: {Path(args.db).resolve()}")


if __name__ == "__main__":
    main()
