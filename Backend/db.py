"""SQLite database connectivity, schema initialization, and migration management.

This module provides SQLite connection factories, connection/transaction context managers,
schema version migrations (v1 to v5), entry registration period parsing, and study program resolution.
"""

from __future__ import annotations

import hashlib
import re
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Callable, Iterator

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_DB_PATH = BASE_DIR / "data" / "salut.sqlite"
SCHEMA_PATH = BASE_DIR / "schema.sql"
LATEST_SCHEMA_VERSION = 5


def resolve_db_path(db_path: str | Path = DEFAULT_DB_PATH) -> Path:
    """Normalize file URI or string representation into a valid local filesystem Path object."""
    raw = str(db_path)
    if raw.startswith("file:"):
        raw = raw[5:]
    return Path(raw)


def connect(db_path: str | Path = DEFAULT_DB_PATH) -> sqlite3.Connection:
    """Instantiate and configure a SQLite connection with foreign keys and busy timeout."""
    path = resolve_db_path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=5)
    conn.row_factory = sqlite3.Row
    conn.execute("pragma foreign_keys = on")
    conn.execute("pragma busy_timeout = 5000")
    return conn


@contextmanager
def database_connection(db_path: str | Path = DEFAULT_DB_PATH) -> Iterator[sqlite3.Connection]:
    """Open a configured connection and always close it without running migrations."""
    conn = connect(db_path)
    try:
        yield conn
    finally:
        conn.close()


@contextmanager
def database_transaction(db_path: str | Path = DEFAULT_DB_PATH) -> Iterator[sqlite3.Connection]:
    """Own one SQLite transaction and close its connection on every exit path."""
    with database_connection(db_path) as conn:
        with conn:
            yield conn


def migrate_database(db_path: str | Path = DEFAULT_DB_PATH) -> None:
    """Apply schema/data migrations at an explicit startup or CLI boundary."""
    with database_connection(db_path) as conn:
        init_db(conn)


def init_db(conn: sqlite3.Connection) -> None:
    """Apply schema/data migrations; callers must invoke this only at explicit boundaries."""
    try:
        row = conn.execute("select version from schema_migrations order by version desc limit 1").fetchone()
    except sqlite3.OperationalError:
        with conn:
            conn.execute(
                "create table if not exists schema_migrations (version integer primary key, applied_at text not null default (datetime('now')))"
            )
        row = None

    current_version = int(row["version"]) if row else 0
    if current_version > LATEST_SCHEMA_VERSION:
        raise RuntimeError(
            f"Database schema version {current_version} lebih baru dari versi aplikasi {LATEST_SCHEMA_VERSION}."
        )
    if current_version == LATEST_SCHEMA_VERSION:
        return

    for target_version in range(current_version + 1, LATEST_SCHEMA_VERSION + 1):
        migration = MIGRATIONS.get(target_version)
        if migration is None:
            raise RuntimeError(f"Migration schema version {target_version} tidak tersedia.")
        foreign_keys_enabled = bool(conn.execute("pragma foreign_keys").fetchone()[0])
        if target_version == 1 and foreign_keys_enabled:
            conn.execute("pragma foreign_keys = off")
        try:
            with conn:
                migration(conn)
                if target_version == 1:
                    violations = conn.execute("pragma foreign_key_check").fetchall()
                    if violations:
                        raise RuntimeError("Migration schema v1 menghasilkan pelanggaran foreign key.")
                conn.execute("delete from schema_migrations")
                conn.execute("insert into schema_migrations (version) values (?)", (target_version,))
        finally:
            if target_version == 1 and foreign_keys_enabled:
                conn.execute("pragma foreign_keys = on")

    conn.execute("pragma journal_mode = WAL")


def _execute_sql_script(conn: sqlite3.Connection, script: str) -> None:
    """Execute a SQL script statement-by-statement without implicit transaction commits."""
    statement = ""
    for line in script.splitlines(keepends=True):
        statement += line
        if sqlite3.complete_statement(statement):
            if statement.strip():
                conn.execute(statement)
            statement = ""
    if statement.strip():
        raise RuntimeError("Schema SQL berakhir dengan statement yang tidak lengkap.")


