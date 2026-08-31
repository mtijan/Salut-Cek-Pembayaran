"""Admin authentication and session management routes.

This module provides endpoints for administrator authentication, session creation,
current admin profile retrieval with granular RBAC permissions, and session revocation.
It enforces rate limiting prior to password verification to mitigate brute-force attacks.
"""

from __future__ import annotations

import sqlite3
from collections.abc import Awaitable, Callable
from typing import Protocol

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from Backend.app import config
from Backend.app.responses import error_response, success_response
from Backend.app.security import cookie_header
from Backend.app.services import (
    authenticate_admin as default_authenticate_admin,
    create_admin_session,
    delete_admin_session,
)


class AdminDependencyFactory(Protocol):
    """Protocol for admin capability authorization dependency factory."""

    def __call__(self, permission: str | None = None) -> Callable[[Request], sqlite3.Row]: ...


# Type definitions for injected dependencies
JsonReader = Callable[[Request], Awaitable[dict[str, object]]]
RateLimitChecker = Callable[[str, str, int, int], int | None]
ClientIpGetter = Callable[[Request], str]
SessionTokenGetter = Callable[[Request], str | None]
CurrentAdminGetter = Callable[[Request], sqlite3.Row | None]
AdminAuthenticator = Callable[[str, str], sqlite3.Row | None]


def build_auth_router(
    require_admin: AdminDependencyFactory,
    read_json: JsonReader,
    enforce_rate_limit: RateLimitChecker,
    client_ip: ClientIpGetter,
    session_token: SessionTokenGetter,
    current_admin: CurrentAdminGetter,
    authenticate_admin: AdminAuthenticator = default_authenticate_admin,
) -> APIRouter:
    """Build admin authentication routes with injected security dependencies."""
    router = APIRouter()

    @router.post("/api/admin/login")
    async def admin_login(request: Request) -> JSONResponse:
        """Authenticate admin user and establish HTTP-only secure session cookie."""
        payload = await read_json(request)
        email = str(payload.get("email") or "").strip().casefold()
        password = str(payload.get("password") or "")
        if not email or not password:
            return error_response(400, "VALIDATION_ERROR", "Email dan password wajib diisi.")

        # Rate limit based on client IP and target email (5 attempts per 15 min)
        # Checked before password hashing to prevent brute force and resource exhaustion
        retry_after = enforce_rate_limit("login", f"{client_ip(request)}:{email}", 5, 15 * 60)
        if retry_after:
            return error_response(
                429,
                "RATE_LIMITED",
                "Terlalu banyak percobaan login. Coba lagi nanti.",
                {"Retry-After": str(retry_after)},
            )

        admin = authenticate_admin(email, password)
        if not admin:
            return error_response(401, "UNAUTHORIZED", "Email atau password tidak sesuai.")

        token = create_admin_session(admin)
        return success_response(
            {
                "email": admin["email"],
                "full_name": admin["full_name"],
                "role": admin["role"],
                "permissions": sorted(config.ROLE_PERMISSIONS.get(admin["role"], set())),
            },
            headers={"Set-Cookie": cookie_header(token, config.SESSION_TTL_HOURS * 60 * 60)},
        )

    @router.get("/api/admin/me")
    async def admin_me(admin: sqlite3.Row = Depends(require_admin())) -> JSONResponse:
        """Retrieve current authenticated admin profile and RBAC capability list."""
        return success_response(
            {
                "email": admin["email"],
                "full_name": admin["full_name"],
                "role": admin["role"],
                "permissions": sorted(config.ROLE_PERMISSIONS.get(admin["role"], set())),
            }
        )

    @router.post("/api/admin/logout")
    async def admin_logout(request: Request) -> JSONResponse:
        """Revoke current admin session and clear session cookie."""
        admin = current_admin(request)
        delete_admin_session(session_token(request), admin)
        return success_response(headers={"Set-Cookie": cookie_header("", 0)})

    return router
