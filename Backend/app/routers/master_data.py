"""Admin study-program, academic-period, and master-data template routes."""

from __future__ import annotations

import sqlite3
from collections.abc import Awaitable, Callable

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse

from Backend.app import config
from Backend.app.responses import error_response, success_response
from Backend.app.services import (
    create_academic_period,
    create_study_program,
    delete_study_program,
    list_academic_periods,
    list_study_programs,
    update_academic_period,
    update_study_program,
)
from Backend.import_excel import generate_master_data_template


AdminDependencyFactory = Callable[[str | None], Callable[[Request], sqlite3.Row]]
JsonReader = Callable[[Request], Awaitable[dict[str, object]]]


def build_master_data_router(require_admin: AdminDependencyFactory, read_json: JsonReader) -> APIRouter:
    """Build master-data routes while auth and JSON parsing stay at the composition root."""

    router = APIRouter()

    @router.get("/api/admin/study-programs")
    async def admin_study_programs(
        admin: sqlite3.Row = Depends(require_admin("view_master_data")),
    ) -> JSONResponse:
        return success_response({"study_programs": list_study_programs(config.DB_PATH)})

    @router.post("/api/admin/study-programs")
    async def admin_create_study_program(
        request: Request, admin: sqlite3.Row = Depends(require_admin("manage_master_data"))
    ) -> JSONResponse:
        payload = await read_json(request)
        try:
            program = create_study_program(config.DB_PATH, payload, actor_id=admin["id"])
        except ValueError as exc:
            return error_response(400, "VALIDATION_ERROR", str(exc))

        return success_response({"study_program": program})

    @router.patch("/api/admin/study-programs/{program_id}")
    async def admin_update_study_program(
        program_id: str, request: Request, admin: sqlite3.Row = Depends(require_admin("manage_master_data"))
    ) -> JSONResponse:
        payload = await read_json(request)
        try:
            program = update_study_program(config.DB_PATH, program_id, payload, actor_id=admin["id"])
        except ValueError as exc:
            return error_response(400, "VALIDATION_ERROR", str(exc))
        if not program:
            return error_response(404, "NOT_FOUND", "Program studi tidak ditemukan.")

        return success_response({"study_program": program})

    @router.delete("/api/admin/study-programs/{program_id}")
    async def admin_delete_study_program(
        program_id: str, admin: sqlite3.Row = Depends(require_admin("manage_master_data"))
    ) -> JSONResponse:
        deleted = delete_study_program(config.DB_PATH, program_id, actor_id=admin["id"])
        if not deleted:
            return error_response(404, "NOT_FOUND", "Program studi tidak ditemukan.")

        return success_response({"deleted": True})

    @router.get("/api/admin/academic-periods")
    async def admin_academic_periods(
        admin: sqlite3.Row = Depends(require_admin("view_master_data")),
    ) -> JSONResponse:
        return success_response({"academic_periods": list_academic_periods(config.DB_PATH)})

    @router.post("/api/admin/academic-periods")
    async def admin_create_academic_period(
        request: Request, admin: sqlite3.Row = Depends(require_admin("manage_master_data"))
    ) -> JSONResponse:
        payload = await read_json(request)
        try:
            period = create_academic_period(config.DB_PATH, payload, actor_id=admin["id"])
        except ValueError as exc:
            return error_response(400, "VALIDATION_ERROR", str(exc))

        return success_response({"academic_period": period})

    @router.patch("/api/admin/academic-periods/{period_id}")
    async def admin_update_academic_period(
        period_id: str, request: Request, admin: sqlite3.Row = Depends(require_admin("manage_master_data"))
    ) -> JSONResponse:
        payload = await read_json(request)
        try:
            period = update_academic_period(config.DB_PATH, period_id, payload, actor_id=admin["id"])
        except ValueError as exc:
            return error_response(400, "VALIDATION_ERROR", str(exc))
        if not period:
            return error_response(404, "NOT_FOUND", "Periode akademik tidak ditemukan.")

        return success_response({"academic_period": period})

    @router.get("/api/admin/template/master-data")
    async def admin_download_master_data_template(
        admin: sqlite3.Row = Depends(require_admin("view_master_data")),
    ) -> Response:
        content = generate_master_data_template()
        return Response(
            content=content,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": 'attachment; filename="Template_Master_Data_Mahasiswa.xlsx"'},
        )

    return router