def migrate_schema_v1(conn: sqlite3.Connection) -> None:
    """Bootstrap the application schema and normalize databases without a version marker."""
    _execute_sql_script(conn, SCHEMA_PATH.read_text(encoding="utf-8"))
    migrate_bills_for_duplicate_briva(conn)
    migrate_bills_for_due_date(conn)
    migrate_bills_for_paid_amount(conn)
    migrate_students_for_profile(conn)
    migrate_soft_delete(conn)
    migrate_master_data_and_student_siakad(conn)
    migrate_students_for_master_data(conn)
    migrate_payment_transactions(conn)
    conn.execute("create index if not exists idx_bills_source_file_row on bills(source_file, source_row_number)")
    conn.execute("create index if not exists idx_students_academic_status on students(academic_status)")
    conn.execute("create index if not exists idx_students_entry_year on students(entry_year)")
    conn.execute("create index if not exists idx_students_study_program_id on students(study_program_id)")
    conn.execute("create index if not exists idx_students_no_ktp on students(no_ktp)")
    conn.execute("create index if not exists idx_students_email on students(email)")
    conn.execute("create index if not exists idx_students_phone on students(phone_number)")
    conn.execute("create index if not exists idx_students_entry_period on students(entry_period)")


def migrate_schema_v2(conn: sqlite3.Connection) -> None:
    """Install append-only protection for the payment transaction ledger."""
    migrate_payment_transaction_append_only(conn)


def migrate_schema_v3(conn: sqlite3.Connection) -> None:
    """Add ownership fields for atomic import-preview claims."""
    migrate_import_preview_claims(conn)


def migrate_schema_v4(conn: sqlite3.Connection) -> None:
    """Add reversible due-date backfill run and change ledgers."""
    migrate_due_date_backfill_ledger(conn)


def migrate_schema_v5(conn: sqlite3.Connection) -> None:
    """Complete legacy v4 backfill ledgers with timestamp snapshots."""
    migrate_due_date_backfill_updated_at_ledger(conn)


def _table_sql(conn: sqlite3.Connection, table: str) -> str:
    row = conn.execute("select sql from sqlite_master where type = 'table' and name = ?", (table,)).fetchone()
    return str(row["sql"] or "") if row else ""


def _table_columns(conn: sqlite3.Connection, table: str) -> set[str]:
    return {str(row["name"]) for row in conn.execute(f"pragma table_info({table})").fetchall()}


def _quote_identifier(identifier: str) -> str:
    """Quote a SQLite identifier sourced from schema metadata."""
    return '"' + identifier.replace('"', '""') + '"'


def parse_entry_registration(initial_registration: object) -> tuple[int | None, str | None, str | None]:
    """
    Parse initial_registration text to extract:
    (entry_year, entry_semester, entry_period)
    e.g. 'UNIVERSITAS TERBUKA 2023.1' -> (2023, 'ganjil', '2023.1')
         'UNIVERSITAS TERBUKA 2023.2' -> (2023, 'genap', '2023.2')
         '2024.1' -> (2024, 'ganjil', '2024.1')
    """
    import re

    text = str(initial_registration or "").strip()
    match = re.search(r"(20\d{2})\s*\.\s*([12])", text)
    if match:
        year = int(match.group(1))
        sem_code = match.group(2)
        sem_type = "ganjil" if sem_code == "1" else "genap"
        period = f"{year}.{sem_code}"
        return year, sem_type, period

    year_match = re.search(r"(20\d{2})", text)
    if year_match:
        year = int(year_match.group(1))
        return year, None, str(year)

    return None, None, None


def migrate_bills_for_paid_amount(conn: sqlite3.Connection) -> None:
    columns = _table_columns(conn, "bills")
    if "paid_amount" not in columns:
        conn.execute("alter table bills add column paid_amount integer not null default 0")
    # For existing paid bills where paid_amount is 0 or null, set paid_amount = amount
    conn.execute(
        "update bills set paid_amount = amount where status = 'paid' and (paid_amount is null or paid_amount = 0)"
    )


def migrate_payment_transaction_append_only(conn: sqlite3.Connection) -> None:
    """Prevent silent edits/deletes to the state-change ledger at DB level."""
    conn.executescript(
        """
        create trigger if not exists payment_transactions_no_update
        before update on payment_transactions
        begin
          select raise(abort, 'payment_transactions is append-only');
        end;
        create trigger if not exists payment_transactions_no_delete
        before delete on payment_transactions
        begin
          select raise(abort, 'payment_transactions is append-only');
        end;
        """
    )


