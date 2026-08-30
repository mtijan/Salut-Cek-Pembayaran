"""Link unassigned students to study programs; dry-run unless --apply is set."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from Backend.db import connect  # noqa: E402 - direct script execution needs the repository root


PROGRAM_MAPPINGS = {
    "akuntansi": "sp_akt",
    "manajemen": "sp_mnj",
    "hukum": "sp_hkm",
    "komunikasi": "sp_kom",
    "administrasi": "sp_adm",
    "pemerintahan": "sp_ipem",
    "pgsd": "sp_pgsd",
    "informasi": "sp_sif",
}


def link_programs(database: Path, *, apply: bool) -> int:
    resolved_database = database.resolve()
    if not resolved_database.is_file():
        raise FileNotFoundError(f"Database does not exist: {resolved_database}")

    connection = connect(resolved_database)
    total = 0
    try:
        connection.execute("BEGIN IMMEDIATE")
        for keyword, study_program_id in PROGRAM_MAPPINGS.items():
            cursor = connection.execute(
                """
                UPDATE students
                SET study_program_id = ?
                WHERE lower(coalesce(program_study, '')) LIKE ?
                  AND (study_program_id IS NULL OR study_program_id = '')
                """,
                (study_program_id, f"%{keyword}%"),
            )
            total += cursor.rowcount

        if apply:
            connection.commit()
        else:
            connection.rollback()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return total


def main() -> None:
    parser = argparse.ArgumentParser(description="Link study_program_id using reviewed program-name mappings.")
    parser.add_argument("--database", required=True, type=Path, help="Explicit path to an existing SQLite database.")
    parser.add_argument(
        "--apply", action="store_true", help="Commit changes. Without this flag the command rolls back."
    )
    args = parser.parse_args()

    affected = link_programs(args.database, apply=args.apply)
    mode = "APPLIED" if args.apply else "DRY-RUN"
    print(f"{mode}: {affected} student record(s) matched reviewed mappings.")


if __name__ == "__main__":
    main()
