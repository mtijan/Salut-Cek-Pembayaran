import logging
import re
import uuid
from contextlib import asynccontextmanager
from json import JSONDecodeError
from pathlib import Path

from fastapi import Depends, FastAPI, File, Request, Response, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse

from Backend.app import config
from Backend.app.rate_limit import RATE_LIMITER
from Backend.app.responses import error_response, request_id, success_response
from Backend.app.security import cookie_header
from Backend.app.version import APP_VERSION
from Backend.app.services import (
    authenticate_admin,
    bill_row_to_dict,
    cleanup_stale_imports,
    cleanup_operational_data,
    create_academic_period,
    create_admin_session,
    create_bill,
    create_student,
    create_study_program,
    delete_admin_session,
    delete_bill,
    delete_imported_bill_group,
    delete_import_preview,
    delete_student,
    delete_study_program,
    ensure_database,
    find_admin_by_session,
    get_bill_detail,
    get_bills_summary,
    get_dashboard_stats,
    get_financial_summary,
    get_import_preview_for_admin,
    get_student_detail,
    list_academic_periods,
    list_bills,
    list_imported_bill_groups,
    list_import_issues,
    list_payment_transactions,
    list_students,
    list_study_programs,
    payment_transaction_target_exists,
    record_bill_payment,
    sanitize_filename,
    store_import_preview,
    student_row_to_dict,
    update_academic_period,
    update_bill,
    update_bill_due_date,
    update_bill_status,
    update_student,
    update_study_program,
    validate_nim_value,
    write_audit,
    write_lookup_log,
)
from Backend.db import connect
from Backend.import_excel import generate_master_data_template, import_workbook, preview_workbook
from Backend.app.use_cases.lookup import LookupService


logger = logging.getLogger(__name__)


class AuthError(Exception):
    def __init__(self, status_code: int, code: str, message: str) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message


@asynccontextmanager
async def lifespan(_: FastAPI):
    ensure_database()
    cleanup_operational_data()
    yield


app = FastAPI(title="Salut Cek Pembayaran", version=APP_VERSION, lifespan=lifespan)

DOCS_CONTENT_SECURITY_POLICY = (
    "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'; "
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    "font-src 'self'; img-src 'self' data: https://fastapi.tiangolo.com https://cdn.jsdelivr.net;"
)

APPLICATION_CONTENT_SECURITY_POLICY = (
    "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'; "
    "script-src 'self'; connect-src 'self'; "
    "style-src 'self'; style-src-elem 'self'; style-src-attr 'unsafe-inline'; "
    "font-src 'self'; img-src 'self' data:; form-action 'self'; manifest-src 'self';"
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Frame-Options"] = "DENY"
    if request.url.path in {"/docs", "/redoc", "/openapi.json"}:
        response.headers["Content-Security-Policy"] = DOCS_CONTENT_SECURITY_POLICY
    else:
        response.headers["Content-Security-Policy"] = APPLICATION_CONTENT_SECURITY_POLICY
    return response


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, __: RequestValidationError) -> JSONResponse:
    return error_response(400, "VALIDATION_ERROR", "Data yang dikirim belum valid.")


@app.exception_handler(AuthError)
async def auth_exception_handler(_: Request, exc: AuthError) -> JSONResponse:
    return error_response(exc.status_code, exc.code, exc.message)


def client_ip(request: Request) -> str:
    if config.TRUST_PROXY_HEADERS:
        real_ip = request.headers.get("x-real-ip", "").strip()
        if real_ip:
            return real_ip
    return request.client.host if request.client else "unknown"


def parse_limit(request: Request, default: int = 2000, max_limit: int = 5000) -> int:
    raw = request.query_params.get("limit")
    if raw is None or raw == "":
        return default
    try:
        val = int(raw)
    except ValueError:
        raise ValueError("Query parameter limit harus berupa angka.")
    return max(1, min(val, max_limit))


def parse_offset(request: Request) -> int:
    raw = request.query_params.get("offset")
    if raw is None or raw == "":
        return 0
    try:
        value = int(raw)
    except ValueError:
        raise ValueError("Query parameter offset harus berupa angka.")
    return max(0, value)