def migrate_import_preview_claims(conn: sqlite3.Connection) -> None:
    """Add durable ownership fields used by atomic import-token claims."""
    columns = _table_columns(conn, "import_previews")
    if "claim_id" not in columns:
        conn.execute("alter table import_previews add column claim_id text")
    if "claimed_at" not in columns:
        conn.execute("alter table import_previews add column claimed_at text")


def migrate_due_date_backfill_ledger(conn: sqlite3.Connection) -> None:
    """Create durable metadata needed for measured and reversible due-date backfills."""
    conn.execute(
        """
        create table if not exists due_date_backfill_runs (
          id text primary key,
          status text not null check (status in ('applied', 'rolled_back')),
          backup_archive text not null,
          rollback_backup_archive text,
          candidate_count integer not null,
          normalized_count integer not null,
          unresolved_count integer not null,
          created_at text not null default (datetime('now')),
          rolled_back_at text
        )
        """
    )
    conn.execute(
        """
        create table if not exists due_date_backfill_changes (
          run_id text not null references due_date_backfill_runs(id) on delete restrict,
          bill_id text not null references bills(id) on delete restrict,
          old_due_date text not null,
          new_due_date text not null,
          old_updated_at text not null,
          new_updated_at text not null,
          applied_at text not null default (datetime('now')),
          primary key (run_id, bill_id)
        )
        """
    )
    conn.execute(
        "create index if not exists idx_due_date_backfill_changes_bill_id on due_date_backfill_changes(bill_id)"
    )


def migrate_due_date_backfill_updated_at_ledger(conn: sqlite3.Connection) -> None:
    """Add timestamp snapshots missing from the first deployed v4 ledger shape.

    Empty-string defaults intentionally make legacy rows fail the rollback concurrency
    guard instead of pretending an exact historical ``updated_at`` value is known.
    New backfill runs always write explicit, precise values into both columns.
    """
    columns = _table_columns(conn, "due_date_backfill_changes")
    if "old_updated_at" not in columns:
        conn.execute("alter table due_date_backfill_changes add column old_updated_at text not null default ''")
    if "new_updated_at" not in columns:
        conn.execute("alter table due_date_backfill_changes add column new_updated_at text not null default ''")


def migrate_bills_for_due_date(conn: sqlite3.Connection) -> None:
    columns = _table_columns(conn, "bills")
    if "due_date" not in columns:
        conn.execute("alter table bills add column due_date text")


def migrate_students_for_profile(conn: sqlite3.Connection) -> None:
    columns = _table_columns(conn, "students")
    for column in ("program_study", "initial_registration", "phone_number"):
        if column not in columns:
            conn.execute(f"alter table students add column {column} text")


def migrate_students_for_master_data(conn: sqlite3.Connection) -> None:
    columns = _table_columns(conn, "students")
    for column in ("no_ktp", "tempat_lahir", "tanggal_lahir", "nama_ibu_kandung", "entry_semester", "entry_period"):
        if column not in columns:
            conn.execute(f"alter table students add column {column} text")

    # Update existing students' entry_year, entry_semester, entry_period from initial_registration if not filled
    rows = conn.execute(
        "select id, initial_registration, entry_year, entry_semester, entry_period from students where initial_registration is not null"
    ).fetchall()
    for row in rows:
        if not row["entry_period"] or not row["entry_semester"]:
            year, sem, period = parse_entry_registration(row["initial_registration"])
            if year or sem or period:
                conn.execute(
                    """
                    update students
                    set entry_year = coalesce(entry_year, ?),
                        entry_semester = coalesce(entry_semester, ?),
                        entry_period = coalesce(entry_period, ?)
                    where id = ?
                    """,
                    (year, sem, period, row["id"]),
                )


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

    # Seed initial study programs if empty or partial
    migrate_study_programs_to_4char_codes(conn)

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
    unlinked_students = conn.execute(
        "select id, program_study from students where study_program_id is null and program_study is not null"
    ).fetchall()
    for st in unlinked_students:
        sp_id = resolve_study_program_id(conn, st["program_study"])
        if sp_id:
            conn.execute("update students set study_program_id = ? where id = ?", (sp_id, st["id"]))

    conn.execute(
        """
        update students
        set academic_status = 'aktif'
        where academic_status is null
        """
    )


