"""Read-only administrative audit-log routes."""

from __future__ import annotations

import sqlite3
from collections.abc import Callable

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from Backend.app import config
from Backend.app.responses import error_response, success_response
from Backend.app.services.audit import list_audit_logs

AdminDependencyFactory = Callable[[str | None], Callable[[Request], sqlite3.Row]]
LimitParser = Callable[[Request, int, int], int]
OffsetParser = Callable[[Request], int]


def build_audit_router(
    require_admin: AdminDependencyFactory,
    parse_limit: LimitParser,
    parse_offset: OffsetParser,
) -> APIRouter:
    """Build the audit viewer route protected by the dedicated capability."""
    router = APIRouter()

    @router.get("/api/admin/audit-logs")
    async def admin_list_audit_logs(
        request: Request,
        admin: sqlite3.Row = Depends(require_admin("view_audit_logs")),
    ) -> JSONResponse:
        """List redacted, immutable audit entries for authorized administrators."""
        try:
            result = list_audit_logs(
                config.DB_PATH,
                action=request.query_params.get("action", "").strip(),
                entity_type=request.query_params.get("entity_type", "").strip(),
                actor_id=request.query_params.get("actor_id", "").strip(),
                limit=parse_limit(request, 50, 200),
                offset=parse_offset(request),
            )
        except ValueError as exc:
            return error_response(400, "VALIDATION_ERROR", str(exc))
        return success_response(result)

    return router
