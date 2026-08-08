from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from json import JSONDecodeError
from pathlib import Path

from fastapi import Depends, FastAPI, File, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse

from Backend.app import config
from Backend.app.rate_limit import RATE_LIMITER, RateLimiter
from Backend.app.responses import error_response, request_id, success_response
from Backend.app.security import cookie_header
from Backend.app.services import (
    authenticate_admin,
    bill_row_to_dict,
    cleanup_stale_imports,
    create_admin_session,
    delete_admin_session,
    ensure_database,
    list_imported_bill_groups,
    rupiah,
    sanitize_filename,
    update_bill_status,
    write_audit,
    write_lookup_log,
    find_admin_by_session,
)
from Backend.db import connect
from Backend.excel_reader import normalize_nim
from Backend.import_excel import import_workbook, preview_workbook


@asynccontextmanager
async def lifespan(_: FastAPI):
    ensure_database()
    yield


app = FastAPI(title="Salut Cek Pembayaran", version="0.2.0", lifespan=lifespan)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Content-Security-Policy"] = "default-src 'self'; base-uri 'none'; frame-ancestors 'none'"
    return response


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, __: RequestValidationError) -> JSONResponse:
    return error_response(400, "VALIDATION_ERROR", "Data yang dikirim belum valid.")


def client_ip(request: Request) -> str:
    if config.TRUST_PROXY_HEADERS:
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            return forwarded.split(",", 1)[0].strip()
    return request.client.host if request.client else "unknown"


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
            return error_response(401, "UNAUTHORIZED", "Silakan login sebagai admin.")
        if permission and permission not in config.ROLE_PERMISSIONS.get(admin["role"], set()):
            return error_response(403, "FORBIDDEN", "Role Anda tidak memiliki akses untuk aksi ini.")
        return admin

    return dependency


@app.get("/api/health")
async def health() -> JSONResponse:
    conn = connect(config.DB_PATH)
    students = conn.execute("select count(*) as total from students").fetchone()["total"]
    bills = conn.execute("select count(*) as total from bills").fetchone()["total"]
    issues = conn.execute("select count(*) as total from import_issues").fetchone()["total"]
    conn.close()
    return success_response({"status": "ok", "students": students, "bills": bills, "import_issues": issues})