DEFAULT_STUDY_PROGRAMS: list[tuple[str, str, str, str, str, list[str]]] = [
    ("sp_hkum", "HKUM", "S1 Ilmu Hukum", "S1", "FHISIP", ["ilmu hukum", "hukum"]),
    ("sp_manj", "MANJ", "S1 Manajemen", "S1", "FEB", ["manajemen", "managemen"]),
    ("sp_akkp", "AKKP", "S1 Akuntansi Keuangan Publik", "S1", "FEB", ["akuntansi keuangan publik"]),
    ("sp_akun", "AKUN", "S1 Akuntansi", "S1", "FEB", ["akuntansi"]),
    ("sp_agri", "AGRI", "S1 Agribisnis", "S1", "FEB", ["agribisnis"]),
    ("sp_ekpb", "EKPB", "S1 Ekonomi Pembangunan", "S1", "FEB", ["ekonomi pembangunan"]),
    ("sp_eksy", "EKSY", "S1 Ekonomi Syariah", "S1", "FEB", ["ekonomi syariah"]),
    ("sp_kwir", "KWIR", "S1 Kewirausahaan", "S1", "FEB", ["kewirausahaan"]),
    ("sp_pari", "PARI", "S1 Pariwisata", "S1", "FEB", ["pariwisata"]),
    ("sp_pajk", "PAJK", "S1 Perpajakan", "S1", "FEB", ["perpajakan"]),
    ("sp_komu", "KOMU", "S1 Ilmu Komunikasi", "S1", "FHISIP", ["ilmu komunikasi", "komunikasi"]),
    ("sp_ipem", "IPEM", "S1 Ilmu Pemerintahan", "S1", "FHISIP", ["ilmu pemerintahan", "pemerintahan"]),
    (
        "sp_admn",
        "ADMN",
        "S1 Ilmu Administrasi Negara",
        "S1",
        "FHISIP",
        ["ilmu administrasi negara", "administrasi negara"],
    ),
    ("sp_admb", "ADMB", "S1 Administrasi Bisnis", "S1", "FHISIP", ["administrasi bisnis"]),
    ("sp_sosi", "SOSI", "S1 Sosiologi", "S1", "FHISIP", ["sosiologi"]),
    ("sp_sing", "SING", "S1 Sastra Inggris", "S1", "FHISIP", ["sastra inggris"]),
    ("sp_pgsd", "PGSD", "S1 PGSD", "S1", "FKIP", ["pgsd"]),
    ("sp_paud", "PAUD", "S1 PGPAUD", "S1", "FKIP", ["pgpaud", "paud"]),
    ("sp_pgai", "PGAI", "S1 PAI", "S1", "FKIP", ["pai", "pendidikan agama islam"]),
    ("sp_ppkn", "PPKN", "S1 PPKN", "S1", "FKIP", ["ppkn"]),
    (
        "sp_pbin",
        "PBIN",
        "S1 Pendidikan Bahasa dan Sastra Indonesia",
        "S1",
        "FKIP",
        ["pendidikan bahasa dan sastra indonesia", "pendidikan bahasa indonesia"],
    ),
    ("sp_pbig", "PBIG", "S1 Pendidikan Bahasa Inggris", "S1", "FKIP", ["pendidikan bahasa inggris"]),
    ("sp_pbio", "PBIO", "S1 Pendidikan Biologi", "S1", "FKIP", ["pendidikan biologi"]),
    ("sp_peko", "PEKO", "S1 Pendidikan Ekonomi", "S1", "FKIP", ["pendidikan ekonomi"]),
    ("sp_pfis", "PFIS", "S1 Pendidikan Fisika", "S1", "FKIP", ["pendidikan fisika"]),
    ("sp_pmat", "PMAT", "S1 Pendidikan Matematika", "S1", "FKIP", ["pendidikan matematika", "pendidikan matematikan"]),
    ("sp_tpen", "TPEN", "S1 Teknologi Pendidikan", "S1", "FKIP", ["teknologi pendidikan"]),
    ("sp_sifo", "SIFO", "S1 Sistem Informasi", "S1", "FST", ["sistem informasi"]),
    ("sp_biol", "BIOL", "S1 Biologi", "S1", "FST", ["biologi"]),
    ("sp_tpan", "TPAN", "S1 Teknologi Pangan", "S1", "FST", ["teknologi pangan"]),
    ("sp_mate", "MATE", "S1 Matematika", "S1", "FST", ["matematika"]),
]


