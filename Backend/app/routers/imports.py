"""Admin Excel import preview and commit routes."""

from __future__ import annotations

import logging
import re
import sqlite3
import uuid
from collections.abc import Awaitable, Callable
from pathlib import Path

from fastapi import APIRouter, Depends, File, Request, UploadFile
from fastapi.responses import JSONResponse

from Backend.app import config
from Backend.app.responses import error_response, success_response
from Backend.app.services import (
    cleanup_stale_imports,
    delete_import_preview,
    get_import_preview_for_admin,
    sanitize_filename,
    store_import_preview,
    write_audit,
)
from Backend.db import connect
from Backend.import_excel import import_workbook, preview_workbook


logger = logging.getLogger(__name__)

AdminDependencyFactory = Callable[[str | None], Callable[[Request], sqlite3.Row]]
JsonReader = Callable[[Request], Awaitable[dict[str, object]]]
RateLimitChecker = Callable[[str, str, int, int], int | None]


def build_import_router(
    require_admin: AdminDependencyFactory,
    read_json: JsonReader,
    enforce_rate_limit: RateLimitChecker,
) -> APIRouter:
    """Build the import router while keeping auth dependencies at composition root."""

    router = APIRouter()

    @router.post("/api/admin/import/preview")
    async def admin_import_preview(
        request: Request,
        file: UploadFile = File(...),
        admin: sqlite3.Row = Depends(require_admin("import")),
    ) -> JSONResponse:
        retry_after = enforce_rate_limit("import_preview", admin["id"], 20, 60 * 60)
        if retry_after:
            return error_response(
                429, "RATE_LIMITED", "Terlalu banyak permintaan. Coba lagi nanti.", {"Retry-After": str(retry_after)}
            )

        saved_path: Path | None = None
        try:
            if not (file.filename or "").lower().endswith(".xlsx"):
                raise ValueError("File harus berformat .xlsx.")

            config.IMPORT_DIR.mkdir(parents=True, exist_ok=True)
            cleanup_stale_imports()
            import_token = f"imp_{uuid.uuid4().hex}"
            safe_name = sanitize_filename(file.filename or "import.xlsx")
            saved_path = config.IMPORT_DIR / f"{import_token}_{safe_name}"
            size = 0
            with saved_path.open("wb") as target:
                while chunk := await file.read(1024 * 1024):
                    size += len(chunk)
                    if size > config.MAX_UPLOAD_BYTES:
                        raise ValueError("Ukuran file maksimal 5 MB.")
                    target.write(chunk)

            preview = preview_workbook(saved_path, config.DB_PATH, source_file_name=safe_name)
            store_import_preview(import_token, admin["id"], safe_name, saved_path)
            conn = connect(config.DB_PATH)
            try:
                with conn:
                    write_audit(
                        conn,
                        admin["id"],
                        "import.preview",
                        "excel_import",
                        import_token,
                        {
                            "file_name": safe_name,
                            "valid_rows": preview["valid_rows"],
                            "critical_rows": preview["critical_rows"],
                            "issue_rows": preview["issue_rows"],
                            "new_rows": preview["new_rows"],
                            "update_rows": preview["update_rows"],
                            "unchanged_rows": preview["unchanged_rows"],
                            "amount_change_rows": preview["amount_change_rows"],
                            "briva_change_rows": preview["briva_change_rows"],
                        },
                    )
            finally:
                conn.close()
            return success_response({"import_token": import_token, "file_name": safe_name, **preview})
        except Exception as exc:
            if not isinstance(exc, ValueError):
                logger.exception("Unexpected failure while previewing import")
            if saved_path:
                saved_path.unlink(missing_ok=True)
            message = (
                str(exc)
                if isinstance(exc, ValueError)
                else "File tidak dapat diproses. Gunakan workbook Excel yang valid."
            )
            return error_response(400, "IMPORT_PREVIEW_FAILED", message)
        finally:
            await file.close()

    @router.post("/api/admin/import/commit")
    async def admin_import_commit(
        request: Request, admin: sqlite3.Row = Depends(require_admin("import"))
    ) -> JSONResponse:
        retry_after = enforce_rate_limit("import_commit", admin["id"], 10, 60 * 60)
        if retry_after:
            return error_response(
                429, "RATE_LIMITED", "Terlalu banyak permintaan. Coba lagi nanti.", {"Retry-After": str(retry_after)}
            )

        payload = await read_json(request)
        import_token = str(payload.get("import_token") or payload.get("token") or "")
        confirm_updates = payload.get("confirm_updates") is True
        if not re.fullmatch(r"imp_[0-9a-f]{32}", import_token):
            return error_response(400, "VALIDATION_ERROR", "Token import tidak valid.")

        preview_record = get_import_preview_for_admin(import_token, admin)
        if not preview_record:
            return error_response(404, "NOT_FOUND", "File preview import tidak ditemukan.")

        workbook = Path(str(preview_record["stored_path"])).resolve()
        import_root = config.IMPORT_DIR.resolve()
        try:
            workbook.relative_to(import_root)
        except ValueError:
            delete_import_preview(import_token)
            return error_response(400, "VALIDATION_ERROR", "Token import tidak valid.")

        if not workbook.exists():
            delete_import_preview(import_token)
            return error_response(404, "NOT_FOUND", "File preview import tidak ditemukan.")

        try:
            source_file_name = str(preview_record["file_name"])
            preview = preview_workbook(workbook, config.DB_PATH, source_file_name=source_file_name)
            if preview["critical_rows"]:
                workbook.unlink(missing_ok=True)
                delete_import_preview(import_token)
                return error_response(
                    400,
                    "IMPORT_VALIDATION_FAILED",
                    "Import dibatalkan karena ada baris kritis pada sheet Data Sinkron.",
                )
            if preview["requires_update_confirmation"] and not confirm_updates:
                return error_response(
                    409,
                    "IMPORT_CONFIRMATION_REQUIRED",
                    "Perubahan nominal atau BRIVA harus dikonfirmasi admin sebelum import disimpan.",
                )
            result = import_workbook(
                workbook,
                config.DB_PATH,
                source_file_name=source_file_name,
                confirm_updates=confirm_updates,
                actor_id=admin["id"],
            )
            workbook.unlink(missing_ok=True)
            delete_import_preview(import_token)
            return success_response(result)
        except ValueError as exc:
            return error_response(400, "IMPORT_VALIDATION_FAILED", str(exc))
        except Exception:
            logger.exception("Unexpected failure while committing import token %s", import_token)
            return error_response(
                400, "IMPORT_COMMIT_FAILED", "Import tidak dapat disimpan. Periksa file dan coba lagi."
            )

    return router
