"""FastAPI application composition root and entry point.

This module initializes the FastAPI application instance, configures security headers
and CSP middleware, sets up exception handlers, handles static SPA asset serving,
and composes all modular domain routers.
"""

from __future__ import annotations

import sqlite3
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from json import JSONDecodeError

from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from starlette.middleware.base import RequestResponseEndpoint

from Backend.app import config
from Backend.app.rate_limit import RATE_LIMITER
from Backend.app.responses import error_response, success_response
from Backend.app.routers.auth import build_auth_router
from Backend.app.routers.billing import build_billing_router
from Backend.app.routers.imports import build_import_router
from Backend.app.routers.lookup import build_lookup_router
from Backend.app.routers.master_data import build_master_data_router
from Backend.app.routers.reports import build_report_router
from Backend.app.routers.students import build_student_router
from Backend.app.services import (
    authenticate_admin,
    cleanup_operational_data,
    ensure_database,
    find_admin_by_session,
)
from Backend.app.version import APP_VERSION


class AuthError(Exception):
    """Custom exception raised when authentication or authorization checks fail."""

    def __init__(self, status_code: int, code: str, message: str) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Application lifespan context manager: initializes database and executes operational cleanups."""
    ensure_database()
    cleanup_operational_data()
    yield


app = FastAPI(title="Salut Cek Pembayaran", version=APP_VERSION, lifespan=lifespan)

# Content Security Policy (CSP) configurations
DOCS_CONTENT_SECURITY_POLICY = (
    "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'; "
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    "font-src 'self'; img-src 'self' data: https://fastapi.tiangolo.com https://cdn.jsdelivr.net;"
)

APPLICATION_CONTENT_SECURITY_POLICY = (
    "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'; "
    "script-src 'self'; connect-src 'self'; "
    "style-src 'self'; style-src-elem 'self'; "
    "font-src 'self'; img-src 'self' data:; form-action 'self'; manifest-src 'self';"
)


@app.middleware("http")
async def security_headers(request: Request, call_next: RequestResponseEndpoint) -> Response:
    """Inject strict security headers (nosniff, no-referrer, X-Frame-Options, CSP) into all responses."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Frame-Options"] = "DENY"
    if request.url.path in {"/docs", "/redoc", "/openapi.json"}:
        response.headers["Content-Security-Policy"] = DOCS_CONTENT_SECURITY_POLICY
    else:
        response.headers["Content-Security-Policy"] = APPLICATION_CONTENT_SECURITY_POLICY
    return response


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, __: RequestValidationError) -> JSONResponse:
    """Handle request validation errors and return consistent 400 JSON response."""
    return error_response(400, "VALIDATION_ERROR", "Data yang dikirim belum valid.")


@app.exception_handler(AuthError)
async def auth_exception_handler(_: Request, exc: AuthError) -> JSONResponse:
    """Handle custom authentication/authorization errors and return consistent JSON response."""
    return error_response(exc.status_code, exc.code, exc.message)


def client_ip(request: Request) -> str:
    """Extract client IP address, respecting trusted proxy header if configured."""
    if config.TRUST_PROXY_HEADERS:
        real_ip = request.headers.get("x-real-ip", "").strip()
        if real_ip:
            return real_ip
    return request.client.host if request.client else "unknown"


def parse_limit(request: Request, default: int = 2000, max_limit: int = 5000) -> int:
    """Parse and validate the limit query parameter."""
    raw = request.query_params.get("limit")
    if raw is None or raw == "":
        return default
    try:
        val = int(raw)
    except ValueError:
        raise ValueError("Query parameter limit harus berupa angka.")
    return max(1, min(val, max_limit))


def parse_offset(request: Request) -> int:
    """Parse and validate the offset query parameter."""
    raw = request.query_params.get("offset")
    if raw is None or raw == "":
        return 0
    try:
        value = int(raw)
    except ValueError:
        raise ValueError("Query parameter offset harus berupa angka.")
    return max(0, value)


def enforce_rate_limit(scope: str, key: str, limit: int, window_seconds: int) -> int | None:
    """Enforce in-memory sliding window rate limit for given scope and key."""
    return RATE_LIMITER.check(scope, key, limit, window_seconds)