def enforce_rate_limit(scope: str, key: str, limit: int, window_seconds: int) -> int | None:
    return RATE_LIMITER.check(scope, key, limit, window_seconds)


def session_token(request: Request) -> str | None:
    return request.cookies.get(config.SESSION_COOKIE)


async def read_json(request: Request) -> dict:
    try:
        payload = await request.json()
    except JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


def current_admin(request: Request):
    return find_admin_by_session(session_token(request))


def require_admin(permission: str | None = None):
    def dependency(request: Request):
        admin = current_admin(request)
        if not admin:
            raise AuthError(401, "UNAUTHORIZED", "Silakan login sebagai admin.")
        if permission and permission not in config.ROLE_PERMISSIONS.get(admin["role"], set()):
            raise AuthError(403, "FORBIDDEN", "Role Anda tidak memiliki akses untuk aksi ini.")
        return admin

    return dependency


@app.get("/api/health")
async def health() -> JSONResponse:
    return success_response({"status": "ok", "version": APP_VERSION, "release_id": config.RELEASE_ID})


@app.post("/api/lookup")
async def lookup(request: Request) -> JSONResponse:
    req_id = request_id()
    payload = await read_json(request)

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

    try:
        nim = validate_nim_value(payload.get("nim"))
    except ValueError as exc:
        write_lookup_log("", "", "invalid")
        return error_response(400, "VALIDATION_ERROR", str(exc), req_id=req_id)

    if not nim:
        write_lookup_log(nim, "", "invalid")
        return error_response(400, "VALIDATION_ERROR", "NIM wajib diisi.", req_id=req_id)

    result = LookupService(
        config.DB_PATH,
        default_program_study=config.DEFAULT_PROGRAM_STUDY,
        default_payment_period_label=config.DEFAULT_PAYMENT_PERIOD_LABEL,
    ).execute(nim)
    if result is None:
        write_lookup_log(nim, "", "not_found")
        return error_response(404, "NOT_FOUND", "Data tagihan tidak ditemukan. Pastikan NIM sesuai data SALUT.", req_id=req_id)
    write_lookup_log(nim, "", "found")

    return JSONResponse(
        {
            "success": True,
            "data": result,
            "request_id": req_id,
        }
    )


@app.post("/api/admin/login")
async def admin_login(request: Request) -> JSONResponse:
    payload = await read_json(request)
    email = str(payload.get("email") or "").strip().casefold()
    password = str(payload.get("password") or "")
    if not email or not password:
        return error_response(400, "VALIDATION_ERROR", "Email dan password wajib diisi.")

    # Consume the rate-limit budget before verifying the password. Checking it
    # only after a failed verification lets a correct guess bypass an already
    # exhausted limit and still pays the expensive password-hash cost.
    retry_after = enforce_rate_limit("login", f"{client_ip(request)}:{email}", 5, 15 * 60)
    if retry_after:
        return error_response(
            429,
            "RATE_LIMITED",
            "Terlalu banyak percobaan login. Coba lagi nanti.",
            {"Retry-After": str(retry_after)},
        )

    admin = authenticate_admin(email, password)
    if not admin:
        return error_response(401, "UNAUTHORIZED", "Email atau password tidak sesuai.")

    token = create_admin_session(admin)
    return success_response(
        {"email": admin["email"], "full_name": admin["full_name"], "role": admin["role"], "permissions": sorted(config.ROLE_PERMISSIONS.get(admin["role"], set()))},
        headers={"Set-Cookie": cookie_header(token, config.SESSION_TTL_HOURS * 60 * 60)},
    )


@app.get("/api/admin/me")
async def admin_me(admin=Depends(require_admin())) -> JSONResponse:
    return success_response({"email": admin["email"], "full_name": admin["full_name"], "role": admin["role"], "permissions": sorted(config.ROLE_PERMISSIONS.get(admin["role"], set()))})


@app.post("/api/admin/logout")
async def admin_logout(request: Request) -> JSONResponse:
    admin = current_admin(request)
    delete_admin_session(session_token(request), admin)
    return success_response(headers={"Set-Cookie": cookie_header("", 0)})


