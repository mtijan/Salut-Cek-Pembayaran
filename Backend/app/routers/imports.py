"""Admin Excel import preview and commit routes."""

from __future__ import annotations

import logging
import hashlib
import re
import sqlite3
import uuid
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any, cast

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from fastapi.responses import JSONResponse

from Backend.app import config
from Backend.app.responses import error_response, success_response
from Backend.app.services import (
    claim_import_preview_for_admin,
    cleanup_stale_imports,
    consume_import_preview_claim,
    delete_import_preview,
    get_import_preview_for_admin,
    list_import_preview_issues,
    release_import_preview_claim,
    sanitize_filename,
    store_import_preview,
    write_audit,
)
from Backend.db import connect
from Backend.import_excel import import_workbook, preview_workbook
from Backend.importing.workbook import build_billing_period


logger = logging.getLogger(__name__)

AdminDependencyFactory = Callable[[str | None], Callable[[Request], sqlite3.Row]]
JsonReader = Callable[[Request], Awaitable[dict[str, object]]]
RateLimitChecker = Callable[[str, str, int, int], int | None]


def _file_sha256(path: Path) -> str:
    """Return a stable digest used to bind a commit to its previewed workbook."""
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


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
        billing_year: str = Form(""),
        semester_type: str = Form(""),
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
            period = build_billing_period(billing_year, semester_type)

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

            file_sha256 = _file_sha256(saved_path)
            preview = preview_workbook(
                saved_path,
                config.DB_PATH,
                period=str(period["code"]),
                source_file_name=safe_name,
            )
            all_issues = sorted(
                cast(list[dict[str, object]], preview.get("issues") or []),
                key=lambda issue: (
                    0 if issue.get("severity") == "critical" else 1,
                    int(cast(Any, issue.get("row_number") or 0)),
                ),
            )
            store_import_preview(
                import_token,
                admin["id"],
                safe_name,
                saved_path,
                file_sha256=file_sha256,
                period_code=str(period["code"]),
                period_label=str(period["label"]),
                billing_year=int(cast(Any, period["billing_year"])),
                semester_type=str(period["semester_type"]),
                issues=all_issues,
            )
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
                            "period_code": period["code"],
                            "quarantined_rows": preview["quarantined_rows"],
                        },
                    )
            finally:
                conn.close()
            preview_response = dict(preview)
            preview_response["errors"] = all_issues[:50]
            preview_response["issues"] = all_issues[:50]
            preview_response["period"] = period
            preview_response["issue_pagination"] = {"page": 1, "limit": 50, "total": len(all_issues)}
            return success_response({"import_token": import_token, "file_name": safe_name, **preview_response})
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

    @router.get("/api/admin/import/previews/{import_token}/issues")
    async def admin_import_preview_issues(
        import_token: str,
        request: Request,
        admin: sqlite3.Row = Depends(require_admin("view_imports")),
    ) -> JSONResponse:
        if not re.fullmatch(r"imp_[0-9a-f]{32}", import_token):
            return error_response(400, "VALIDATION_ERROR", "Token import tidak valid.")
        try:
            page = max(1, int(request.query_params.get("page") or 1))
            limit = max(1, min(int(request.query_params.get("limit") or 50), 200))
            issues, total = list_import_preview_issues(
                import_token,
                admin,
                severity=str(request.query_params.get("severity") or ""),
                query=str(request.query_params.get("query") or ""),
                page=page,
                limit=limit,
            )
        except ValueError as exc:
            return error_response(400, "VALIDATION_ERROR", str(exc))
        if not get_import_preview_for_admin(import_token, admin):
            return error_response(404, "NOT_FOUND", "File preview import tidak ditemukan.")
        response = success_response({"issues": issues, "pagination": {"page": page, "limit": limit, "total": total}})
        response.headers["Cache-Control"] = "no-store"
        return response

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
        if preview_record["claim_id"]:
            return error_response(
                409,
                "IMPORT_ALREADY_PROCESSING",
                "Token import sedang diproses atau sudah digunakan.",
            )

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
            period_code = str(preview_record["period_code"] or "") or None
            expected_file_sha256 = str(preview_record["file_sha256"] or "")
            if expected_file_sha256 and _file_sha256(workbook) != expected_file_sha256:
                return error_response(
                    409,
                    "IMPORT_FILE_CHANGED",
                    "File import berubah setelah preview. Upload dan periksa kembali file tersebut.",
                )
            preview = preview_workbook(
                workbook,
                config.DB_PATH,
                period=period_code,
                source_file_name=source_file_name,
            )
            if preview["requires_update_confirmation"] and not confirm_updates:
                return error_response(
                    409,
                    "IMPORT_CONFIRMATION_REQUIRED",
                    "Perubahan nominal atau BRIVA harus dikonfirmasi admin sebelum import disimpan.",
                )

            claimed_record = claim_import_preview_for_admin(import_token, admin)
            if not claimed_record:
                return error_response(
                    409,
                    "IMPORT_ALREADY_PROCESSING",
                    "Token import sedang diproses atau sudah digunakan.",
                )

            claim_id = str(claimed_record["claim_id"])
            try:
                result = import_workbook(
                    workbook,
                    config.DB_PATH,
                    period=period_code,
                    source_file_name=source_file_name,
                    confirm_updates=confirm_updates,
                    actor_id=admin["id"],
                    import_token=import_token,
                    file_sha256=str(claimed_record["file_sha256"] or "") or None,
                    period_label=str(claimed_record["period_label"] or "") or None,
                    billing_year=(
                        int(claimed_record["billing_year"]) if claimed_record["billing_year"] is not None else None
                    ),
                    semester_type=str(claimed_record["semester_type"] or "") or None,
                )
            except Exception:
                try:
                    released = release_import_preview_claim(import_token, claim_id)
                except Exception:
                    logger.exception("Failed to release import claim %s for token %s", claim_id, import_token)
                else:
                    if not released:
                        logger.error("Failed to release import claim %s for token %s", claim_id, import_token)
                raise

            try:
                consumed = consume_import_preview_claim(import_token, claim_id)
            except Exception:
                consumed = False
                logger.exception("Failed to consume import claim %s for token %s", claim_id, import_token)
            if consumed:
                try:
                    workbook.unlink(missing_ok=True)
                except OSError:
                    logger.exception("Failed to remove committed import workbook for token %s", import_token)
            else:
                logger.error(
                    "Committed import token %s remains claimed; retaining workbook for expiry cleanup",
                    import_token,
                )
            return success_response(result)
        except ValueError as exc:
            return error_response(400, "IMPORT_VALIDATION_FAILED", str(exc))
        except Exception:
            logger.exception("Unexpected failure while committing import token %s", import_token)
            return error_response(
                400, "IMPORT_COMMIT_FAILED", "Import tidak dapat disimpan. Periksa file dan coba lagi."
            )

    return router