def session_token(request: Request) -> str | None:
    """Extract session token from HTTP cookie."""
    return request.cookies.get(config.SESSION_COOKIE)


async def read_json(request: Request) -> dict[str, object]:
    """Safely parse JSON request body into a dictionary."""
    try:
        payload = await request.json()
    except JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


def current_admin(request: Request) -> sqlite3.Row | None:
    """Retrieve current authenticated admin row from session cookie."""
    return find_admin_by_session(session_token(request))


def require_admin(permission: str | None = None) -> Callable[[Request], sqlite3.Row]:
    """Dependency factory that validates admin session and checks for required RBAC capability."""

    def dependency(request: Request) -> sqlite3.Row:
        admin = current_admin(request)
        if not admin:
            raise AuthError(401, "UNAUTHORIZED", "Silakan login sebagai admin.")
        if permission and permission not in config.ROLE_PERMISSIONS.get(admin["role"], set()):
            raise AuthError(403, "FORBIDDEN", "Role Anda tidak memiliki akses untuk aksi ini.")
        return admin

    return dependency


@app.get("/api/health")
async def health() -> JSONResponse:
    """Public health check endpoint returning service status, version, and release identifier."""
    return success_response({"status": "ok", "version": APP_VERSION, "release_id": config.RELEASE_ID})


# Include modular route slices
app.include_router(build_lookup_router(read_json, enforce_rate_limit, client_ip))
app.include_router(
    build_auth_router(
        require_admin,
        read_json,
        enforce_rate_limit,
        client_ip,
        session_token,
        current_admin,
        authenticate_admin=lambda email, pwd: authenticate_admin(email, pwd),
    )
)
app.include_router(build_billing_router(require_admin, read_json, parse_limit, parse_offset))
app.include_router(build_student_router(require_admin, read_json, parse_limit))
app.include_router(build_report_router(require_admin, parse_limit))
app.include_router(build_master_data_router(require_admin, read_json))
app.include_router(build_import_router(require_admin, read_json, enforce_rate_limit))


@app.get("/admin", include_in_schema=False, response_model=None)
@app.get("/admin/", include_in_schema=False, response_model=None)
async def admin_page(request: Request) -> FileResponse | RedirectResponse | JSONResponse:
    """Serve the compiled React admin single-page application entry point."""
    if request.url.query:
        return RedirectResponse(url="/admin", status_code=303)
    admin_dist_index = config.FRONTEND_DIR / "admin-dist" / "index.html"
    if admin_dist_index.exists():
        return FileResponse(admin_dist_index)
    return error_response(
        503,
        "ADMIN_BUNDLE_UNAVAILABLE",
        "Bundle admin belum tersedia. Jalankan build Frontend-Admin sebelum membuka dashboard.",
    )


@app.get("/{full_path:path}", include_in_schema=False, response_model=None)
async def frontend(full_path: str) -> FileResponse | JSONResponse:
    """Serve public static frontend assets or fallback to index.html for client-side routing."""
    if full_path.startswith("api/"):
        return error_response(404, "NOT_FOUND", "Endpoint tidak ditemukan.")

    if full_path.startswith("admin/"):
        sub_path = full_path[len("admin/") :]
        admin_dist_root = (config.FRONTEND_DIR / "admin-dist").resolve()
        if (admin_dist_root / "index.html").is_file():
            admin_dist_file = (admin_dist_root / sub_path).resolve()
            try:
                admin_dist_file.relative_to(admin_dist_root)
                if admin_dist_file.exists() and admin_dist_file.is_file():
                    return FileResponse(admin_dist_file)
            except ValueError:
                pass
            return FileResponse(admin_dist_root / "index.html")
        return error_response(
            503,
            "ADMIN_BUNDLE_UNAVAILABLE",
            "Bundle admin belum tersedia. Jalankan build Frontend-Admin sebelum membuka dashboard.",
        )

    requested = full_path or "index.html"
    file_path = (config.FRONTEND_DIR / requested).resolve()
    frontend_root = config.FRONTEND_DIR.resolve()
    try:
        file_path.relative_to(frontend_root)
    except ValueError:
        file_path = frontend_root / "index.html"
    if not file_path.exists() or file_path.is_dir():
        file_path = frontend_root / "index.html"
    return FileResponse(file_path)