@app.get("/api/admin/imported-bills")
async def admin_imported_bills(admin=Depends(require_admin("view_imports"))) -> JSONResponse:
    return success_response({"groups": list_imported_bill_groups(config.DB_PATH)})


@app.delete("/api/admin/imported-files")
async def admin_delete_imported_file(request: Request, admin=Depends(require_admin("import"))) -> JSONResponse:
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


@app.post("/api/admin/bills/status")
async def admin_bill_status(request: Request, admin=Depends(require_admin("manage_billing"))) -> JSONResponse:
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
            config.DB_PATH, bill_id, status, paid_amount=paid_amount, recorded_by=admin["id"],
            payment_date=payment_date, reference_number=reference_number, notes=notes,
        )
    except ValueError as exc:
        return error_response(400, "VALIDATION_ERROR", str(exc))
    if not updated:
        return error_response(404, "NOT_FOUND", "Tagihan tidak ditemukan.")

    return success_response({"bill": bill_row_to_dict(updated)})


@app.post("/api/admin/bills/due-date")
async def admin_bill_due_date(request: Request, admin=Depends(require_admin("manage_billing"))) -> JSONResponse:
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
        updated_rows = update_bill_due_date(config.DB_PATH, target_ids, str(due_date) if due_date else "", actor_id=admin["id"])
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


# ==========================================
# DASHBOARD STATS & FINANCIAL REPORTS
# ==========================================

@app.get("/api/admin/dashboard/stats")
async def admin_dashboard_stats(admin=Depends(require_admin("view_reports"))) -> JSONResponse:
    return success_response(get_dashboard_stats(config.DB_PATH))


@app.get("/api/admin/reports/financial-summary")
async def admin_financial_summary(request: Request, admin=Depends(require_admin("view_reports"))) -> JSONResponse:
    period = str(request.query_params.get("period") or "").strip()
    study_program_id = str(request.query_params.get("study_program_id") or "").strip()
    entry_period = str(request.query_params.get("entry_period") or "").strip()
    return success_response(
        get_financial_summary(
            config.DB_PATH,
            period=period,
            study_program_id=study_program_id,
            entry_period=entry_period,
        )
    )


# ==========================================
# MASTER DATA: STUDY PROGRAMS
# ==========================================

@app.get("/api/admin/study-programs")
async def admin_study_programs(admin=Depends(require_admin("view_master_data"))) -> JSONResponse:
    return success_response({"study_programs": list_study_programs(config.DB_PATH)})


@app.post("/api/admin/study-programs")
async def admin_create_study_program(request: Request, admin=Depends(require_admin("manage_master_data"))) -> JSONResponse:
    payload = await read_json(request)
    try:
        program = create_study_program(config.DB_PATH, payload, actor_id=admin["id"])
    except ValueError as exc:
        return error_response(400, "VALIDATION_ERROR", str(exc))

    return success_response({"study_program": program})


@app.patch("/api/admin/study-programs/{program_id}")
async def admin_update_study_program(program_id: str, request: Request, admin=Depends(require_admin("manage_master_data"))) -> JSONResponse:
    payload = await read_json(request)
    try:
        program = update_study_program(config.DB_PATH, program_id, payload, actor_id=admin["id"])
    except ValueError as exc:
        return error_response(400, "VALIDATION_ERROR", str(exc))
    if not program:
        return error_response(404, "NOT_FOUND", "Program studi tidak ditemukan.")

    return success_response({"study_program": program})


@app.delete("/api/admin/study-programs/{program_id}")
async def admin_delete_study_program(program_id: str, admin=Depends(require_admin("manage_master_data"))) -> JSONResponse:
    deleted = delete_study_program(config.DB_PATH, program_id, actor_id=admin["id"])
    if not deleted:
        return error_response(404, "NOT_FOUND", "Program studi tidak ditemukan.")

    return success_response({"deleted": True})


# ==========================================
# MASTER DATA: ACADEMIC PERIODS
# ==========================================

