"""Admin billing, payment history, and imported-file routes."""

from __future__ import annotations

import sqlite3
from collections.abc import Awaitable, Callable
from typing import Protocol

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from Backend.app import config
from Backend.app.responses import error_response, success_response
from Backend.app.services import (
    bill_row_to_dict,
    create_bill,
    delete_bill,
    delete_imported_bill_group,
    get_bill_detail,
    get_bills_summary,
    list_bills,
    list_imported_bill_groups,
    list_payment_transactions,
    payment_transaction_target_exists,
    record_bill_payment,
    update_bill,
    update_bill_due_date,
    update_bill_status,
)


AdminDependencyFactory = Callable[[str | None], Callable[[Request], sqlite3.Row]]
JsonReader = Callable[[Request], Awaitable[dict[str, object]]]
OffsetParser = Callable[[Request], int]


class LimitParser(Protocol):
    def __call__(self, request: Request, default: int = 2000, max_limit: int = 5000) -> int: ...


def build_billing_router(
    require_admin: AdminDependencyFactory,
    read_json: JsonReader,
    parse_limit: LimitParser,
    parse_offset: OffsetParser,
) -> APIRouter:
    """Build billing routes while auth and request parsing stay at composition root."""

    router = APIRouter()

    @router.get("/api/admin/imported-bills")
    async def admin_imported_bills(admin: sqlite3.Row = Depends(require_admin("view_imports"))) -> JSONResponse:
        return success_response({"groups": list_imported_bill_groups(config.DB_PATH)})

    @router.delete("/api/admin/imported-files")
    async def admin_delete_imported_file(
        request: Request, admin: sqlite3.Row = Depends(require_admin("import"))
    ) -> JSONResponse:
        payload = await read_json(request)
        file_name = str(payload.get("file_name") or "").strip()
        reason = str(payload.get("reason") or "").strip()
        try:
            deleted = delete_imported_bill_group(config.DB_PATH, file_name, actor_id=admin["id"], reason=reason)
        except ValueError as exc:
            return error_response(400, "VALIDATION_ERROR", str(exc))
        if not deleted:
            return error_response(404, "NOT_FOUND", "File import tidak ditemukan.")

        return success_response(deleted)

    @router.post("/api/admin/bills/status")
    async def admin_bill_status(
        request: Request, admin: sqlite3.Row = Depends(require_admin("manage_billing"))
    ) -> JSONResponse:
        payload = await read_json(request)
        bill_id = str(payload.get("bill_id") or "").strip()
        status = str(payload.get("status") or "").strip().lower()
        paid_amount = payload.get("paid_amount")
        payment_date = payload.get("payment_date")
        reference_number = payload.get("reference_number")
        notes = payload.get("notes")
        if not bill_id:
            return error_response(400, "VALIDATION_ERROR", "ID tagihan wajib diisi.")
        try:
            updated = update_bill_status(
                config.DB_PATH,
                bill_id,
                status,
                paid_amount=paid_amount,
                recorded_by=admin["id"],
                payment_date=payment_date,
                reference_number=reference_number,
                notes=notes,
            )
        except ValueError as exc:
            return error_response(400, "VALIDATION_ERROR", str(exc))
        if not updated:
            return error_response(404, "NOT_FOUND", "Tagihan tidak ditemukan.")

        return success_response({"bill": bill_row_to_dict(updated)})

    @router.post("/api/admin/bills/due-date")
    async def admin_bill_due_date(
        request: Request, admin: sqlite3.Row = Depends(require_admin("manage_billing"))
    ) -> JSONResponse:
        payload = await read_json(request)
        bill_ids = payload.get("bill_ids")
        single_bill_id = str(payload.get("bill_id") or "").strip()
        if isinstance(bill_ids, list):
            target_ids = [str(i).strip() for i in bill_ids if str(i).strip()]
        elif single_bill_id:
            target_ids = [single_bill_id]
        else:
            target_ids = []

        due_date = payload.get("due_date")
        if not target_ids:
            return error_response(400, "VALIDATION_ERROR", "ID tagihan wajib diisi.")
        try:
            updated_rows = update_bill_due_date(
                config.DB_PATH, target_ids, str(due_date) if due_date else "", actor_id=admin["id"]
            )
        except ValueError as exc:
            return error_response(400, "VALIDATION_ERROR", str(exc))
        if not updated_rows:
            return error_response(404, "NOT_FOUND", "Tagihan tidak ditemukan.")

        return success_response(
            {
                "updated_count": len(updated_rows),
                "bills": [bill_row_to_dict(row) for row in updated_rows],
            }
        )

    @router.get("/api/admin/bills")
    async def admin_bills(
        request: Request, admin: sqlite3.Row = Depends(require_admin("view_billing"))
    ) -> JSONResponse:
        query = str(request.query_params.get("query") or "")
        status = str(request.query_params.get("status") or "").strip().lower()
        source = str(request.query_params.get("source") or "").strip().lower()
        study_program_id = str(
            request.query_params.get("study_program_id") or request.query_params.get("prodi") or ""
        ).strip()
        period = str(request.query_params.get("period") or "").strip()
        bill_type = str(request.query_params.get("bill_type") or "").strip()
        sort_by = str(request.query_params.get("sort_by") or "").strip()
        entry_period = str(request.query_params.get("entry_period") or "").strip()

        if status not in {"", "paid", "partial", "unpaid"}:
            return error_response(400, "VALIDATION_ERROR", "Filter status tidak valid.")
        if source not in {"", "import", "manual"}:
            return error_response(400, "VALIDATION_ERROR", "Filter sumber tidak valid.")
        try:
            limit = parse_limit(request, default=100, max_limit=100)
            offset = parse_offset(request)
        except ValueError as exc:
            return error_response(400, "VALIDATION_ERROR", str(exc))

        summary = get_bills_summary(
            config.DB_PATH,
            query=query,
            status=status,
            source=source,
            study_program_id=study_program_id,
            period=period,
            bill_type=bill_type,
            entry_period=entry_period,
        )
        total = summary["total_count"]
        page = (offset // limit) + 1 if limit > 0 else 1
        total_pages = max(1, (total + limit - 1) // limit) if limit > 0 else 1
        return success_response(
            {
                "bills": list_bills(
                    config.DB_PATH,
                    query=query,
                    limit=limit,
                    offset=offset,
                    status=status,
                    source=source,
                    study_program_id=study_program_id,
                    period=period,
                    bill_type=bill_type,
                    sort_by=sort_by,
                    entry_period=entry_period,
                ),
                "pagination": {
                    "total": total,
                    "limit": limit,
                    "offset": offset,
                    "page": page,
                    "total_pages": total_pages,
                },
                "summary": summary,
            }
        )

    @router.post("/api/admin/bills")
    async def admin_create_bill(
        request: Request, admin: sqlite3.Row = Depends(require_admin("manage_billing"))
    ) -> JSONResponse:
        payload = await read_json(request)
        try:
            bill = create_bill(config.DB_PATH, payload, actor_id=admin["id"])
        except ValueError as exc:
            return error_response(400, "VALIDATION_ERROR", str(exc))

        return success_response({"bill": bill_row_to_dict(bill)})

    @router.get("/api/admin/bills/{bill_id}")
    async def admin_bill_detail(
        bill_id: str, admin: sqlite3.Row = Depends(require_admin("view_billing"))
    ) -> JSONResponse:
        detail = get_bill_detail(config.DB_PATH, bill_id)
        if not detail:
            return error_response(404, "NOT_FOUND", "Tagihan tidak ditemukan.")
        return success_response(detail)

    @router.post("/api/admin/bills/{bill_id}/payments")
    async def admin_record_bill_payment(
        bill_id: str, request: Request, admin: sqlite3.Row = Depends(require_admin("manage_billing"))
    ) -> JSONResponse:
        payload = await read_json(request)
        try:
            result = record_bill_payment(config.DB_PATH, bill_id, payload, actor_id=admin["id"])
        except ValueError as exc:
            return error_response(400, "VALIDATION_ERROR", str(exc))

        return success_response(result)

    @router.patch("/api/admin/bills/{bill_id}")
    async def admin_update_bill(
        bill_id: str, request: Request, admin: sqlite3.Row = Depends(require_admin("manage_billing"))
    ) -> JSONResponse:
        payload = await read_json(request)
        try:
            bill = update_bill(config.DB_PATH, bill_id, payload, actor_id=admin["id"])
        except ValueError as exc:
            return error_response(400, "VALIDATION_ERROR", str(exc))
        if not bill:
            return error_response(404, "NOT_FOUND", "Tagihan tidak ditemukan.")

        return success_response({"bill": bill_row_to_dict(bill)})

    @router.get("/api/admin/bills/{bill_id}/transactions")
    async def admin_bill_transactions(
        bill_id: str, request: Request, admin: sqlite3.Row = Depends(require_admin("view_billing"))
    ) -> JSONResponse:
        try:
            limit = parse_limit(request, default=50, max_limit=200)
            offset = parse_offset(request)
        except ValueError as exc:
            return error_response(400, "VALIDATION_ERROR", str(exc))
        if not payment_transaction_target_exists(config.DB_PATH, bill_id=bill_id):
            return error_response(404, "NOT_FOUND", "Tagihan tidak ditemukan.")
        data = list_payment_transactions(config.DB_PATH, bill_id=bill_id, limit=limit, offset=offset)
        return success_response(data)

    @router.get("/api/admin/students/{student_id}/transactions")
    async def admin_student_transactions(
        student_id: str, request: Request, admin: sqlite3.Row = Depends(require_admin("view_billing"))
    ) -> JSONResponse:
        try:
            limit = parse_limit(request, default=50, max_limit=200)
            offset = parse_offset(request)
        except ValueError as exc:
            return error_response(400, "VALIDATION_ERROR", str(exc))
        if not payment_transaction_target_exists(config.DB_PATH, student_id=student_id):
            return error_response(404, "NOT_FOUND", "Mahasiswa tidak ditemukan.")
        data = list_payment_transactions(config.DB_PATH, student_id=student_id, limit=limit, offset=offset)
        return success_response(data)

    @router.delete("/api/admin/bills/{bill_id}")
    async def admin_delete_bill(
        bill_id: str, request: Request, admin: sqlite3.Row = Depends(require_admin("manage_billing"))
    ) -> JSONResponse:
        reason = str(request.query_params.get("reason") or "").strip()
        if not reason:
            payload = await read_json(request)
            reason = str(payload.get("reason") or "").strip()
        try:
            bill = delete_bill(config.DB_PATH, bill_id, actor_id=admin["id"], reason=reason)
        except ValueError as exc:
            return error_response(400, "VALIDATION_ERROR", str(exc))
        if not bill:
            return error_response(404, "NOT_FOUND", "Tagihan tidak ditemukan.")

        return success_response({"deleted": True, "bill": bill_row_to_dict(bill)})

    return router
