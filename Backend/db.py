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