@app.get("/api/admin/academic-periods")
async def admin_academic_periods(admin=Depends(require_admin("view_master_data"))) -> JSONResponse:
    return success_response({"academic_periods": list_academic_periods(config.DB_PATH)})


@app.post("/api/admin/academic-periods")
async def admin_create_academic_period(request: Request, admin=Depends(require_admin("manage_master_data"))) -> JSONResponse:
    payload = await read_json(request)
    try:
        period = create_academic_period(config.DB_PATH, payload, actor_id=admin["id"])
    except ValueError as exc:
        return error_response(400, "VALIDATION_ERROR", str(exc))

    return success_response({"academic_period": period})


@app.patch("/api/admin/academic-periods/{period_id}")
async def admin_update_academic_period(period_id: str, request: Request, admin=Depends(require_admin("manage_master_data"))) -> JSONResponse:
    payload = await read_json(request)
    try:
        period = update_academic_period(config.DB_PATH, period_id, payload, actor_id=admin["id"])
    except ValueError as exc:
        return error_response(400, "VALIDATION_ERROR", str(exc))
    if not period:
        return error_response(404, "NOT_FOUND", "Periode akademik tidak ditemukan.")

    return success_response({"academic_period": period})


# ==========================================
# TEMPLATES & MASTER DATA
# ==========================================

@app.get("/api/admin/template/master-data")
async def admin_download_master_data_template(admin=Depends(require_admin("view_master_data"))) -> Response:
    content = generate_master_data_template()
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="Template_Master_Data_Mahasiswa.xlsx"'},
    )


# ==========================================
# STUDENTS & STUDENT PROFILE 360
# ==========================================

@app.get("/api/admin/students")
async def admin_students(request: Request, admin=Depends(require_admin("view_students"))) -> JSONResponse:
    query = str(request.query_params.get("query") or "")
    study_program_id = str(request.query_params.get("study_program_id") or request.query_params.get("prodi") or "")
    academic_status = str(request.query_params.get("academic_status") or "")
    entry_period = str(request.query_params.get("entry_period") or "")
    sort_by = str(request.query_params.get("sort_by") or "")
    raw_year = request.query_params.get("entry_year")
    entry_year = int(raw_year) if raw_year and raw_year.isdigit() else None
    try:
        limit = parse_limit(request, default=2000, max_limit=5000)
    except ValueError as exc:
        return error_response(400, "VALIDATION_ERROR", str(exc))
    return success_response({
        "students": list_students(
            config.DB_PATH,
            query=query,
            limit=limit,
            study_program_id=study_program_id,
            academic_status=academic_status,
            entry_year=entry_year,
            entry_period=entry_period,
            sort_by=sort_by,
        )
    })


@app.get("/api/admin/students/{student_id}/detail")
async def admin_student_detail(student_id: str, admin=Depends(require_admin("view_students"))) -> JSONResponse:
    detail = get_student_detail(config.DB_PATH, student_id)
    if not detail:
        return error_response(404, "NOT_FOUND", "Mahasiswa tidak ditemukan.")
    return success_response(detail)


@app.get("/api/admin/import-issues")
async def admin_import_issues(request: Request, admin=Depends(require_admin("view_imports"))) -> JSONResponse:
    try:
        limit = parse_limit(request, default=500, max_limit=2000)
    except ValueError as exc:
        return error_response(400, "VALIDATION_ERROR", str(exc))
    return success_response({"issues": list_import_issues(config.DB_PATH, limit)})


@app.post("/api/admin/students")
async def admin_create_student(request: Request, admin=Depends(require_admin("manage_students"))) -> JSONResponse:
    payload = await read_json(request)
    try:
        student = create_student(config.DB_PATH, payload=payload, actor_id=admin["id"])
    except ValueError as exc:
        return error_response(400, "VALIDATION_ERROR", str(exc))

    return success_response({"student": student_row_to_dict(student)})


@app.patch("/api/admin/students/{student_id}")
async def admin_update_student(student_id: str, request: Request, admin=Depends(require_admin("manage_students"))) -> JSONResponse:
    payload = await read_json(request)
    try:
        student = update_student(config.DB_PATH, student_id, payload, actor_id=admin["id"])
    except ValueError as exc:
        return error_response(400, "VALIDATION_ERROR", str(exc))
    if not student:
        return error_response(404, "NOT_FOUND", "Mahasiswa tidak ditemukan.")

    return success_response({"student": student_row_to_dict(student)})


