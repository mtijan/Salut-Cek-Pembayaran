from __future__ import annotations

import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_DB_PATH = BASE_DIR / "data" / "salut.sqlite"
SCHEMA_PATH = BASE_DIR / "schema.sql"


def resolve_db_path(db_path: str | Path = DEFAULT_DB_PATH) -> Path:
    raw = str(db_path)
    if raw.startswith("file:"):
        raw = raw[5:]
    return Path(raw)


def connect(db_path: str | Path = DEFAULT_DB_PATH) -> sqlite3.Connection:
    path = resolve_db_path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("pragma foreign_keys = on")
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
    migrate_bills_for_duplicate_briva(conn)
    migrate_bills_for_due_date(conn)
    migrate_students_for_profile(conn)
    conn.execute("create index if not exists idx_bills_source_file_row on bills(source_file, source_row_number)")


def _table_sql(conn: sqlite3.Connection, table: str) -> str:
    row = conn.execute("select sql from sqlite_master where type = 'table' and name = ?", (table,)).fetchone()
    return str(row["sql"] or "") if row else ""


def _table_columns(conn: sqlite3.Connection, table: str) -> set[str]:
    return {str(row["name"]) for row in conn.execute(f"pragma table_info({table})").fetchall()}


def migrate_bills_for_due_date(conn: sqlite3.Connection) -> None:
    columns = _table_columns(conn, "bills")
    if "due_date" not in columns:
        conn.execute("alter table bills add column due_date text")


def migrate_students_for_profile(conn: sqlite3.Connection) -> None:
    columns = _table_columns(conn, "students")
    for column in ("program_study", "initial_registration", "phone_number"):
        if column not in columns:
            conn.execute(f"alter table students add column {column} text")


def migrate_bills_for_duplicate_briva(conn: sqlite3.Connection) -> None:
    columns = _table_columns(conn, "bills")
    table_sql = _table_sql(conn, "bills").lower()
    needs_source_row = "source_row_number" not in columns
    needs_drop_briva_unique = "briva text not null unique" in table_sql
    if not needs_source_row and not needs_drop_briva_unique:
        return

    conn.execute("pragma foreign_keys = off")
    try:
        conn.execute("drop table if exists bills_new")
        conn.execute(
            """
            create table bills_new (
              id text primary key,
              student_id text not null references students(id) on delete cascade,
              briva text not null,
              amount integer not null,
              period text not null,
              bill_type text not null,
              status text not null default 'unpaid',
              payment_method text not null default 'BRIVA',
              instructions text not null,
              due_date text,
              source_file text not null,
              source_row_number integer,
              created_at text not null default (datetime('now')),
              updated_at text not null default (datetime('now'))
            )
            """
        )
        source_row_expression = "source_row_number" if not needs_source_row else "null"
        due_date_expression = "due_date" if "due_date" in columns else "null"
        conn.execute(
            f"""
            insert into bills_new
              (id, student_id, briva, amount, period, bill_type, status, payment_method,
               instructions, due_date, source_file, source_row_number, created_at, updated_at)
            select id, student_id, briva, amount, period, bill_type, status, payment_method,
                   instructions, {due_date_expression}, source_file, {source_row_expression}, created_at, updated_at
            from bills
            """
        )
        conn.execute("drop table bills")
        conn.execute("alter table bills_new rename to bills")
        conn.execute("create index if not exists idx_bills_student_id on bills(student_id)")
        conn.execute("create index if not exists idx_bills_source_file_row on bills(source_file, source_row_number)")
    finally:
        conn.execute("pragma foreign_keys = on")
