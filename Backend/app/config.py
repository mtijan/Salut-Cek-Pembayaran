from __future__ import annotations

import os
from pathlib import Path

from Backend.db import DEFAULT_DB_PATH, resolve_db_path

BASE_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BASE_DIR.parent
FRONTEND_DIR = PROJECT_ROOT / "Frontend"

APP_ENV = os.environ.get("APP_ENV", "development").strip().lower()
PORT = int(os.environ.get("PORT", "8000"))
DB_PATH = resolve_db_path(os.environ.get("DATABASE_URL", DEFAULT_DB_PATH))
LOOKUP_HASH_SECRET = os.environ.get("LOOKUP_HASH_SECRET", "")
ADMIN_BOOTSTRAP_EMAIL = os.environ.get("ADMIN_BOOTSTRAP_EMAIL", "").strip().casefold()
ADMIN_BOOTSTRAP_PASSWORD = os.environ.get("ADMIN_BOOTSTRAP_PASSWORD", "")
TRUST_PROXY_HEADERS = os.environ.get("TRUST_PROXY_HEADERS", "").lower() == "true"
DEFAULT_PROGRAM_STUDY = os.environ.get("DEFAULT_PROGRAM_STUDY", "S1 Ilmu Hukum")
DEFAULT_PAYMENT_PERIOD_LABEL = os.environ.get("DEFAULT_PAYMENT_PERIOD_LABEL", "Semester Ganjil 2026")

SESSION_COOKIE = "salut_admin_session"
SESSION_TTL_HOURS = 8
IMPORT_DIR = Path(os.environ.get("IMPORT_DIR", str(BASE_DIR / "data" / "imports"))).resolve()
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
IMPORT_RETENTION_SECONDS = 24 * 60 * 60

ROLE_PERMISSIONS = {
    "viewer": set(),
    "admin": {"import", "manage_data"},
    "super_admin": {"import", "manage_data"},
}