@app.delete("/api/admin/students/{student_id}")
async def admin_delete_student(student_id: str, request: Request, admin=Depends(require_admin("manage_students"))) -> JSONResponse:
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


@app.get("/api/admin/bills")
async def admin_bills(request: Request, admin=Depends(require_admin("view_billing"))) -> JSONResponse:
    query = str(request.query_params.get("query") or "")
    status = str(request.query_params.get("status") or "").strip().lower()
    source = str(request.query_params.get("source") or "").strip().lower()
    study_program_id = str(request.query_params.get("study_program_id") or request.query_params.get("prodi") or "").strip()
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


@app.post("/api/admin/bills")
async def admin_create_bill(request: Request, admin=Depends(require_admin("manage_billing"))) -> JSONResponse:
    payload = await read_json(request)
    try:
        bill = create_bill(config.DB_PATH, payload, actor_id=admin["id"])
    except ValueError as exc:
        return error_response(400, "VALIDATION_ERROR", str(exc))

    return success_response({"bill": bill_row_to_dict(bill)})


@app.get("/api/admin/bills/{bill_id}")
async def admin_bill_detail(bill_id: str, admin=Depends(require_admin("view_billing"))) -> JSONResponse:
    detail = get_bill_detail(config.DB_PATH, bill_id)
    if not detail:
        return error_response(404, "NOT_FOUND", "Tagihan tidak ditemukan.")
    return success_response(detail)


@app.post("/api/admin/bills/{bill_id}/payments")
async def admin_record_bill_payment(bill_id: str, request: Request, admin=Depends(require_admin("manage_billing"))) -> JSONResponse:
    payload = await read_json(request)
    try:
        result = record_bill_payment(config.DB_PATH, bill_id, payload, actor_id=admin["id"])
    except ValueError as exc:
        return error_response(400, "VALIDATION_ERROR", str(exc))

    return success_response(result)


@app.patch("/api/admin/bills/{bill_id}")
async def admin_update_bill(bill_id: str, request: Request, admin=Depends(require_admin("manage_billing"))) -> JSONResponse:
    payload = await read_json(request)
    try:
        bill = update_bill(config.DB_PATH, bill_id, payload, actor_id=admin["id"])
    except ValueError as exc:
        return error_response(400, "VALIDATION_ERROR", str(exc))
    if not bill:
        return error_response(404, "NOT_FOUND", "Tagihan tidak ditemukan.")

    return success_response({"bill": bill_row_to_dict(bill)})


@app.get("/api/admin/bills/{bill_id}/transactions")
async def admin_bill_transactions(bill_id: str, request: Request, admin=Depends(require_admin("view_billing"))) -> JSONResponse:
    try:
        limit = parse_limit(request, default=50, max_limit=200)
        offset = parse_offset(request)
    except ValueError as exc:
        return error_response(400, "VALIDATION_ERROR", str(exc))
    if not payment_transaction_target_exists(config.DB_PATH, bill_id=bill_id):
        return error_response(404, "NOT_FOUND", "Tagihan tidak ditemukan.")
    data = list_payment_transactions(config.DB_PATH, bill_id=bill_id, limit=limit, offset=offset)
    return success_response(data)


@app.get("/api/admin/students/{student_id}/transactions")
async def admin_student_transactions(student_id: str, request: Request, admin=Depends(require_admin("view_billing"))) -> JSONResponse:
    try:
        limit = parse_limit(request, default=50, max_limit=200)
        offset = parse_offset(request)
    except ValueError as exc:
        return error_response(400, "VALIDATION_ERROR", str(exc))
    if not payment_transaction_target_exists(config.DB_PATH, student_id=student_id):
        return error_response(404, "NOT_FOUND", "Mahasiswa tidak ditemukan.")
    data = list_payment_transactions(config.DB_PATH, student_id=student_id, limit=limit, offset=offset)
    return success_response(data)