@app.post("/api/lookup")
async def lookup(request: Request) -> JSONResponse:
    req_id = request_id()
    payload = await read_json(request)
    nim = normalize_nim(payload.get("nim"))

    retry_after = enforce_rate_limit("lookup", client_ip(request), 10, 10 * 60)
    if retry_after:
        write_lookup_log(nim, "", "rate_limited")
        return error_response(
            429,
            "RATE_LIMITED",
            "Terlalu banyak permintaan. Coba lagi nanti.",
            {"Retry-After": str(retry_after)},
            req_id,
        )

    if not nim:
        write_lookup_log(nim, "", "invalid")
        return error_response(400, "VALIDATION_ERROR", "NIM wajib diisi.", req_id=req_id)

    conn = connect(config.DB_PATH)
    student = conn.execute("select id, nim, full_name from students where nim = ?", (nim,)).fetchone()
    if not student:
        conn.close()
        write_lookup_log(nim, "", "not_found")
        return error_response(404, "NOT_FOUND", "Data tagihan tidak ditemukan. Pastikan NIM sesuai data SALUT.", req_id=req_id)

    bills = conn.execute(
        """
        select briva, amount, period, bill_type, status, payment_method, instructions
        from bills
        where student_id = ?
        order by period desc, created_at asc, briva asc
        """,
        (student["id"],),
    ).fetchall()
    conn.close()
    write_lookup_log(nim, "", "found")

    return JSONResponse(
        {
            "success": True,
            "data": {
                "student": {
                    "nim": student["nim"],
                    "full_name": student["full_name"],
                    "program_study": config.DEFAULT_PROGRAM_STUDY,
                    "payment_period": config.DEFAULT_PAYMENT_PERIOD_LABEL or (bills[0]["period"] if bills else ""),
                },
                "bills": [
                    {
                        "bill_label": f"Tagihan {index}" if len(bills) > 1 else bill["bill_type"],
                        "period": bill["period"],
                        "bill_type": bill["bill_type"],
                        "status": bill["status"],
                        "amount": bill["amount"],
                        "amount_formatted": rupiah(int(bill["amount"])),
                        "payment_method": bill["payment_method"],
                        "briva": bill["briva"],
                        "instructions": bill["instructions"],
                    }
                    for index, bill in enumerate(bills, start=1)
                ],
            },
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

    admin = authenticate_admin(email, password)
    if not admin:
        retry_after = enforce_rate_limit("login", f"{client_ip(request)}:{email}", 5, 15 * 60)
        if retry_after:
            return error_response(
                429,
                "RATE_LIMITED",
                "Terlalu banyak percobaan login. Coba lagi nanti.",
                {"Retry-After": str(retry_after)},
            )
        return error_response(401, "UNAUTHORIZED", "Email atau password tidak sesuai.")

    token = create_admin_session(admin)
    return success_response(
        {"email": admin["email"], "full_name": admin["full_name"], "role": admin["role"]},
        headers={"Set-Cookie": cookie_header(token, config.SESSION_TTL_HOURS * 60 * 60)},
    )


@app.get("/api/admin/me")
async def admin_me(admin=Depends(require_admin())) -> JSONResponse:
    if isinstance(admin, JSONResponse):
        return admin
    return success_response({"email": admin["email"], "full_name": admin["full_name"], "role": admin["role"]})


@app.post("/api/admin/logout")
async def admin_logout(request: Request) -> JSONResponse:
    admin = current_admin(request)
    delete_admin_session(session_token(request), admin)
    return success_response(headers={"Set-Cookie": cookie_header("", 0)})


@app.get("/api/admin/imported-bills")
async def admin_imported_bills(admin=Depends(require_admin("import"))) -> JSONResponse:
    if isinstance(admin, JSONResponse):
        return admin
    return success_response({"groups": list_imported_bill_groups(config.DB_PATH)})


@app.post("/api/admin/bills/status")
async def admin_bill_status(request: Request, admin=Depends(require_admin("import"))) -> JSONResponse:
    if isinstance(admin, JSONResponse):
        return admin
    payload = await read_json(request)
    bill_id = str(payload.get("bill_id") or "").strip()
    status = str(payload.get("status") or "").strip().lower()
    if not bill_id:
        return error_response(400, "VALIDATION_ERROR", "ID tagihan wajib diisi.")
    try:
        updated = update_bill_status(config.DB_PATH, bill_id, status)
    except ValueError as exc:
        return error_response(400, "VALIDATION_ERROR", str(exc))
    if not updated:
        return error_response(404, "NOT_FOUND", "Tagihan tidak ditemukan.")

    conn = connect(config.DB_PATH)
    with conn:
        write_audit(
            conn,
            admin["id"],
            "bill.status_update",
            "bill",
            bill_id,
            {"status": status, "briva": updated["briva"], "nim": updated["nim"]},
        )
    conn.close()
    return success_response({"bill": bill_row_to_dict(updated)})


@app.post("/api/admin/import/preview")
async def admin_import_preview(
    request: Request,
    file: UploadFile = File(...),
    admin=Depends(require_admin("import")),
) -> JSONResponse:
    if isinstance(admin, JSONResponse):
        return admin
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
        conn = connect(config.DB_PATH)
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
        conn.close()
        return success_response({"import_token": import_token, "file_name": safe_name, **preview})
    except Exception as exc:
        if saved_path:
            saved_path.unlink(missing_ok=True)
        message = str(exc) if isinstance(exc, ValueError) else "File tidak dapat diproses. Gunakan workbook Excel yang valid."
        return error_response(400, "IMPORT_PREVIEW_FAILED", message)
    finally:
        await file.close()


@app.post("/api/admin/import/commit")
async def admin_import_commit(request: Request, admin=Depends(require_admin("import"))) -> JSONResponse:
    if isinstance(admin, JSONResponse):
        return admin
    retry_after = enforce_rate_limit("import_commit", admin["id"], 10, 60 * 60)
    if retry_after:
        return error_response(429, "RATE_LIMITED", "Terlalu banyak permintaan. Coba lagi nanti.", {"Retry-After": str(retry_after)})

    payload = await read_json(request)
    import_token = str(payload.get("import_token") or "")
    confirm_updates = payload.get("confirm_updates") is True
    if not import_token.startswith("imp_"):
        return error_response(400, "VALIDATION_ERROR", "Token import tidak valid.")

    matches = list(config.IMPORT_DIR.glob(f"{import_token}_*.xlsx"))
    if not matches:
        return error_response(404, "NOT_FOUND", "File preview import tidak ditemukan.")

    workbook = matches[0]
    try:
        source_file_name = workbook.name[len(import_token) + 1 :]
        preview = preview_workbook(workbook, config.DB_PATH, source_file_name=source_file_name)
        if preview["critical_rows"]:
            workbook.unlink(missing_ok=True)
            return error_response(400, "IMPORT_VALIDATION_FAILED", "Import dibatalkan karena ada baris kritis pada sheet Data Sinkron.")
        if preview["requires_update_confirmation"] and not confirm_updates:
            return error_response(
                409,
                "IMPORT_CONFIRMATION_REQUIRED",
                "Perubahan nominal atau BRIVA harus dikonfirmasi admin sebelum import disimpan.",
            )
        result = import_workbook(workbook, config.DB_PATH, source_file_name=source_file_name, confirm_updates=confirm_updates)
        conn = connect(config.DB_PATH)
        with conn:
            write_audit(conn, admin["id"], "import.commit", "excel_import", import_token, {"file_name": workbook.name, **result})
        conn.close()
        workbook.unlink(missing_ok=True)
        return success_response(result)
    except ValueError as exc:
        return error_response(400, "IMPORT_VALIDATION_FAILED", str(exc))
    except Exception:
        return error_response(400, "IMPORT_COMMIT_FAILED", "Import tidak dapat disimpan. Periksa file dan coba lagi.")


@app.get("/admin", include_in_schema=False)
@app.get("/admin/", include_in_schema=False)
async def admin_page() -> FileResponse:
    return FileResponse(config.FRONTEND_DIR / "admin.html")


@app.get("/{full_path:path}", include_in_schema=False, response_model=None)
async def frontend(full_path: str):
    if full_path.startswith("api/"):
        return error_response(404, "NOT_FOUND", "Endpoint tidak ditemukan.")
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
