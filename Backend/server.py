from __future__ import annotations

import hashlib
import hmac
import cgi
import json
import os
import sqlite3
import secrets
import threading
import time
import uuid
from collections import defaultdict, deque
from http import cookies
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

from db import DEFAULT_DB_PATH, connect, init_db, resolve_db_path
from excel_reader import normalize_nim
from import_excel import DEFAULT_WORKBOOK, import_workbook, preview_workbook

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR.parent / "Frontend"
DB_PATH = resolve_db_path(os.environ.get("DATABASE_URL", DEFAULT_DB_PATH))
APP_ENV = os.environ.get("APP_ENV", "development").strip().lower()
LOOKUP_HASH_SECRET = os.environ.get("LOOKUP_HASH_SECRET", "")
ADMIN_BOOTSTRAP_EMAIL = os.environ.get("ADMIN_BOOTSTRAP_EMAIL", "").strip().casefold()
ADMIN_BOOTSTRAP_PASSWORD = os.environ.get("ADMIN_BOOTSTRAP_PASSWORD", "")
SESSION_COOKIE = "salut_admin_session"
SESSION_TTL_HOURS = 8
IMPORT_DIR = Path(os.environ.get("IMPORT_DIR", str(BASE_DIR / "data" / "imports"))).resolve()
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
IMPORT_RETENTION_SECONDS = 24 * 60 * 60
ROLE_PERMISSIONS = {
    "viewer": set(),
    "admin": {"import"},
    "super_admin": {"import"},
}

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
}


class RateLimiter:
    def __init__(self) -> None:
        self._entries: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, scope: str, key: str, limit: int, window_seconds: int) -> int | None:
        now = time.monotonic()
        entry_key = f"{scope}:{key}"
        with self._lock:
            entries = self._entries[entry_key]
            while entries and entries[0] <= now - window_seconds:
                entries.popleft()
            if len(entries) >= limit:
                return max(1, int(entries[0] + window_seconds - now) + 1)
            entries.append(now)
        return None


RATE_LIMITER = RateLimiter()


def json_response(
    handler: BaseHTTPRequestHandler,
    status: int,
    payload: dict,
    extra_headers: dict[str, str] | None = None,
) -> None:
    if not payload.get("success") and "request_id" not in payload:
        payload["request_id"] = f"req_{uuid.uuid4().hex[:12]}"
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(data)))
    if extra_headers:
        for key, value in extra_headers.items():
            handler.send_header(key, value)
    handler.end_headers()
    handler.wfile.write(data)


def rupiah(value: int) -> str:
    return "Rp " + f"{value:,}".replace(",", ".")


def digest(value: str) -> str:
    return hmac.new(
        LOOKUP_HASH_SECRET.encode("utf-8"),
        value.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def hash_password(password: str, salt: str | None = None, iterations: int = 260000) -> str:
    salt = salt or secrets.token_hex(16)
    password_hash = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), iterations)
    return f"pbkdf2_sha256${iterations}${salt}${password_hash.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, iterations, salt, expected = stored_hash.split("$", 3)
    except ValueError:
        return False
    if algorithm != "pbkdf2_sha256":
        return False
    candidate = hash_password(password, salt, int(iterations)).split("$", 3)[3]
    return hmac.compare_digest(candidate, expected)


def cookie_header(token: str, max_age: int) -> str:
    parts = [
        f"{SESSION_COOKIE}={token}",
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        f"Max-Age={max_age}",
    ]
    if APP_ENV == "production":
        parts.append("Secure")
    return "; ".join(parts)


def sanitize_filename(filename: str) -> str:
    cleaned = "".join(ch for ch in filename if ch.isalnum() or ch in "._- ")
    return cleaned.strip() or "import.xlsx"


def validate_runtime_configuration() -> None:
    if APP_ENV != "production":
        return
    missing = [
        name
        for name, value in {
            "LOOKUP_HASH_SECRET": LOOKUP_HASH_SECRET,
            "ADMIN_BOOTSTRAP_EMAIL": ADMIN_BOOTSTRAP_EMAIL,
            "ADMIN_BOOTSTRAP_PASSWORD": ADMIN_BOOTSTRAP_PASSWORD,
        }.items()
        if not value
    ]
    if missing:
        raise RuntimeError(f"Konfigurasi production belum lengkap: {', '.join(missing)}")


def cleanup_stale_imports() -> None:
    if not IMPORT_DIR.exists():
        return
    cutoff = time.time() - IMPORT_RETENTION_SECONDS
    for workbook in IMPORT_DIR.glob("*.xlsx"):
        if workbook.stat().st_mtime < cutoff:
            workbook.unlink(missing_ok=True)