@app.delete("/api/admin/bills/{bill_id}")
async def admin_delete_bill(bill_id: str, request: Request, admin=Depends(require_admin("manage_billing"))) -> JSONResponse:
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


@app.post("/api/admin/import/preview")
async def admin_import_preview(
    request: Request,
    file: UploadFile = File(...),
    admin=Depends(require_admin("import")),
) -> JSONResponse:
    retry_after = enforce_rate_limit("import_preview", admin["id"], 20, 60 * 60)
    if retry_after:
        return error_response(429, "RATE_LIMITED", "Terlalu banyak permintaan. Coba lagi nanti.", {"Retry-After": str(retry_after)})

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
        message = str(exc) if isinstance(exc, ValueError) else "File tidak dapat diproses. Gunakan workbook Excel yang valid."
        return error_response(400, "IMPORT_PREVIEW_FAILED", message)
    finally:
        await file.close()


@app.post("/api/admin/import/commit")
async def admin_import_commit(request: Request, admin=Depends(require_admin("import"))) -> JSONResponse:
    retry_after = enforce_rate_limit("import_commit", admin["id"], 10, 60 * 60)
    if retry_after:
        return error_response(429, "RATE_LIMITED", "Terlalu banyak permintaan. Coba lagi nanti.", {"Retry-After": str(retry_after)})

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
            return error_response(400, "IMPORT_VALIDATION_FAILED", "Import dibatalkan karena ada baris kritis pada sheet Data Sinkron.")
        if preview["requires_update_confirmation"] and not confirm_updates:
            return error_response(
                409,
                "IMPORT_CONFIRMATION_REQUIRED",
                "Perubahan nominal atau BRIVA harus dikonfirmasi admin sebelum import disimpan.",
            )
        result = import_workbook(
            workbook, config.DB_PATH, source_file_name=source_file_name,
            confirm_updates=confirm_updates, actor_id=admin["id"],
        )
        workbook.unlink(missing_ok=True)
        delete_import_preview(import_token)
        return success_response(result)
    except ValueError as exc:
        return error_response(400, "IMPORT_VALIDATION_FAILED", str(exc))
    except Exception:
        logger.exception("Unexpected failure while committing import token %s", import_token)
        return error_response(400, "IMPORT_COMMIT_FAILED", "Import tidak dapat disimpan. Periksa file dan coba lagi.")


@app.get("/admin", include_in_schema=False, response_model=None)
@app.get("/admin/", include_in_schema=False, response_model=None)
async def admin_page(request: Request) -> FileResponse | RedirectResponse:
    if request.url.query:
        return RedirectResponse(url="/admin", status_code=303)
    admin_dist_index = config.FRONTEND_DIR / "admin-dist" / "index.html"
    if admin_dist_index.exists():
        return FileResponse(admin_dist_index)
    return FileResponse(config.FRONTEND_DIR / "admin.html")


@app.get("/{full_path:path}", include_in_schema=False, response_model=None)
async def frontend(full_path: str):
    if full_path.startswith("api/"):
        return error_response(404, "NOT_FOUND", "Endpoint tidak ditemukan.")

    if full_path.startswith("admin/"):
        sub_path = full_path[len("admin/"):]
        admin_dist_root = (config.FRONTEND_DIR / "admin-dist").resolve()
        if admin_dist_root.exists():
            admin_dist_file = (admin_dist_root / sub_path).resolve()
            try:
                admin_dist_file.relative_to(admin_dist_root)
                if admin_dist_file.exists() and admin_dist_file.is_file():
                    return FileResponse(admin_dist_file)
            except ValueError:
                pass
            return FileResponse(admin_dist_root / "index.html")

    requested = full_path or "index.html"
    file_path = (config.FRONTEND_DIR / requested).resolve()
    frontend_root = config.FRONTEND_DIR.resolve()
    try:
        file_path.relative_to(frontend_root)
    except ValueError:
        file_path = frontend_root / "index.html"
    if not file_path.exists() or file_path.is_dir():
        file_path = frontend_root / "index.html"
    return FileResponse(file_path)