def resolve_study_program_id(conn: sqlite3.Connection, raw_program: str | None) -> str | None:
    """Resolve study program UUID from free-text program study name or faculty prefix."""
    if not raw_program or not str(raw_program).strip():
        return None
    raw_clean = re.sub(r"\s+", " ", str(raw_program)).strip()
    fac_match = re.match(r"^(FEB|FHISIP|FKIP|FST)\s*[-–—]\s*(.*)$", raw_clean, flags=re.IGNORECASE)
    faculty = fac_match.group(1).upper() if fac_match else ""
    prodi_name = fac_match.group(2).strip().lower() if fac_match else raw_clean.lower()

    # 1. Exact name or code match in DB first
    row = conn.execute(
        "select id from study_programs where lower(name) = ? or lower(code) = ? limit 1",
        (raw_clean.lower(), raw_clean.lower()),
    ).fetchone()
    if row:
        return str(row[0])

    candidates = [p for p in DEFAULT_STUDY_PROGRAMS if not faculty or p[4].upper() == faculty]
    if not candidates:
        candidates = DEFAULT_STUDY_PROGRAMS

    for sp_id, code, name, deg, fac, keywords in sorted(
        candidates, key=lambda x: max(len(k) for k in x[5]), reverse=True
    ):
        for kw in sorted(keywords, key=len, reverse=True):
            if kw in prodi_name:
                db_sp = conn.execute("select id from study_programs where upper(code) = ? limit 1", (code,)).fetchone()
                if db_sp:
                    return str(db_sp[0])
                return sp_id
    return None


def migrate_study_programs_to_4char_codes(conn: sqlite3.Connection) -> None:
    legacy_map = {
        "HKM": "HKUM",
        "MNJ": "MANJ",
        "AKT": "AKUN",
        "KOM": "KOMU",
        "SIF": "SIFO",
        "ADM": "ADMN",
    }
    for old_code, new_code in legacy_map.items():
        conn.execute("update study_programs set code = ? where upper(code) = ?", (new_code, old_code))

    for sp_id, code, name, deg, fac, _ in DEFAULT_STUDY_PROGRAMS:
        conn.execute(
            """
            insert into study_programs (id, code, name, degree, faculty, is_active)
            values (?, ?, ?, ?, ?, 1)
            on conflict(code) do update set
                name = excluded.name,
                degree = excluded.degree,
                faculty = excluded.faculty
            """,
            (sp_id, code, name, deg, fac),
        )


def migrate_bills_for_duplicate_briva(conn: sqlite3.Connection) -> None:
    columns = _table_columns(conn, "bills")
    table_sql = _table_sql(conn, "bills").lower()
    needs_source_row = "source_row_number" not in columns
    needs_drop_briva_unique = "briva text not null unique" in table_sql
    if not needs_source_row and not needs_drop_briva_unique:
        return

    index_names_to_skip: set[str] = set()
    unique_constraints: list[list[str]] = []
    for index in conn.execute("pragma index_list(bills)").fetchall():
        quoted_index = _quote_identifier(str(index["name"]))
        index_columns = [str(row["name"]) for row in conn.execute(f"pragma index_info({quoted_index})")]
        if int(index["unique"]):
            if index_columns == ["briva"]:
                index_names_to_skip.add(str(index["name"]))
            elif str(index["origin"]) == "u":
                unique_constraints.append(index_columns)
    schema_objects = [
        row
        for row in conn.execute(
            """
            select name, type, sql
            from sqlite_master
            where tbl_name = 'bills' and type in ('index', 'trigger') and sql is not null
            order by type, name
            """
        ).fetchall()
        if str(row["name"]) not in index_names_to_skip
    ]

    table_info = conn.execute("pragma table_info(bills)").fetchall()
    definitions: list[str] = []
    existing_names: list[str] = []
    for column in table_info:
        name = str(column["name"])
        existing_names.append(name)
        definition = f"{_quote_identifier(name)} {str(column['type'] or 'text')}"
        if int(column["pk"]):
            definition += " primary key"
        if int(column["notnull"]):
            definition += " not null"
        if column["dflt_value"] is not None:
            definition += f" default ({column['dflt_value']})"
        if name == "student_id":
            definition += " references students(id) on delete cascade"
        definitions.append(definition)
    if needs_source_row:
        definitions.append("source_row_number integer")
    definitions.extend(
        f"unique ({', '.join(_quote_identifier(name) for name in constraint)})" for constraint in unique_constraints
    )

    conn.execute("drop table if exists bills_new")
    conn.execute(f"create table bills_new ({', '.join(definitions)})")
    quoted_columns = ", ".join(_quote_identifier(name) for name in existing_names)
    conn.execute(f"insert into bills_new ({quoted_columns}) select {quoted_columns} from bills")
    conn.execute("drop table bills")
    conn.execute("alter table bills_new rename to bills")
    for schema_object in schema_objects:
        conn.execute(str(schema_object["sql"]))
    conn.execute("create index if not exists idx_bills_student_id on bills(student_id)")
    conn.execute("create index if not exists idx_bills_source_file_row on bills(source_file, source_row_number)")


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