def ensure_database() -> None:
    validate_runtime_configuration()
    conn = connect(DB_PATH)
    init_db(conn)
    admin_total = conn.execute("select count(*) as total from admin_users").fetchone()["total"]
    if admin_total == 0:
        if not ADMIN_BOOTSTRAP_EMAIL or not ADMIN_BOOTSTRAP_PASSWORD:
            conn.close()
            raise RuntimeError("Admin awal belum ada. Set ADMIN_BOOTSTRAP_EMAIL dan ADMIN_BOOTSTRAP_PASSWORD.")
        with conn:
            conn.execute(
                """
                insert into admin_users (id, email, password_hash, full_name, role)
                values (?, ?, ?, ?, 'super_admin')
                """,
                (
                    str(uuid.uuid4()),
                    ADMIN_BOOTSTRAP_EMAIL.strip().casefold(),
                    hash_password(ADMIN_BOOTSTRAP_PASSWORD),
                    "Admin SALUT",
                ),
            )
    total = conn.execute("select count(*) as total from students").fetchone()["total"]
    conn.close()
    if total == 0 and DEFAULT_WORKBOOK.exists():
        import_workbook(DEFAULT_WORKBOOK, DB_PATH)


class SalutHandler(BaseHTTPRequestHandler):
    server_version = "SalutCekPembayaran/0.1"

    def log_message(self, fmt: str, *args: object) -> None:
        print("%s - %s" % (self.address_string(), fmt % args))

    def end_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Content-Security-Policy", "default-src 'self'; base-uri 'none'; frame-ancestors 'none'")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            self.handle_health()
            return
        if parsed.path == "/api/admin/me":
            self.handle_admin_me()
            return
        self.serve_frontend(parsed.path)

    def do_HEAD(self) -> None:
        parsed = urlparse(self.path)
        self.serve_frontend(parsed.path, send_body=False)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/lookup":
            self.handle_lookup()
            return
        if parsed.path == "/api/admin/login":
            self.handle_admin_login()
            return
        if parsed.path == "/api/admin/logout":
            self.handle_admin_logout()
            return
        if parsed.path == "/api/admin/import/preview":
            self.handle_admin_import_preview()
            return
        if parsed.path == "/api/admin/import/commit":
            self.handle_admin_import_commit()
            return
        json_response(self, 404, {"success": False, "error": {"message": "Endpoint tidak ditemukan."}})

    def read_json(self) -> dict:
        length = int(self.headers.get("content-length", "0"))
        body = self.rfile.read(length).decode("utf-8") if length else "{}"
        try:
            return json.loads(body)
        except json.JSONDecodeError:
            return {}

    def handle_health(self) -> None:
        conn = connect(DB_PATH)
        students = conn.execute("select count(*) as total from students").fetchone()["total"]
        bills = conn.execute("select count(*) as total from bills").fetchone()["total"]
        issues = conn.execute("select count(*) as total from import_issues").fetchone()["total"]
        conn.close()
        json_response(
            self,
            200,
            {
                "success": True,
                "data": {
                    "status": "ok",
                    "students": students,
                    "bills": bills,
                    "import_issues": issues,
                },
            },
        )

    def handle_admin_me(self) -> None:
        admin = self.require_admin()
        if not admin:
            return
        json_response(
            self,
            200,
            {
                "success": True,
                "data": {
                    "email": admin["email"],
                    "full_name": admin["full_name"],
                    "role": admin["role"],
                },
            },
        )

    def handle_admin_login(self) -> None:
        payload = self.read_json()
        email = str(payload.get("email") or "").strip().casefold()
        password = str(payload.get("password") or "")

        if not email or not password:
            json_response(
                self,
                400,
                {"success": False, "error": {"code": "VALIDATION_ERROR", "message": "Email dan password wajib diisi."}},
            )
            return

        conn = connect(DB_PATH)
        admin = conn.execute(
            """
            select id, email, password_hash, full_name, role, is_active
            from admin_users
            where email = ?
            """,
            (email,),
        ).fetchone()

        if not admin or not admin["is_active"] or not verify_password(password, admin["password_hash"]):
            conn.close()
            retry_after = RATE_LIMITER.check("login", f"{self.client_ip()}:{email}", 5, 15 * 60)
            if retry_after:
                json_response(
                    self,
                    429,
                    {"success": False, "error": {"code": "RATE_LIMITED", "message": "Terlalu banyak percobaan login. Coba lagi nanti."}},
                    {"Retry-After": str(retry_after)},
                )
                return
            json_response(
                self,
                401,
                {"success": False, "error": {"code": "UNAUTHORIZED", "message": "Email atau password tidak sesuai."}},
            )
            return

        token = secrets.token_urlsafe(32)
        session_id = str(uuid.uuid4())
        with conn:
            conn.execute(
                """
                insert into admin_sessions (id, admin_id, token_hash, expires_at)
                values (?, ?, ?, datetime('now', ?))
                """,
                (session_id, admin["id"], token_hash(token), f"+{SESSION_TTL_HOURS} hours"),
            )
            self.write_audit(conn, admin["id"], "admin.login", "admin_session", session_id, {"email": email})
        conn.close()

        json_response(
            self,
            200,
            {
                "success": True,
                "data": {"email": admin["email"], "full_name": admin["full_name"], "role": admin["role"]},
            },
            {"Set-Cookie": cookie_header(token, SESSION_TTL_HOURS * 60 * 60)},
        )

    def handle_admin_logout(self) -> None:
        token = self.session_token()
        admin = self.current_admin()
        conn = connect(DB_PATH)
        with conn:
            if token:
                conn.execute("delete from admin_sessions where token_hash = ?", (token_hash(token),))
            if admin:
                self.write_audit(conn, admin["id"], "admin.logout", "admin_session", None, {"email": admin["email"]})
        conn.close()
        json_response(
            self,
            200,
            {"success": True},
            {"Set-Cookie": cookie_header("", 0)},
        )

    def handle_admin_import_preview(self) -> None:
        admin = self.require_admin("import")
        if not admin:
            return

        if not self.enforce_rate_limit("import_preview", admin["id"], 20, 60 * 60):
            return

        saved_path: Path | None = None
        try:
            filename, content = self.read_uploaded_file("file")
            if not filename.lower().endswith(".xlsx"):
                raise ValueError("File harus berformat .xlsx.")
            if len(content) > MAX_UPLOAD_BYTES:
                raise ValueError("Ukuran file maksimal 5 MB.")

            IMPORT_DIR.mkdir(parents=True, exist_ok=True)
            cleanup_stale_imports()
            import_token = f"imp_{uuid.uuid4().hex}"
            safe_name = sanitize_filename(filename)
            saved_path = IMPORT_DIR / f"{import_token}_{safe_name}"
            saved_path.write_bytes(content)
            preview = preview_workbook(saved_path, DB_PATH)

            conn = connect(DB_PATH)
            with conn:
                self.write_audit(
                    conn,
                    admin["id"],
                    "import.preview",
                    "excel_import",
                    import_token,
                    {
                        "file_name": safe_name,
                        "valid_rows": preview["valid_rows"],
                        "critical_rows": preview["critical_rows"],
                        "issue_rows": preview["issue_rows"],
                        "new_rows": preview["new_rows"],
                        "update_rows": preview["update_rows"],
                        "unchanged_rows": preview["unchanged_rows"],
                        "amount_change_rows": preview["amount_change_rows"],
                        "briva_change_rows": preview["briva_change_rows"],
                    },
                )
            conn.close()

            json_response(
                self,
                200,
                {
                    "success": True,
                    "data": {
                        "import_token": import_token,
                        "file_name": safe_name,
                        **preview,
                    },
                },
            )
        except Exception as exc:
            if saved_path:
                saved_path.unlink(missing_ok=True)
            message = str(exc) if isinstance(exc, ValueError) else "File tidak dapat diproses. Gunakan workbook Excel yang valid."
            json_response(
                self,
                400,
                {"success": False, "error": {"code": "IMPORT_PREVIEW_FAILED", "message": message}},
            )

    def handle_admin_import_commit(self) -> None:
        admin = self.require_admin("import")
        if not admin:
            return

        if not self.enforce_rate_limit("import_commit", admin["id"], 10, 60 * 60):
            return

        payload = self.read_json()
        import_token = str(payload.get("import_token") or "")
        confirm_updates = payload.get("confirm_updates") is True
        if not import_token.startswith("imp_"):
            json_response(
                self,
                400,
                {"success": False, "error": {"code": "VALIDATION_ERROR", "message": "Token import tidak valid."}},
            )
            return

        matches = list(IMPORT_DIR.glob(f"{import_token}_*.xlsx"))
        if not matches:
            json_response(
                self,
                404,
                {"success": False, "error": {"code": "NOT_FOUND", "message": "File preview import tidak ditemukan."}},
            )
            return

        workbook = matches[0]
        try:
            preview = preview_workbook(workbook, DB_PATH)
            if preview["critical_rows"]:
                workbook.unlink(missing_ok=True)
                json_response(
                    self,
                    400,
                    {
                        "success": False,
                        "error": {
                            "code": "IMPORT_VALIDATION_FAILED",
                            "message": "Import dibatalkan karena ada baris kritis pada sheet Data Sinkron.",
                        },
                    },
                )
                return
            if preview["requires_update_confirmation"] and not confirm_updates:
                json_response(
                    self,
                    409,
                    {
                        "success": False,
                        "error": {
                            "code": "IMPORT_CONFIRMATION_REQUIRED",
                            "message": "Perubahan nominal atau BRIVA harus dikonfirmasi admin sebelum import disimpan.",
                        },
                    },
                )
                return
            source_file_name = workbook.name[len(import_token) + 1 :]
            result = import_workbook(
                workbook,
                DB_PATH,
                source_file_name=source_file_name,
                confirm_updates=confirm_updates,
            )
            conn = connect(DB_PATH)
            with conn:
                self.write_audit(
                    conn,
                    admin["id"],
                    "import.commit",
                    "excel_import",
                    import_token,
                    {"file_name": workbook.name, **result},
                )
            conn.close()
            workbook.unlink(missing_ok=True)
            json_response(self, 200, {"success": True, "data": result})
        except ValueError as exc:
            json_response(
                self,
                400,
                {"success": False, "error": {"code": "IMPORT_VALIDATION_FAILED", "message": str(exc)}},
            )
        except Exception:
            json_response(
                self,
                400,
                {
                    "success": False,
                    "error": {"code": "IMPORT_COMMIT_FAILED", "message": "Import tidak dapat disimpan. Periksa file dan coba lagi."},
                },
            )

    def handle_lookup(self) -> None:
        request_id = f"req_{uuid.uuid4().hex[:12]}"
        payload = self.read_json()
        nim = normalize_nim(payload.get("nim"))

        if not self.enforce_rate_limit("lookup", self.client_ip(), 10, 10 * 60, nim):
            return

        if not nim:
            self.write_lookup_log(nim, "", "invalid")
            json_response(
                self,
                400,
                {
                    "success": False,
                    "error": {"code": "VALIDATION_ERROR", "message": "NIM wajib diisi."},
                    "request_id": request_id,
                },
            )
            return

        conn = connect(DB_PATH)
        student = conn.execute(
            "select id, nim, full_name, name_norm from students where nim = ?",
            (nim,),
        ).fetchone()

        if not student:
            conn.close()
            self.write_lookup_log(nim, "", "not_found")
            json_response(
                self,
                404,
                {
                    "success": False,
                    "error": {
                        "code": "NOT_FOUND",
                        "message": "Data tagihan tidak ditemukan. Pastikan NIM sesuai data SALUT.",
                    },
                    "request_id": request_id,
                },
            )
            return

        bills = conn.execute(
            """
            select briva, amount, period, bill_type, status, payment_method, instructions
            from bills
            where student_id = ?
            order by period desc, created_at desc
            """,
            (student["id"],),
        ).fetchall()
        conn.close()
        self.write_lookup_log(nim, "", "found")

        json_response(
            self,
            200,
            {
                "success": True,
                "data": {
                    "student": {
                        "nim": student["nim"],
                        "full_name": student["full_name"],
                    },
                    "bills": [
                        {
                            "period": bill["period"],
                            "bill_type": bill["bill_type"],
                            "status": bill["status"],
                            "amount": bill["amount"],
                            "amount_formatted": rupiah(int(bill["amount"])),
                            "payment_method": bill["payment_method"],
                            "briva": bill["briva"],
                            "instructions": bill["instructions"],
                        }
                        for bill in bills
                    ],
                },
                "request_id": request_id,
            },
        )

    def write_lookup_log(self, nim: str, name: str, result_type: str) -> None:
        conn = connect(DB_PATH)
        with conn:
            conn.execute(
                """
                insert into lookup_logs (id, nim_hash, name_hash, result_type)
                values (?, ?, ?, ?)
                """,
                (str(uuid.uuid4()), digest(nim), digest(name), result_type),
            )
        conn.close()

    def write_audit(
        self,
        conn: sqlite3.Connection,
        actor_id: str | None,
        action: str,
        entity_type: str,
        entity_id: str | None,
        metadata: dict[str, object] | None = None,
    ) -> None:
        conn.execute(
            """
            insert into audit_logs (id, actor_id, action, entity_type, entity_id, metadata)
            values (?, ?, ?, ?, ?, ?)
            """,
            (str(uuid.uuid4()), actor_id, action, entity_type, entity_id, json.dumps(metadata or {}, ensure_ascii=False)),
        )

    def session_token(self) -> str | None:
        raw_cookie = self.headers.get("Cookie")
        if not raw_cookie:
            return None
        parsed = cookies.SimpleCookie(raw_cookie)
        morsel = parsed.get(SESSION_COOKIE)
        return morsel.value if morsel else None

    def current_admin(self) -> sqlite3.Row | None:
        token = self.session_token()
        if not token:
            return None
        conn = connect(DB_PATH)
        admin = conn.execute(
            """
            select u.id, u.email, u.full_name, u.role
            from admin_sessions s
            join admin_users u on u.id = s.admin_id
            where s.token_hash = ?
              and s.expires_at > datetime('now')
              and u.is_active = 1
            """,
            (token_hash(token),),
        ).fetchone()
        conn.close()
        return admin

    def client_ip(self) -> str:
        if os.environ.get("TRUST_PROXY_HEADERS", "").lower() == "true":
            forwarded = self.headers.get("X-Forwarded-For", "")
            if forwarded:
                return forwarded.split(",", 1)[0].strip()
        return self.client_address[0]

    def enforce_rate_limit(
        self,
        scope: str,
        key: str,
        limit: int,
        window_seconds: int,
        nim: str = "",
        name: str = "",
    ) -> bool:
        retry_after = RATE_LIMITER.check(scope, key, limit, window_seconds)
        if not retry_after:
            return True
        if scope == "lookup":
            self.write_lookup_log(nim, name, "rate_limited")
        json_response(
            self,
            429,
            {"success": False, "error": {"code": "RATE_LIMITED", "message": "Terlalu banyak permintaan. Coba lagi nanti."}},
            {"Retry-After": str(retry_after)},
        )
        return False

    def require_admin(self, permission: str | None = None) -> sqlite3.Row | None:
        admin = self.current_admin()
        if not admin:
            json_response(
                self,
                401,
                {"success": False, "error": {"code": "UNAUTHORIZED", "message": "Silakan login sebagai admin."}},
            )
            return None
        if permission and permission not in ROLE_PERMISSIONS.get(admin["role"], set()):
            json_response(
                self,
                403,
                {"success": False, "error": {"code": "FORBIDDEN", "message": "Role Anda tidak memiliki akses untuk aksi ini."}},
            )
            return None
        return admin

    def read_uploaded_file(self, field_name: str) -> tuple[str, bytes]:
        content_type = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in content_type:
            raise ValueError("Request harus multipart/form-data.")
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError as exc:
            raise ValueError("Ukuran upload tidak valid.") from exc
        if content_length > MAX_UPLOAD_BYTES + 64 * 1024:
            raise ValueError("Ukuran file maksimal 5 MB.")

        form = cgi.FieldStorage(
            fp=self.rfile,
            headers=self.headers,
            environ={
                "REQUEST_METHOD": "POST",
                "CONTENT_TYPE": content_type,
                "CONTENT_LENGTH": self.headers.get("Content-Length", "0"),
            },
        )
        field = form[field_name] if field_name in form else None
        if field is None or not getattr(field, "filename", ""):
            raise ValueError("File upload wajib diisi.")
        return field.filename, field.file.read()

    def serve_frontend(self, path: str, send_body: bool = True) -> None:
        if path in {"/admin", "/admin/"}:
            requested = "admin.html"
        else:
            requested = unquote(path.lstrip("/")) or "index.html"
        file_path = (FRONTEND_DIR / requested).resolve()
        frontend_root = FRONTEND_DIR.resolve()

        try:
            file_path.relative_to(frontend_root)
        except ValueError:
            file_path = frontend_root / "index.html"

        if not file_path.exists() or file_path.is_dir():
            file_path = frontend_root / "index.html"

        data = file_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", CONTENT_TYPES.get(file_path.suffix, "application/octet-stream"))
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        if send_body:
            self.wfile.write(data)


def main() -> None:
    ensure_database()
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer(("127.0.0.1", port), SalutHandler)
    print(f"Salut Cek Pembayaran running at http://127.0.0.1:{port}")
    print(f"SQLite database: {DB_PATH.resolve()}")
    server.serve_forever()


if __name__ == "__main__":
    main()
