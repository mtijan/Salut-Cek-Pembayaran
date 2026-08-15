from __future__ import annotations

import os
import subprocess
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


def _read_git_release_id() -> str | None:
    git_dir = PROJECT_ROOT / ".git"
    if git_dir.is_file():
        git_dir_text = git_dir.read_text(encoding="utf-8", errors="ignore").strip()
        if git_dir_text.startswith("gitdir:"):
            git_dir = (PROJECT_ROOT / git_dir_text.removeprefix("gitdir:").strip()).resolve()

    try:
        head = (git_dir / "HEAD").read_text(encoding="utf-8").strip()
    except OSError:
        head = ""

    if head and not head.startswith("ref:"):
        return head[:7]

    if head.startswith("ref:"):
        ref_name = head.removeprefix("ref:").strip()
        try:
            ref_hash = (git_dir / ref_name).read_text(encoding="utf-8").strip()
        except OSError:
            ref_hash = ""
        if ref_hash:
            return ref_hash[:7]

        try:
            packed_refs = (git_dir / "packed-refs").read_text(encoding="utf-8", errors="ignore").splitlines()
        except OSError:
            packed_refs = []
        for line in packed_refs:
            if line.startswith("#") or not line.strip():
                continue
            commit_hash, _, packed_ref_name = line.partition(" ")
            if packed_ref_name.strip() == ref_name:
                return commit_hash[:7]

    try:
        result = subprocess.run(
            ["git", "-C", str(PROJECT_ROOT), "rev-parse", "--short", "HEAD"],
            capture_output=True,
            check=False,
            text=True,
            timeout=2,
        )
    except (OSError, subprocess.SubprocessError):
        return None

    if result.returncode != 0:
        return None

    output = result.stdout.strip().splitlines()
    if not output:
        return None
    return output[0].strip() or None


def resolve_release_id(raw_release_id: str | None = None) -> str:
    release_id = os.environ.get("RELEASE_ID") if raw_release_id is None else raw_release_id
    release_id = (release_id or "auto").strip()
    if release_id.lower() not in {"auto", "git", "head"}:
        return release_id
    return _read_git_release_id() or "unknown"


RELEASE_ID = resolve_release_id()

SESSION_COOKIE = "salut_admin_session"
SESSION_TTL_HOURS = 8
IMPORT_DIR = Path(os.environ.get("IMPORT_DIR", str(BASE_DIR / "data" / "imports"))).resolve()
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
IMPORT_RETENTION_SECONDS = 24 * 60 * 60

ROLE_PERMISSIONS = {
    "viewer": {"view_reports"},
    "admin_akademik": {"manage_data", "manage_students", "manage_master_data", "view_reports"},
    "admin_keuangan": {"manage_data", "manage_billing", "import", "view_reports"},
    "admin": {"manage_data", "manage_students", "manage_billing", "manage_master_data", "import", "view_reports"},
    "super_admin": {"manage_data", "manage_students", "manage_billing", "manage_master_data", "import", "view_reports", "manage_users"},
}
