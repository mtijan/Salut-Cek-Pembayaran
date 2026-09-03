"""Admin student management and Student 360 profile routes.

This module provides endpoints for listing students with multi-criteria filtering,
fetching complete Student 360 biographical and billing details, and performing
student profile mutations (creation, updates, and soft deletion) with audit logging.
"""

from __future__ import annotations

import sqlite3
from collections.abc import Awaitable, Callable
from typing import Protocol

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from Backend.app import config
from Backend.app.responses import error_response, success_response
from Backend.app.services import (
    create_student,
    delete_student,
    get_student_detail,
    list_students,
    student_row_to_dict,
    update_student,
)

# Type definitions for injected dependencies
AdminDependencyFactory = Callable[[str | None], Callable[[Request], sqlite3.Row]]
JsonReader = Callable[[Request], Awaitable[dict[str, object]]]
OffsetParser = Callable[[Request], int]


class LimitParser(Protocol):
    """Protocol for request pagination limit parser."""

    def __call__(self, request: Request, default: int = 2000, max_limit: int = 5000) -> int: ...


def build_student_router(
    require_admin: AdminDependencyFactory,
    read_json: JsonReader,
    parse_limit: LimitParser,
    parse_offset: OffsetParser | None = None,
) -> APIRouter:
    """Build admin student management routes."""
    router = APIRouter()

    @router.get("/api/admin/students")
    async def admin_students(
        request: Request, admin: sqlite3.Row = Depends(require_admin("view_students"))
    ) -> JSONResponse:
        """List active students filtered by query, study program, academic status, or entry period."""
        query = str(request.query_params.get("query") or "")
        study_program_id = str(request.query_params.get("study_program_id") or request.query_params.get("prodi") or "")
        academic_status = str(request.query_params.get("academic_status") or "")
        entry_period = str(request.query_params.get("entry_period") or "")
        sort_by = str(request.query_params.get("sort_by") or "")
        raw_year = request.query_params.get("entry_year")
        entry_year = int(raw_year) if raw_year and raw_year.isdigit() else None
        try:
            limit = parse_limit(request, default=2000, max_limit=5000)
            offset = parse_offset(request) if parse_offset else 0
        except ValueError as exc:
            return error_response(400, "VALIDATION_ERROR", str(exc))
        return success_response(
            {
                "students": list_students(
                    config.DB_PATH,
                    query=query,
                    limit=limit,
                    offset=offset,
                    study_program_id=study_program_id,
                    academic_status=academic_status,
                    entry_year=entry_year,
                    entry_period=entry_period,
                    sort_by=sort_by,
                )
            }
        )

    @router.get("/api/admin/students/{student_id}/detail")
    async def admin_student_detail(
        student_id: str, admin: sqlite3.Row = Depends(require_admin("view_students"))
    ) -> JSONResponse:
        """Retrieve full Student 360 profile including demographic data and billing records."""
        detail = get_student_detail(config.DB_PATH, student_id)
        if not detail:
            return error_response(404, "NOT_FOUND", "Mahasiswa tidak ditemukan.")
        return success_response(detail)

    @router.post("/api/admin/students")
    async def admin_create_student(
        request: Request, admin: sqlite3.Row = Depends(require_admin("manage_students"))
    ) -> JSONResponse:
        """Create a new student profile or restore a previously soft-deleted student by NIM."""
        payload = await read_json(request)
        try:
            student = create_student(config.DB_PATH, payload=payload, actor_id=admin["id"])
        except ValueError as exc:
            return error_response(400, "VALIDATION_ERROR", str(exc))

        return success_response({"student": student_row_to_dict(student)})

    @router.patch("/api/admin/students/{student_id}")
    async def admin_update_student(
        student_id: str, request: Request, admin: sqlite3.Row = Depends(require_admin("manage_students"))
    ) -> JSONResponse:
        """Update student demographic and academic profile."""
        payload = await read_json(request)
        try:
            student = update_student(config.DB_PATH, student_id, payload, actor_id=admin["id"])
        except ValueError as exc:
            return error_response(400, "VALIDATION_ERROR", str(exc))
        if not student:
            return error_response(404, "NOT_FOUND", "Mahasiswa tidak ditemukan.")

        return success_response({"student": student_row_to_dict(student)})

    @router.delete("/api/admin/students/{student_id}")
    async def admin_delete_student(
        student_id: str, request: Request, admin: sqlite3.Row = Depends(require_admin("manage_students"))
    ) -> JSONResponse:
        """Soft-delete a student profile and record deletion audit trail."""
        reason = str(request.query_params.get("reason") or "").strip()
        if not reason:
            payload = await read_json(request)
            reason = str(payload.get("reason") or "").strip()
        try:
            student = delete_student(config.DB_PATH, student_id, actor_id=admin["id"], reason=reason)
        except ValueError as exc:
            return error_response(400, "VALIDATION_ERROR", str(exc))
        if not student:
            return error_response(404, "NOT_FOUND", "Mahasiswa tidak ditemukan.")

        return success_response({"deleted": True, "student": student_row_to_dict(student)})

    return router
