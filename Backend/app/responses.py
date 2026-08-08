from __future__ import annotations

import uuid

from fastapi.responses import JSONResponse


def request_id() -> str:
    return f"req_{uuid.uuid4().hex[:12]}"


def success_response(data: dict | None = None, status_code: int = 200, headers: dict[str, str] | None = None) -> JSONResponse:
    payload: dict[str, object] = {"success": True}
    if data is not None:
        payload["data"] = data
    return JSONResponse(payload, status_code=status_code, headers=headers)


def error_response(
    status_code: int,
    code: str,
    message: str,
    headers: dict[str, str] | None = None,
    req_id: str | None = None,
) -> JSONResponse:
    return JSONResponse(
        {
            "success": False,
            "error": {"code": code, "message": message},
            "request_id": req_id or request_id(),
        },
        status_code=status_code,
        headers=headers,
    )