def ensure_academic_period(conn: sqlite3.Connection, period_code: str, default_name: str | None = None) -> str:
    """Ensure an academic period row exists in database, creating a new record if not present."""
    code_clean = str(period_code or "").strip()
    if not code_clean:
        return ""

    row = conn.execute(
        "select code from academic_periods where lower(code) = lower(?) or lower(name) = lower(?) limit 1",
        (code_clean, code_clean),
    ).fetchone()
    if row:
        return str(row["code"])

    period_id = f"prd_{re.sub(r'[^a-zA-Z0-9]', '', code_clean).lower()}"
    # Human-readable IDs can collide for distinct supported formats such as
    # "2025.1" and "20251". Preserve the legacy ID when available and add a
    # deterministic suffix only when another code already owns it.
    id_owner = conn.execute("select code from academic_periods where id = ?", (period_id,)).fetchone()
    if id_owner and str(id_owner["code"]).casefold() != code_clean.casefold():
        suffix = hashlib.sha256(code_clean.casefold().encode("utf-8")).hexdigest()[:10]
        period_id = f"{period_id}_{suffix}"
    sem_type = "ganjil"
    name = default_name

    m = re.search(r"(20\d{2})\s*[\.]?\s*([12])", code_clean)
    if m:
        year = int(m.group(1))
        sem_code = m.group(2)
        sem_type = "ganjil" if sem_code == "1" else "genap"
        sem_label = "Ganjil" if sem_code == "1" else "Genap"
        next_year = year + 1 if sem_code == "1" else year
        prev_year = year if sem_code == "1" else year - 1
        name = name or f"{prev_year}/{next_year} {sem_label}"
    else:
        name = name or f"Periode {code_clean}"

    conn.execute(
        """
        insert into academic_periods (id, code, name, semester_type, is_active)
        values (?, ?, ?, ?, 0)
        on conflict(code) do nothing
        """,
        (period_id, code_clean, name, sem_type),
    )

    return code_clean


def migrate_payment_transactions(conn: sqlite3.Connection) -> None:
    """Ensure payment_transactions table and indexes exist for databases created before this migration."""
    conn.execute(
        """
        create table if not exists payment_transactions (
          id text primary key,
          bill_id text not null references bills(id) on delete cascade,
          student_id text not null references students(id) on delete cascade,
          transaction_type text not null default 'payment',
          amount integer not null,
          running_paid_total integer not null,
          previous_status text not null,
          new_status text not null,
          payment_date text not null,
          payment_method text,
          reference_number text,
          notes text,
          recorded_by text references admin_users(id) on delete set null,
          source text not null default 'manual',
          created_at text not null default (datetime('now'))
        )
        """
    )
    conn.execute("create index if not exists idx_pt_bill_id on payment_transactions(bill_id)")
    conn.execute("create index if not exists idx_pt_student_id on payment_transactions(student_id)")
    conn.execute("create index if not exists idx_pt_payment_date on payment_transactions(payment_date)")
    conn.execute("create index if not exists idx_pt_created_at on payment_transactions(created_at)")


MIGRATIONS: dict[int, Callable[[sqlite3.Connection], None]] = {
    1: migrate_schema_v1,
    2: migrate_schema_v2,
    3: migrate_schema_v3,
    4: migrate_schema_v4,
    5: migrate_schema_v5,
}
