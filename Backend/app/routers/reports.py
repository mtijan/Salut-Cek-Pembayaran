"""Admin reporting, dashboard statistics, and import issue routes.

This module provides endpoints for calculating high-level dashboard metrics,
generating financial summary reports partitioned by study program and entry period,
and viewing recorded workbook import validation issues.
"""

from __future__ import annotations

import sqlite3
from collections.abc import Callable
from typing import Protocol

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from Backend.app import config
from Backend.app.responses import error_response, success_response
from Backend.app.services import list_import_issues
from Backend.app.use_cases.reporting import ReportingService

# Type definitions for injected dependencies
AdminDependencyFactory = Callable[[str | None], Callable[[Request], sqlite3.Row]]


class LimitParser(Protocol):
    """Protocol for request pagination limit parser."""

    def __call__(self, request: Request, default: int = 2000, max_limit: int = 5000) -> int: ...


def build_report_router(
    require_admin: AdminDependencyFactory,
    parse_limit: LimitParser,
) -> APIRouter:
    """Build admin reporting routes."""
    router = APIRouter()

    @router.get("/api/admin/dashboard/stats")
    async def admin_dashboard_stats(admin: sqlite3.Row = Depends(require_admin("view_reports"))) -> JSONResponse:
        """Calculate overall dashboard statistics (total students, bills, receipts, outstanding)."""
        return success_response(ReportingService(config.DB_PATH).dashboard_stats())

    @router.get("/api/admin/reports/financial-summary")
    async def admin_financial_summary(
        request: Request, admin: sqlite3.Row = Depends(require_admin("view_reports"))
    ) -> JSONResponse:
        """Generate financial summary report aggregated by study program and billing period."""
        period = str(request.query_params.get("period") or "").strip()
        study_program_id = str(request.query_params.get("study_program_id") or "").strip()
        entry_period = str(request.query_params.get("entry_period") or "").strip()
        return success_response(
            ReportingService(config.DB_PATH).financial_summary(
                period=period,
                study_program_id=study_program_id,
                entry_period=entry_period,
            )
        )

    @router.get("/api/admin/import-issues")
    async def admin_import_issues(
        request: Request, admin: sqlite3.Row = Depends(require_admin("view_imports"))
    ) -> JSONResponse:
        """List validation and processing issues logged during Excel imports."""
        try:
            limit = parse_limit(request, default=500, max_limit=2000)
        except ValueError as exc:
            return error_response(400, "VALIDATION_ERROR", str(exc))
        return success_response({"issues": list_import_issues(config.DB_PATH, limit)})

    return router
