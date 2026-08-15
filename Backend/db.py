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
    migrate_soft_delete(conn)
    migrate_master_data_and_student_siakad(conn)
    conn.execute("create index if not exists idx_bills_source_file_row on bills(source_file, source_row_number)")
    conn.execute("create index if not exists idx_students_academic_status on students(academic_status)")
    conn.execute("create index if not exists idx_students_entry_year on students(entry_year)")
    conn.execute("create index if not exists idx_students_study_program_id on students(study_program_id)")


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


def migrate_master_data_and_student_siakad(conn: sqlite3.Connection) -> None:
    columns = _table_columns(conn, "students")
    if "study_program_id" not in columns:
        conn.execute("alter table students add column study_program_id text")
    if "academic_status" not in columns:
        conn.execute("alter table students add column academic_status text default 'aktif'")
    if "entry_year" not in columns:
        conn.execute("alter table students add column entry_year integer")
    if "email" not in columns:
        conn.execute("alter table students add column email text")
    if "address" not in columns:
        conn.execute("alter table students add column address text")

    # Seed initial study programs if empty
    row = conn.execute("select count(*) as cnt from study_programs").fetchone()
    if row and row["cnt"] == 0:
        default_prodis = [
            ("sp_hkm", "HKM", "S1 Ilmu Hukum", "S1", "FHISIP"),
            ("sp_mnj", "MNJ", "S1 Manajemen", "S1", "FEB"),
            ("sp_akt", "AKT", "S1 Akuntansi", "S1", "FEB"),
            ("sp_kom", "KOM", "S1 Ilmu Komunikasi", "S1", "FHISIP"),
            ("sp_sif", "SIF", "S1 Sistem Informasi", "S1", "FST"),
            ("sp_pgsd", "PGSD", "S1 PGSD", "S1", "FKIP"),
            ("sp_ipem", "IPEM", "S1 Ilmu Pemerintahan", "S1", "FHISIP"),
            ("sp_adm", "ADM", "S1 Ilmu Administrasi Negara", "S1", "FHISIP"),
        ]
        conn.executemany(
            "insert into study_programs (id, code, name, degree, faculty, is_active) values (?, ?, ?, ?, ?, 1)",
            default_prodis,
        )

    # Seed initial academic periods if empty
    p_row = conn.execute("select count(*) as cnt from academic_periods").fetchone()
    if p_row and p_row["cnt"] == 0:
        default_periods = [
            ("prd_20251", "20251", "2025/2026 Ganjil", "ganjil", 1, "2026-08-25"),
            ("prd_20242", "20242", "2024/2025 Genap", "genap", 0, "2025-02-28"),
        ]
        conn.executemany(
            "insert into academic_periods (id, code, name, semester_type, is_active, default_due_date) values (?, ?, ?, ?, ?, ?)",
            default_periods,
        )

    # Seed initial bill types if empty
    b_row = conn.execute("select count(*) as cnt from bill_types").fetchone()
    if b_row and b_row["cnt"] == 0:
        default_bill_types = [
            ("bt_ukt", "UKT", "UKT SPP Pokok", 1850000),
            ("bt_reg", "REG", "Registrasi Awal", 100000),
            ("bt_prk", "PRK", "Biaya Praktikum", 500000),
        ]
        conn.executemany(
            "insert into bill_types (id, code, name, default_amount) values (?, ?, ?, ?)",
            default_bill_types,
        )

    # Auto-link study_program_id and extract entry_year for existing students
    conn.execute(
        """
        update students
        set study_program_id = (
            select id from study_programs where lower(study_programs.name) = lower(students.program_study) limit 1
        )
        where study_program_id is null and program_study is not null
        """
    )
    conn.execute(
        """
        update students
        set academic_status = 'aktif'
        where academic_status is null
        """
    )
    conn.execute(
        """
        update students
        set entry_year = cast(substr(initial_registration, instr(initial_registration, '20'), 4) as integer)
        where entry_year is null and initial_registration like '%20%'
        """
    )



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


def migrate_soft_delete(conn: sqlite3.Connection) -> None:
    student_cols = _table_columns(conn, "students")
    for col in ("deleted_at", "deleted_by", "delete_reason"):
        if col not in student_cols:
            conn.execute(f"alter table students add column {col} text")
    bill_cols = _table_columns(conn, "bills")
    for col in ("deleted_at", "deleted_by", "delete_reason"):
        if col not in bill_cols:
            conn.execute(f"alter table bills add column {col} text")
    conn.execute("create index if not exists idx_students_deleted_at on students(deleted_at)")
    conn.execute("create index if not exists idx_bills_deleted_at on bills(deleted_at)")
