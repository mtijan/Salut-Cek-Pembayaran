"""Public student billing lookup route.

This module provides the public-facing endpoint for students to query their billing
information, tuition status, and BRIVA numbers using their Student ID (NIM).
It handles client IP resolution, rate limiting, NIM validation, logging, and response formatting.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from Backend.app import config
from Backend.app.responses import error_response, request_id
from Backend.app.services import (
    validate_nim_value,
    write_lookup_log,
)
from Backend.app.use_cases.lookup import LookupService

# Type definitions for injected dependencies
JsonReader = Callable[[Request], Awaitable[dict[str, object]]]
RateLimitChecker = Callable[[str, str, int, int], int | None]
ClientIpGetter = Callable[[Request], str]


def build_lookup_router(
    read_json: JsonReader,
    enforce_rate_limit: RateLimitChecker,
    client_ip: ClientIpGetter,
) -> APIRouter:
    """Build public student lookup routes."""
    router = APIRouter()

    @router.post("/api/lookup")
    async def lookup(request: Request) -> JSONResponse:
        """Lookup student billing records and payment summary by Student ID (NIM)."""
        req_id = request_id()
        payload = await read_json(request)

        # 1. Enforce rate limit (10 requests per 10 minutes per client IP)
        retry_after = enforce_rate_limit("lookup", client_ip(request), 10, 10 * 60)
        if retry_after:
            write_lookup_log("", "", "rate_limited")
            return error_response(
                429,
                "RATE_LIMITED",
                "Terlalu banyak permintaan. Coba lagi nanti.",
                {"Retry-After": str(retry_after)},
                req_id,
            )

        # 2. Validate input NIM format
        try:
            nim = validate_nim_value(payload.get("nim"))
        except ValueError as exc:
            write_lookup_log("", "", "invalid")
            return error_response(400, "VALIDATION_ERROR", str(exc), req_id=req_id)

        if not nim:
            write_lookup_log(nim, "", "invalid")
            return error_response(400, "VALIDATION_ERROR", "NIM wajib diisi.", req_id=req_id)

        # 3. Execute lookup use case with repository query
        result = LookupService(
            config.DB_PATH,
            default_program_study=config.DEFAULT_PROGRAM_STUDY,
            default_payment_period_label=config.DEFAULT_PAYMENT_PERIOD_LABEL,
        ).execute(nim)
        if result is None:
            write_lookup_log(nim, "", "not_found")
            return error_response(
                404, "NOT_FOUND", "Data tagihan tidak ditemukan. Pastikan NIM sesuai data SALUT.", req_id=req_id
            )
        write_lookup_log(nim, "", "found")

        return JSONResponse(
            {
                "success": True,
                "data": result,
                "request_id": req_id,
            }
        )

    return router
