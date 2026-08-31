"""Admin user management routes.

This module provides endpoints for super administrators to manage user accounts,
assign roles, update activation status, reset credentials, and delete administrators.
Protected by RBAC capability: 'manage_users'.
"""

from __future__ import annotations

import sqlite3
from collections.abc import Awaitable, Callable
from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from Backend.app import config
from Backend.app.responses import error_response, success_response
from Backend.app.services.users import (
    create_admin_user,
    delete_admin_user,
    get_admin_user,
    list_admin_users,
    reset_admin_password,
    update_admin_user,
)

AdminDependencyFactory = Callable[[str | None], Callable[[Request], sqlite3.Row]]
JsonReader = Callable[[Request], Awaitable[dict[str, Any]]]


def build_user_router(
    require_admin: AdminDependencyFactory,
    read_json: JsonReader,
) -> APIRouter:
    """Build admin user management routes requiring 'manage_users' capability."""
    router = APIRouter()

    @router.get("/api/admin/users")
    async def admin_list_users(
        admin: sqlite3.Row = Depends(require_admin("manage_users")),
    ) -> JSONResponse:
        """List all administrator accounts."""
        return success_response({"users": list_admin_users(config.DB_PATH)})

    @router.post("/api/admin/users")
    async def admin_create_user(
        request: Request,
        admin: sqlite3.Row = Depends(require_admin("manage_users")),
    ) -> JSONResponse:
        """Create a new administrator account."""
        payload = await read_json(request)
        try:
            user = create_admin_user(config.DB_PATH, payload, actor_id=admin["id"])
        except ValueError as exc:
            return error_response(400, "VALIDATION_ERROR", str(exc))

        return success_response({"user": user})

    @router.get("/api/admin/users/{user_id}")
    async def admin_get_user(
        user_id: str,
        admin: sqlite3.Row = Depends(require_admin("manage_users")),
    ) -> JSONResponse:
        """Retrieve administrator account detail by ID."""
        user = get_admin_user(config.DB_PATH, user_id)
        if not user:
            return error_response(404, "NOT_FOUND", "Admin tidak ditemukan.")
        return success_response({"user": user})

    @router.patch("/api/admin/users/{user_id}")
    async def admin_update_user(
        user_id: str,
        request: Request,
        admin: sqlite3.Row = Depends(require_admin("manage_users")),
    ) -> JSONResponse:
        """Update administrator profile, role, or active status."""
        payload = await read_json(request)
        try:
            user = update_admin_user(config.DB_PATH, user_id, payload, actor_id=admin["id"])
        except ValueError as exc:
            return error_response(400, "VALIDATION_ERROR", str(exc))

        return success_response({"user": user})

    @router.delete("/api/admin/users/{user_id}")
    async def admin_delete_user(
        user_id: str,
        admin: sqlite3.Row = Depends(require_admin("manage_users")),
    ) -> JSONResponse:
        """Delete an administrator account."""
        try:
            deleted = delete_admin_user(config.DB_PATH, user_id, actor_id=admin["id"])
        except ValueError as exc:
            return error_response(400, "VALIDATION_ERROR", str(exc))

        if not deleted:
            return error_response(404, "NOT_FOUND", "Admin tidak ditemukan.")
        return success_response({"deleted": True})

    @router.post("/api/admin/users/{user_id}/reset-password")
    async def admin_reset_user_password(
        user_id: str,
        request: Request,
        admin: sqlite3.Row = Depends(require_admin("manage_users")),
    ) -> JSONResponse:
        """Explicitly reset an administrator password and invalidate existing sessions."""
        payload = await read_json(request)
        password = str(payload.get("password") or "")
        try:
            reset = reset_admin_password(config.DB_PATH, user_id, password, actor_id=admin["id"])
        except ValueError as exc:
            return error_response(400, "VALIDATION_ERROR", str(exc))

        if not reset:
            return error_response(404, "NOT_FOUND", "Admin tidak ditemukan.")
        return success_response({"reset": True})

    return router
