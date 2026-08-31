"""OpenAPI specification generator and schema definitions for Salut Cek Pembayaran.

This module builds a comprehensive, schema-accurate OpenAPI 3.1 specification for all
31 paths and 42 operations, defining exact query parameters, request bodies,
cookie-based security schemes, and standardized error response models without
advertising unused 422 HTTPValidationError schemas.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI

from Backend.app.version import APP_VERSION

EXPECTED_OPENAPI_PATHS = 31
EXPECTED_OPENAPI_OPERATIONS = 42


def build_custom_openapi(app: FastAPI) -> dict[str, Any]:
    """Generate canonical OpenAPI 3.1 specification for the application.

    Caches the schema in app.openapi_schema to avoid redundant computation.
    """
    if app.openapi_schema:
        return app.openapi_schema

    error_schema_ref = {"$ref": "#/components/schemas/ErrorResponse"}
    resp_400 = {
        "description": "Validation Error or Invalid Request",
        "content": {"application/json": {"schema": error_schema_ref}},
    }
    resp_401 = {
        "description": "Authentication Required / Invalid Session",
        "content": {"application/json": {"schema": error_schema_ref}},
    }
    resp_403 = {
        "description": "Forbidden - Insufficient Role Capability",
        "content": {"application/json": {"schema": error_schema_ref}},
    }
    resp_404 = {
        "description": "Resource Not Found",
        "content": {"application/json": {"schema": error_schema_ref}},
    }
    resp_409 = {
        "description": "Conflict - Concurrent Modification or Duplicate Claim",
        "content": {"application/json": {"schema": error_schema_ref}},
    }
    resp_429 = {
        "description": "Too Many Requests - Rate Limit Exceeded",
        "content": {"application/json": {"schema": error_schema_ref}},
    }

    sec_cookie: list[dict[str, list[str]]] = [{"cookieAuth": []}]

    paths: dict[str, Any] = {
        "/api/health": {
            "get": {
                "tags": ["Health"],
                "summary": "Health Check",
                "description": "Public health check endpoint returning service status, version, and release identifier.",
                "operationId": "health_check",
                "responses": {
                    "200": {
                        "description": "Successful Health Response",
                        "content": {"application/json": {"schema": {"$ref": "#/components/schemas/HealthResponse"}}},
                    }
                },
            }
        },
        "/api/lookup": {
            "post": {
                "tags": ["Public Lookup"],
                "summary": "Lookup Student Billing",
                "description": (
                    "Public lookup endpoint for students to query active billing records by Student ID (NIM). "
                    "Rate limited per client IP. Returns 200 with empty bills if registered student has no active bills, "
                    "or 404 if student does not exist."
                ),
                "operationId": "lookup_student_bills",
                "requestBody": {
                    "required": True,
                    "content": {"application/json": {"schema": {"$ref": "#/components/schemas/LookupRequest"}}},
                },
                "responses": {
                    "200": {
                        "description": "Lookup Result",
                        "content": {"application/json": {"schema": {"$ref": "#/components/schemas/LookupResponse"}}},
                    },
                    "400": resp_400,
                    "404": resp_404,
                    "429": resp_429,
                },
            }
        },
        "/api/admin/login": {
            "post": {
                "tags": ["Authentication"],
                "summary": "Admin Login",
                "description": "Authenticate admin user via email and password, establishing an HTTP-only session cookie.",
                "operationId": "admin_login",
                "requestBody": {
                    "required": True,
                    "content": {"application/json": {"schema": {"$ref": "#/components/schemas/AdminLoginRequest"}}},
                },
                "responses": {
                    "200": {
                        "description": "Login Successful",
                        "headers": {
                            "Set-Cookie": {
                                "description": "Session cookie containing admin authentication token",
                                "schema": {"type": "string"},
                            }
                        },
                        "content": {"application/json": {"schema": {"$ref": "#/components/schemas/AdminAuthResponse"}}},
                    },
                    "400": resp_400,
                    "401": resp_401,
                    "429": resp_429,
                },
            }
        },
        "/api/admin/me": {
            "get": {
                "tags": ["Authentication"],
                "summary": "Current Admin Profile",
                "description": "Retrieve current authenticated administrator profile and assigned capability permissions.",
                "operationId": "admin_me",
                "security": sec_cookie,
                "responses": {
                    "200": {
                        "description": "Admin Profile",
                        "content": {"application/json": {"schema": {"$ref": "#/components/schemas/AdminAuthResponse"}}},
                    },
                    "401": resp_401,
                    "403": resp_403,
                },
            }
        },
        "/api/admin/logout": {
            "post": {
                "tags": ["Authentication"],
                "summary": "Admin Logout",
                "description": "Revoke current admin session and clear authentication cookie.",
                "operationId": "admin_logout",
                "security": sec_cookie,
                "responses": {
                    "200": {
                        "description": "Logout Successful",
                        "content": {
                            "application/json": {"schema": {"$ref": "#/components/schemas/StandardSuccessResponse"}}
                        },
                    }
                },
            }
        },
        "/api/admin/imported-bills": {
            "get": {
                "tags": ["Billing"],
                "summary": "List Imported Bill Batches",
                "description": "List distinct Excel imported billing batches and summary statistics.",
                "operationId": "list_imported_bills",
                "security": sec_cookie,
                "responses": {
                    "200": {
                        "description": "Imported Bill Batches",
                        "content": {
                            "application/json": {"schema": {"$ref": "#/components/schemas/ImportedBillGroupsResponse"}}
                        },
                    },
                    "401": resp_401,
                    "403": resp_403,
                },
            }
        },
        "/api/admin/imported-files": {
            "delete": {
                "tags": ["Billing"],
                "summary": "Delete Imported File Batch",
                "description": "Soft-delete all billing records associated with an imported file source.",
                "operationId": "delete_imported_file",
                "security": sec_cookie,
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {"schema": {"$ref": "#/components/schemas/DeleteImportedFileRequest"}}
                    },
                },
                "responses": {
                    "200": {
                        "description": "Import Batch Deleted",
                        "content": {
                            "application/json": {"schema": {"$ref": "#/components/schemas/DeleteImportedFileResponse"}}
                        },
                    },
                    "400": resp_400,
                    "401": resp_401,
                    "403": resp_403,
                    "404": resp_404,
                },
            }
        },
        "/api/admin/bills/status": {
            "post": {
                "tags": ["Billing"],
                "summary": "Update Bill Status",
                "description": "Update payment status of a bill (unpaid, partial, paid) with optional transaction details.",
                "operationId": "update_bill_status",
                "security": sec_cookie,
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {"schema": {"$ref": "#/components/schemas/BillStatusUpdateRequest"}}
                    },
                },
                "responses": {
                    "200": {
                        "description": "Bill Status Updated",
                        "content": {
                            "application/json": {"schema": {"$ref": "#/components/schemas/BillSingleResponse"}}
                        },
                    },
                    "400": resp_400,
                    "401": resp_401,
                    "403": resp_403,
                    "404": resp_404,
                },
            }
        },
        "/api/admin/bills/due-date": {
            "post": {
                "tags": ["Billing"],
                "summary": "Bulk Update Due Date",
                "description": "Update due date for one or multiple bills with strict ISO calendar date validation.",
                "operationId": "update_bill_due_date",
                "security": sec_cookie,
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {"schema": {"$ref": "#/components/schemas/BillDueDateUpdateRequest"}}
                    },
                },
                "responses": {
                    "200": {
                        "description": "Due Date Updated",
                        "content": {
                            "application/json": {"schema": {"$ref": "#/components/schemas/BillDueDateUpdateResponse"}}
                        },
                    },
                    "400": resp_400,
                    "401": resp_401,
                    "403": resp_403,
                    "404": resp_404,
                },
            }
        },
        "/api/admin/bills": {
            "get": {
                "tags": ["Billing"],
                "summary": "List Bills",
                "description": "List bills with multi-criteria filtering, financial summary aggregation, and pagination.",
                "operationId": "list_bills",
                "security": sec_cookie,
                "parameters": [
                    {
                        "name": "query",
                        "in": "query",
                        "required": False,
                        "schema": {"type": "string"},
                        "description": "Search by NIM or student name",
                    },
                    {
                        "name": "status",
                        "in": "query",
                        "required": False,
                        "schema": {"type": "string", "enum": ["", "paid", "partial", "unpaid"]},
                        "description": "Filter by payment status",
                    },
                    {
                        "name": "source",
                        "in": "query",
                        "required": False,
                        "schema": {"type": "string", "enum": ["", "import", "manual"]},
                        "description": "Filter by creation source",
                    },
                    {
                        "name": "study_program_id",
                        "in": "query",
                        "required": False,
                        "schema": {"type": "string"},
                        "description": "Filter by study program ID",
                    },
                    {
                        "name": "period",
                        "in": "query",
                        "required": False,
                        "schema": {"type": "string"},
                        "description": "Filter by billing period",
                    },
                    {
                        "name": "bill_type",
                        "in": "query",
                        "required": False,
                        "schema": {"type": "string"},
                        "description": "Filter by bill type",
                    },
                    {
                        "name": "entry_period",
                        "in": "query",
                        "required": False,
                        "schema": {"type": "string"},
                        "description": "Filter by student entry period",
                    },
                    {
                        "name": "sort_by",
                        "in": "query",
                        "required": False,
                        "schema": {"type": "string"},
                        "description": "Sort order (e.g. due_date_asc, amount_desc)",
                    },
                    {
                        "name": "limit",
                        "in": "query",
                        "required": False,
                        "schema": {"type": "integer", "default": 100},
                        "description": "Items per page (max 100)",
                    },
                    {
                        "name": "offset",
                        "in": "query",
                        "required": False,
                        "schema": {"type": "integer", "default": 0},
                        "description": "Pagination offset",
                    },
                ],
                "responses": {
                    "200": {
                        "description": "Paginated Bills with Summary",
                        "content": {"application/json": {"schema": {"$ref": "#/components/schemas/BillsListResponse"}}},
                    },
                    "400": resp_400,
                    "401": resp_401,
                    "403": resp_403,
                },
            },
            "post": {
                "tags": ["Billing"],
                "summary": "Create Bill",
                "description": "Create a new billing record manually for a student.",
                "operationId": "create_bill",
                "security": sec_cookie,
                "requestBody": {
                    "required": True,
                    "content": {"application/json": {"schema": {"$ref": "#/components/schemas/CreateBillRequest"}}},
                },
                "responses": {
                    "200": {
                        "description": "Bill Created",
                        "content": {
                            "application/json": {"schema": {"$ref": "#/components/schemas/BillSingleResponse"}}
                        },
                    },
                    "400": resp_400,
                    "401": resp_401,
                    "403": resp_403,
                },
            },
        },
        "/api/admin/bills/{bill_id}": {
            "get": {
                "tags": ["Billing"],
                "summary": "Get Bill Detail",
                "description": "Retrieve comprehensive billing details, student metadata, and transaction history.",
                "operationId": "get_bill_detail",
                "security": sec_cookie,
                "parameters": [
                    {
                        "name": "bill_id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string"},
                        "description": "Unique bill identifier",
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Bill Detail",
                        "content": {
                            "application/json": {"schema": {"$ref": "#/components/schemas/BillDetailResponse"}}
                        },
                    },
                    "401": resp_401,
                    "403": resp_403,
                    "404": resp_404,
                },
            },
            "patch": {
                "tags": ["Billing"],
                "summary": "Update Bill",
                "description": "Update editable fields of an existing bill record.",
                "operationId": "update_bill",
                "security": sec_cookie,
                "parameters": [
                    {
                        "name": "bill_id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string"},
                        "description": "Unique bill identifier",
                    }
                ],
                "requestBody": {
                    "required": True,
                    "content": {"application/json": {"schema": {"$ref": "#/components/schemas/UpdateBillRequest"}}},
                },
                "responses": {
                    "200": {
                        "description": "Bill Updated",
                        "content": {
                            "application/json": {"schema": {"$ref": "#/components/schemas/BillSingleResponse"}}
                        },
                    },
                    "400": resp_400,
                    "401": resp_401,
                    "403": resp_403,
                    "404": resp_404,
                },
            },
            "delete": {
                "tags": ["Billing"],
                "summary": "Delete Bill",
                "description": "Soft-delete a billing record with audit logging.",
                "operationId": "delete_bill",
                "security": sec_cookie,
                "parameters": [
                    {
                        "name": "bill_id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string"},
                        "description": "Unique bill identifier",
                    },
                    {
                        "name": "reason",
                        "in": "query",
                        "required": False,
                        "schema": {"type": "string"},
                        "description": "Deletion reason",
                    },
                ],
                "responses": {
                    "200": {
                        "description": "Bill Deleted",
                        "content": {
                            "application/json": {"schema": {"$ref": "#/components/schemas/DeleteBillResponse"}}
                        },
                    },
                    "400": resp_400,
                    "401": resp_401,
                    "403": resp_403,
                    "404": resp_404,
                },
            },
        },
        "/api/admin/bills/{bill_id}/payments": {
            "post": {
                "tags": ["Billing"],
                "summary": "Record Payment Transaction",
                "description": "Record an explicit payment transaction against a bill and update its balance/status atomically.",
                "operationId": "record_bill_payment",
                "security": sec_cookie,
                "parameters": [
                    {
                        "name": "bill_id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string"},
                        "description": "Unique bill identifier",
                    }
                ],
                "requestBody": {
                    "required": True,
                    "content": {"application/json": {"schema": {"$ref": "#/components/schemas/RecordPaymentRequest"}}},
                },
                "responses": {
                    "200": {
                        "description": "Payment Recorded",
                        "content": {
                            "application/json": {"schema": {"$ref": "#/components/schemas/RecordPaymentResponse"}}
                        },
                    },
                    "400": resp_400,
                    "401": resp_401,
                    "403": resp_403,
                    "404": resp_404,
                },
            }
        },
        "/api/admin/bills/{bill_id}/transactions": {
            "get": {
                "tags": ["Billing"],
                "summary": "List Bill Payment Transactions",
                "description": "List historical payment ledger transactions recorded for a specific bill.",
                "operationId": "list_bill_transactions",
                "security": sec_cookie,
                "parameters": [
                    {
                        "name": "bill_id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string"},
                        "description": "Unique bill identifier",
                    },
                    {
                        "name": "limit",
                        "in": "query",
                        "required": False,
                        "schema": {"type": "integer", "default": 50},
                        "description": "Max items to return",
                    },
                    {
                        "name": "offset",
                        "in": "query",
                        "required": False,
                        "schema": {"type": "integer", "default": 0},
                        "description": "Pagination offset",
                    },
                ],
                "responses": {
                    "200": {
                        "description": "Payment Transactions",
                        "content": {
                            "application/json": {"schema": {"$ref": "#/components/schemas/PaymentTransactionsResponse"}}
                        },
                    },
                    "400": resp_400,
                    "401": resp_401,
                    "403": resp_403,
                    "404": resp_404,
                },
            }
        },
        "/api/admin/students/{student_id}/transactions": {
            "get": {
                "tags": ["Billing"],
                "summary": "List Student Payment Transactions",
                "description": "List all historical payment transactions recorded across all bills of a student.",
                "operationId": "list_student_transactions",
                "security": sec_cookie,
                "parameters": [
                    {
                        "name": "student_id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string"},
                        "description": "Unique student identifier",
                    },
                    {
                        "name": "limit",
                        "in": "query",
                        "required": False,
                        "schema": {"type": "integer", "default": 50},
                        "description": "Max items to return",
                    },
                    {
                        "name": "offset",
                        "in": "query",
                        "required": False,
                        "schema": {"type": "integer", "default": 0},
                        "description": "Pagination offset",
                    },
                ],
                "responses": {
                    "200": {
                        "description": "Student Payment Transactions",
                        "content": {
                            "application/json": {"schema": {"$ref": "#/components/schemas/PaymentTransactionsResponse"}}
                        },
                    },
                    "400": resp_400,
                    "401": resp_401,
                    "403": resp_403,
                    "404": resp_404,
                },
            }
        },
        "/api/admin/students": {
            "get": {
                "tags": ["Students"],
                "summary": "List Students",
                "description": "List active students filtered by query, study program, academic status, or entry period.",
                "operationId": "list_students",
                "security": sec_cookie,
                "parameters": [
                    {
                        "name": "query",
                        "in": "query",
                        "required": False,
                        "schema": {"type": "string"},
                        "description": "Search by NIM or full name",
                    },
                    {
                        "name": "study_program_id",
                        "in": "query",
                        "required": False,
                        "schema": {"type": "string"},
                        "description": "Filter by study program ID",
                    },
                    {
                        "name": "academic_status",
                        "in": "query",
                        "required": False,
                        "schema": {"type": "string"},
                        "description": "Filter by academic status (aktif, cuti, non-aktif)",
                    },
                    {
                        "name": "entry_period",
                        "in": "query",
                        "required": False,
                        "schema": {"type": "string"},
                        "description": "Filter by entry period code",
                    },
                    {
                        "name": "entry_year",
                        "in": "query",
                        "required": False,
                        "schema": {"type": "integer"},
                        "description": "Filter by entry year",
                    },
                    {
                        "name": "sort_by",
                        "in": "query",
                        "required": False,
                        "schema": {"type": "string"},
                        "description": "Sort order",
                    },
                    {
                        "name": "limit",
                        "in": "query",
                        "required": False,
                        "schema": {"type": "integer", "default": 2000},
                        "description": "Max items to return",
                    },
                ],
                "responses": {
                    "200": {
                        "description": "List of Students",
                        "content": {
                            "application/json": {"schema": {"$ref": "#/components/schemas/StudentListResponse"}}
                        },
                    },
                    "400": resp_400,
                    "401": resp_401,
                    "403": resp_403,
                },
            },
            "post": {
                "tags": ["Students"],
                "summary": "Create Student",
                "description": "Create a new student profile or restore a previously soft-deleted student profile by NIM.",
                "operationId": "create_student",
                "security": sec_cookie,
                "requestBody": {
                    "required": True,
                    "content": {"application/json": {"schema": {"$ref": "#/components/schemas/CreateStudentRequest"}}},
                },
                "responses": {
                    "200": {
                        "description": "Student Created or Restored",
                        "content": {
                            "application/json": {"schema": {"$ref": "#/components/schemas/StudentSingleResponse"}}
                        },
                    },
                    "400": resp_400,
                    "401": resp_401,
                    "403": resp_403,
                },
            },
        },
        "/api/admin/students/{student_id}/detail": {
            "get": {
                "tags": ["Students"],
                "summary": "Get Student 360 Detail",
                "description": (
                    "Retrieve complete Student 360 profile including demographic data, study program, "
                    "billing summary, and active bills. Returns 200 with empty bills list if student has no active bills, "
                    "or 404 if student does not exist."
                ),
                "operationId": "get_student_detail",
                "security": sec_cookie,
                "parameters": [
                    {
                        "name": "student_id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string"},
                        "description": "Unique student identifier",
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Student 360 Detail",
                        "content": {
                            "application/json": {"schema": {"$ref": "#/components/schemas/Student360DetailResponse"}}
                        },
                    },
                    "401": resp_401,
                    "403": resp_403,
                    "404": resp_404,
                },
            }
        },
        "/api/admin/students/{student_id}": {
            "patch": {
                "tags": ["Students"],
                "summary": "Update Student",
                "description": "Update student demographic, contact, and academic status information.",
                "operationId": "update_student",
                "security": sec_cookie,
                "parameters": [
                    {
                        "name": "student_id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string"},
                        "description": "Unique student identifier",
                    }
                ],
                "requestBody": {
                    "required": True,
                    "content": {"application/json": {"schema": {"$ref": "#/components/schemas/UpdateStudentRequest"}}},
                },
                "responses": {
                    "200": {
                        "description": "Student Profile Updated",
                        "content": {
                            "application/json": {"schema": {"$ref": "#/components/schemas/StudentSingleResponse"}}
                        },
                    },
                    "400": resp_400,
                    "401": resp_401,
                    "403": resp_403,
                    "404": resp_404,
                },
            },
            "delete": {
                "tags": ["Students"],
                "summary": "Delete Student",
                "description": "Soft-delete student profile and record deletion audit trail.",
                "operationId": "delete_student",
                "security": sec_cookie,
                "parameters": [
                    {
                        "name": "student_id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string"},
                        "description": "Unique student identifier",
                    },
                    {
                        "name": "reason",
                        "in": "query",
                        "required": False,
                        "schema": {"type": "string"},
                        "description": "Deletion reason",
                    },
                ],
                "responses": {
                    "200": {
                        "description": "Student Soft-Deleted",
                        "content": {
                            "application/json": {"schema": {"$ref": "#/components/schemas/DeleteStudentResponse"}}
                        },
                    },
                    "400": resp_400,
                    "401": resp_401,
                    "403": resp_403,
                    "404": resp_404,
                },
            },
        },
        "/api/admin/dashboard/stats": {
            "get": {
                "tags": ["Reports"],
                "summary": "Get Dashboard Statistics",
                "description": "Calculate aggregate dashboard metrics (total active students, bills, receipts, outstanding).",
                "operationId": "get_dashboard_stats",
                "security": sec_cookie,
                "responses": {
                    "200": {
                        "description": "Dashboard Statistics",
                        "content": {
                            "application/json": {"schema": {"$ref": "#/components/schemas/DashboardStatsResponse"}}
                        },
                    },
                    "401": resp_401,
                    "403": resp_403,
                },
            }
        },
        "/api/admin/reports/financial-summary": {
            "get": {
                "tags": ["Reports"],
                "summary": "Get Financial Summary Report",
                "description": "Generate financial summary report partitioned and aggregated by study program and billing period.",
                "operationId": "get_financial_summary",
                "security": sec_cookie,
                "parameters": [
                    {
                        "name": "period",
                        "in": "query",
                        "required": False,
                        "schema": {"type": "string"},
                        "description": "Filter by billing period",
                    },
                    {
                        "name": "study_program_id",
                        "in": "query",
                        "required": False,
                        "schema": {"type": "string"},
                        "description": "Filter by study program ID",
                    },
                    {
                        "name": "entry_period",
                        "in": "query",
                        "required": False,
                        "schema": {"type": "string"},
                        "description": "Filter by student entry period",
                    },
                ],
                "responses": {
                    "200": {
                        "description": "Financial Summary Report",
                        "content": {
                            "application/json": {"schema": {"$ref": "#/components/schemas/FinancialSummaryResponse"}}
                        },
                    },
                    "401": resp_401,
                    "403": resp_403,
                },
            }
        },
        "/api/admin/import-issues": {
            "get": {
                "tags": ["Reports"],
                "summary": "List Import Validation Issues",
                "description": "List data validation and processing issues encountered during Excel workbook imports.",
                "operationId": "list_import_issues",
                "security": sec_cookie,
                "parameters": [
                    {
                        "name": "limit",
                        "in": "query",
                        "required": False,
                        "schema": {"type": "integer", "default": 500},
                        "description": "Max issues to return",
                    },
                ],
                "responses": {
                    "200": {
                        "description": "Import Issues",
                        "content": {
                            "application/json": {"schema": {"$ref": "#/components/schemas/ImportIssuesResponse"}}
                        },
                    },
                    "400": resp_400,
                    "401": resp_401,
                    "403": resp_403,
                },
            }
        },
        "/api/admin/study-programs": {
            "get": {
                "tags": ["Master Data"],
                "summary": "List Study Programs",
                "description": "List all active study program master data records.",
                "operationId": "list_study_programs",
                "security": sec_cookie,
                "responses": {
                    "200": {
                        "description": "Study Programs List",
                        "content": {
                            "application/json": {"schema": {"$ref": "#/components/schemas/StudyProgramsListResponse"}}
                        },
                    },
                    "401": resp_401,
                    "403": resp_403,
                },
            },
            "post": {
                "tags": ["Master Data"],
                "summary": "Create Study Program",
                "description": "Create a new study program record.",
                "operationId": "create_study_program",
                "security": sec_cookie,
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {"schema": {"$ref": "#/components/schemas/CreateStudyProgramRequest"}}
                    },
                },
                "responses": {
                    "200": {
                        "description": "Study Program Created",
                        "content": {
                            "application/json": {"schema": {"$ref": "#/components/schemas/StudyProgramSingleResponse"}}
                        },
                    },
                    "400": resp_400,
                    "401": resp_401,
                    "403": resp_403,
                },
            },
        },
        "/api/admin/study-programs/{program_id}": {
            "patch": {
                "tags": ["Master Data"],
                "summary": "Update Study Program",
                "description": "Update existing study program code, name, or degree level.",
                "operationId": "update_study_program",
                "security": sec_cookie,
                "parameters": [
                    {
                        "name": "program_id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string"},
                        "description": "Study program ID",
                    }
                ],
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {"schema": {"$ref": "#/components/schemas/UpdateStudyProgramRequest"}}
                    },
                },
                "responses": {
                    "200": {
                        "description": "Study Program Updated",
                        "content": {
                            "application/json": {"schema": {"$ref": "#/components/schemas/StudyProgramSingleResponse"}}
                        },
                    },
                    "400": resp_400,
                    "401": resp_401,
                    "403": resp_403,
                    "404": resp_404,
                },
            },
            "delete": {
                "tags": ["Master Data"],
                "summary": "Delete Study Program",
                "description": "Delete a study program record if no active students or bills are linked.",
                "operationId": "delete_study_program",
                "security": sec_cookie,
                "parameters": [
                    {
                        "name": "program_id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string"},
                        "description": "Study program ID",
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Study Program Deleted",
                        "content": {
                            "application/json": {"schema": {"$ref": "#/components/schemas/StandardSuccessResponse"}}
                        },
                    },
                    "401": resp_401,
                    "403": resp_403,
                    "404": resp_404,
                },
            },
        },
        "/api/admin/academic-periods": {
            "get": {
                "tags": ["Master Data"],
                "summary": "List Academic Periods",
                "description": "List academic periods master data.",
                "operationId": "list_academic_periods",
                "security": sec_cookie,
                "responses": {
                    "200": {
                        "description": "Academic Periods List",
                        "content": {
                            "application/json": {"schema": {"$ref": "#/components/schemas/AcademicPeriodsListResponse"}}
                        },
                    },
                    "401": resp_401,
                    "403": resp_403,
                },
            },
            "post": {
                "tags": ["Master Data"],
                "summary": "Create Academic Period",
                "description": "Create a new academic period record.",
                "operationId": "create_academic_period",
                "security": sec_cookie,
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {"schema": {"$ref": "#/components/schemas/CreateAcademicPeriodRequest"}}
                    },
                },
                "responses": {
                    "200": {
                        "description": "Academic Period Created",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/AcademicPeriodSingleResponse"}
                            }
                        },
                    },
                    "400": resp_400,
                    "401": resp_401,
                    "403": resp_403,
                },
            },
        },
        "/api/admin/academic-periods/{period_id}": {
            "patch": {
                "tags": ["Master Data"],
                "summary": "Update Academic Period",
                "description": "Update academic period details or active status.",
                "operationId": "update_academic_period",
                "security": sec_cookie,
                "parameters": [
                    {
                        "name": "period_id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string"},
                        "description": "Academic period ID",
                    }
                ],
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {"schema": {"$ref": "#/components/schemas/UpdateAcademicPeriodRequest"}}
                    },
                },
                "responses": {
                    "200": {
                        "description": "Academic Period Updated",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/AcademicPeriodSingleResponse"}
                            }
                        },
                    },
                    "400": resp_400,
                    "401": resp_401,
                    "403": resp_403,
                    "404": resp_404,
                },
            }
        },
        "/api/admin/template/master-data": {
            "get": {
                "tags": ["Master Data"],
                "summary": "Download Master Data Template",
                "description": "Download standardized Excel (.xlsx) template for student master data ingestion.",
                "operationId": "download_master_data_template",
                "security": sec_cookie,
                "responses": {
                    "200": {
                        "description": "Excel Template File Stream",
                        "content": {
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
                                "schema": {"type": "string", "format": "binary"}
                            }
                        },
                    },
                    "401": resp_401,
                    "403": resp_403,
                },
            }
        },
        "/api/admin/import/preview": {
            "post": {
                "tags": ["Excel Import"],
                "summary": "Upload and Preview Import Workbook",
                "description": (
                    "Upload and validate an Excel (.xlsx) workbook. Inspects row anomalies, new vs updated records, "
                    "and returns a preview token for two-phase commit."
                ),
                "operationId": "preview_import_workbook",
                "security": sec_cookie,
                "requestBody": {
                    "required": True,
                    "content": {
                        "multipart/form-data": {
                            "schema": {
                                "type": "object",
                                "required": ["file"],
                                "properties": {
                                    "file": {
                                        "type": "string",
                                        "format": "binary",
                                        "description": "Excel (.xlsx) workbook file (max 5 MB)",
                                    }
                                },
                            }
                        }
                    },
                },
                "responses": {
                    "200": {
                        "description": "Import Preview Statistics and Token",
                        "content": {
                            "application/json": {"schema": {"$ref": "#/components/schemas/ImportPreviewResponse"}}
                        },
                    },
                    "400": resp_400,
                    "401": resp_401,
                    "403": resp_403,
                    "429": resp_429,
                },
            }
        },
        "/api/admin/import/commit": {
            "post": {
                "tags": ["Excel Import"],
                "summary": "Commit Import Workbook",
                "description": (
                    "Atomically execute import ingestion using a valid preview token. "
                    "Enforces single-claim concurrency (returns 409 if already claimed or processing)."
                ),
                "operationId": "commit_import_workbook",
                "security": sec_cookie,
                "requestBody": {
                    "required": True,
                    "content": {"application/json": {"schema": {"$ref": "#/components/schemas/ImportCommitRequest"}}},
                },
                "responses": {
                    "200": {
                        "description": "Import Committed Successfully",
                        "content": {
                            "application/json": {"schema": {"$ref": "#/components/schemas/ImportCommitResponse"}}
                        },
                    },
                    "400": resp_400,
                    "401": resp_401,
                    "403": resp_403,
                    "404": resp_404,
                    "409": resp_409,
                    "429": resp_429,
                },
            },
        },
        "/api/admin/audit-logs": {
            "get": {
                "tags": ["Audit Logs"],
                "summary": "List Administrative Audit Logs",
                "description": (
                    "List immutable administrative audit entries with sensitive metadata redacted. "
                    "Requires the dedicated view_audit_logs capability."
                ),
                "operationId": "list_admin_audit_logs",
                "security": sec_cookie,
                "parameters": [
                    {
                        "name": "action",
                        "in": "query",
                        "required": False,
                        "schema": {"type": "string"},
                    },
                    {
                        "name": "entity_type",
                        "in": "query",
                        "required": False,
                        "schema": {"type": "string"},
                    },
                    {
                        "name": "actor_id",
                        "in": "query",
                        "required": False,
                        "schema": {"type": "string"},
                    },
                    {
                        "name": "limit",
                        "in": "query",
                        "required": False,
                        "schema": {"type": "integer", "minimum": 1, "maximum": 200, "default": 50},
                    },
                    {
                        "name": "offset",
                        "in": "query",
                        "required": False,
                        "schema": {"type": "integer", "minimum": 0, "default": 0},
                    },
                ],
                "responses": {
                    "200": {
                        "description": "Redacted Audit Log Page",
                        "content": {
                            "application/json": {"schema": {"$ref": "#/components/schemas/AuditLogListResponse"}}
                        },
                    },
                    "400": resp_400,
                    "401": resp_401,
                    "403": resp_403,
                },
            },
        },
        "/api/admin/users": {
            "get": {
                "tags": ["User Management"],
                "summary": "List Administrator Users",
                "description": "List all administrator accounts with roles, permissions, and active status.",
                "operationId": "list_admin_users",
                "security": sec_cookie,
                "responses": {
                    "200": {
                        "description": "Administrator Users List",
                        "content": {
                            "application/json": {"schema": {"$ref": "#/components/schemas/AdminUserListResponse"}}
                        },
                    },
                    "401": resp_401,
                    "403": resp_403,
                },
            },
            "post": {
                "tags": ["User Management"],
                "summary": "Create Administrator User",
                "description": "Create a new administrator account with specified role and credentials.",
                "operationId": "create_admin_user",
                "security": sec_cookie,
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {"schema": {"$ref": "#/components/schemas/CreateAdminUserRequest"}}
                    },
                },
                "responses": {
                    "200": {
                        "description": "Administrator User Created",
                        "content": {
                            "application/json": {"schema": {"$ref": "#/components/schemas/AdminUserSingleResponse"}}
                        },
                    },
                    "400": resp_400,
                    "401": resp_401,
                    "403": resp_403,
                },
            },
        },
        "/api/admin/users/{user_id}": {
            "get": {
                "tags": ["User Management"],
                "summary": "Get Administrator User Detail",
                "description": "Retrieve administrator account detail by unique identifier.",
                "operationId": "get_admin_user_detail",
                "security": sec_cookie,
                "parameters": [
                    {
                        "name": "user_id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string"},
                        "description": "Unique admin user identifier",
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Administrator User Detail",
                        "content": {
                            "application/json": {"schema": {"$ref": "#/components/schemas/AdminUserSingleResponse"}}
                        },
                    },
                    "401": resp_401,
                    "403": resp_403,
                    "404": resp_404,
                },
            },
            "patch": {
                "tags": ["User Management"],
                "summary": "Update Administrator User",
                "description": "Update administrator profile, role, or active status.",
                "operationId": "update_admin_user",
                "security": sec_cookie,
                "parameters": [
                    {
                        "name": "user_id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string"},
                        "description": "Unique admin user identifier",
                    }
                ],
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {"schema": {"$ref": "#/components/schemas/UpdateAdminUserRequest"}}
                    },
                },
                "responses": {
                    "200": {
                        "description": "Administrator User Updated",
                        "content": {
                            "application/json": {"schema": {"$ref": "#/components/schemas/AdminUserSingleResponse"}}
                        },
                    },
                    "400": resp_400,
                    "401": resp_401,
                    "403": resp_403,
                    "404": resp_404,
                },
            },
            "delete": {
                "tags": ["User Management"],
                "summary": "Delete Administrator User",
                "description": "Delete an administrator user and revoke active sessions.",
                "operationId": "delete_admin_user",
                "security": sec_cookie,
                "parameters": [
                    {
                        "name": "user_id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string"},
                        "description": "Unique admin user identifier",
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Administrator User Deleted",
                        "content": {
                            "application/json": {"schema": {"$ref": "#/components/schemas/DeleteAdminUserResponse"}}
                        },
                    },
                    "400": resp_400,
                    "401": resp_401,
                    "403": resp_403,
                    "404": resp_404,
                },
            },
        },
        "/api/admin/users/{user_id}/reset-password": {
            "post": {
                "tags": ["User Management"],
                "summary": "Reset Administrator Password",
                "description": "Reset administrator credentials and revoke all active sessions.",
                "operationId": "reset_admin_user_password",
                "security": sec_cookie,
                "parameters": [
                    {
                        "name": "user_id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string"},
                        "description": "Unique admin user identifier",
                    }
                ],
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {"schema": {"$ref": "#/components/schemas/ResetAdminUserPasswordRequest"}}
                    },
                },
                "responses": {
                    "200": {
                        "description": "Administrator Password Reset",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/ResetAdminUserPasswordResponse"}
                            }
                        },
                    },
                    "400": resp_400,
                    "401": resp_401,
                    "403": resp_403,
                    "404": resp_404,
                },
            },
        },
    }

    schemas: dict[str, Any] = {
        "ErrorDetail": {
            "type": "object",
            "required": ["code", "message"],
            "properties": {
                "code": {"type": "string", "example": "VALIDATION_ERROR"},
                "message": {"type": "string", "example": "Data yang dikirim belum valid."},
            },
        },
        "ErrorResponse": {
            "type": "object",
            "required": ["success", "error", "request_id"],
            "properties": {
                "success": {"type": "boolean", "example": False},
                "error": {"$ref": "#/components/schemas/ErrorDetail"},
                "request_id": {"type": "string", "example": "req_01h7abc123"},
            },
        },
        "StandardSuccessResponse": {
            "type": "object",
            "required": ["success"],
            "properties": {
                "success": {"type": "boolean", "example": True},
                "data": {"type": "object", "nullable": True},
            },
        },
        "HealthResponse": {
            "type": "object",
            "required": ["success", "data"],
            "properties": {
                "success": {"type": "boolean", "example": True},
                "data": {
                    "type": "object",
                    "required": ["status", "version", "release_id"],
                    "properties": {
                        "status": {"type": "string", "example": "ok"},
                        "version": {"type": "string", "example": APP_VERSION},
                        "release_id": {"type": "string", "example": "75d3f82"},
                    },
                },
            },
        },
        "LookupRequest": {
            "type": "object",
            "required": ["nim"],
            "properties": {
                "nim": {"type": "string", "description": "Student ID (NIM), digits only", "example": "050117077"}
            },
        },
        "LookupStudentInfo": {
            "type": "object",
            "required": ["nim", "full_name", "program_study", "payment_period", "due_date", "due_date_formatted"],
            "properties": {
                "nim": {"type": "string", "example": "050117077"},
                "full_name": {"type": "string", "example": "Syahla Taqiyyah"},
                "program_study": {"type": "string", "example": "S1 Ilmu Hukum"},
                "payment_period": {"type": "string", "example": "Semester Ganjil 2026"},
                "due_date": {"type": "string", "example": "2026-09-10"},
                "due_date_formatted": {"type": "string", "example": "10 September 2026"},
            },
        },
        "LookupBillItem": {
            "type": "object",
            "required": [
                "bill_label",
                "period",
                "bill_type",
                "status",
                "amount",
                "amount_formatted",
                "paid_amount",
                "paid_amount_formatted",
                "remaining_amount",
                "remaining_amount_formatted",
                "payment_method",
                "briva",
                "instructions",
                "due_date",
                "due_date_formatted",
            ],
            "properties": {
                "bill_label": {"type": "string", "example": "Tagihan 1"},
                "period": {"type": "string", "example": "2026.1"},
                "bill_type": {"type": "string", "example": "UKT"},
                "status": {"type": "string", "enum": ["paid", "partial", "unpaid"], "example": "unpaid"},
                "amount": {"type": "integer", "example": 1850000},
                "amount_formatted": {"type": "string", "example": "Rp 1.850.000"},
                "paid_amount": {"type": "integer", "example": 0},
                "paid_amount_formatted": {"type": "string", "example": "Rp 0"},
                "remaining_amount": {"type": "integer", "example": 1850000},
                "remaining_amount_formatted": {"type": "string", "example": "Rp 1.850.000"},
                "payment_method": {"type": "string", "example": "BRIVA"},
                "briva": {"type": "string", "example": "1234567890"},
                "instructions": {"type": "string", "example": "Bayar melalui BRIVA BRI."},
                "due_date": {"type": "string", "example": "2026-09-10"},
                "due_date_formatted": {"type": "string", "example": "10 September 2026"},
            },
        },
        "LookupResponse": {
            "type": "object",
            "required": ["success", "data", "request_id"],
            "properties": {
                "success": {"type": "boolean", "example": True},
                "data": {
                    "type": "object",
                    "required": ["student", "bills", "payment_status"],
                    "properties": {
                        "student": {"$ref": "#/components/schemas/LookupStudentInfo"},
                        "bills": {
                            "type": "array",
                            "items": {"$ref": "#/components/schemas/LookupBillItem"},
                        },
                        "payment_status": {
                            "type": "string",
                            "enum": ["paid", "partial", "unpaid"],
                            "example": "unpaid",
                        },
                    },
                },
                "request_id": {"type": "string", "example": "req_01h7lookup"},
            },
        },
        "AdminLoginRequest": {
            "type": "object",
            "required": ["email", "password"],
            "properties": {
                "email": {"type": "string", "format": "email", "example": "admin@example.test"},
                "password": {"type": "string", "format": "password", "example": "secret"},
            },
        },
        "AdminAuthResponse": {
            "type": "object",
            "required": ["success", "data"],
            "properties": {
                "success": {"type": "boolean", "example": True},
                "data": {
                    "type": "object",
                    "required": ["email", "full_name", "role", "permissions"],
                    "properties": {
                        "email": {"type": "string", "example": "admin@example.test"},
                        "full_name": {"type": "string", "example": "Administrator"},
                        "role": {"type": "string", "example": "super_admin"},
                        "permissions": {
                            "type": "array",
                            "items": {"type": "string"},
                            "example": [
                                "import",
                                "manage_billing",
                                "manage_master_data",
                                "manage_students",
                                "view_billing",
                                "view_imports",
                                "view_master_data",
                                "view_reports",
                                "view_students",
                            ],
                        },
                    },
                },
            },
        },
        "ImportedBillGroupsResponse": {
            "type": "object",
            "required": ["success", "data"],
            "properties": {
                "success": {"type": "boolean", "example": True},
                "data": {
                    "type": "object",
                    "required": ["groups"],
                    "properties": {
                        "groups": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "source_file": {"type": "string"},
                                    "total_bills": {"type": "integer"},
                                    "total_amount": {"type": "integer"},
                                    "latest_imported_at": {"type": "string"},
                                },
                            },
                        }
                    },
                },
            },
        },
        "DeleteImportedFileRequest": {
            "type": "object",
            "required": ["file_name"],
            "properties": {
                "file_name": {"type": "string", "example": "Tagihan_2026.xlsx"},
                "reason": {"type": "string", "example": "Koreksi data massal"},
            },
        },
        "DeleteImportedFileResponse": {
            "type": "object",
            "required": ["success", "data"],
            "properties": {
                "success": {"type": "boolean", "example": True},
                "data": {
                    "type": "object",
                    "properties": {
                        "deleted": {"type": "boolean", "example": True},
                        "deleted_count": {"type": "integer", "example": 42},
                        "file_name": {"type": "string", "example": "Tagihan_2026.xlsx"},
                    },
                },
            },
        },
        "BillStatusUpdateRequest": {
            "type": "object",
            "required": ["bill_id", "status"],
            "properties": {
                "bill_id": {"type": "string", "example": "bill_01h..."},
                "status": {"type": "string", "enum": ["paid", "partial", "unpaid"], "example": "paid"},
                "paid_amount": {"type": "integer", "nullable": True, "example": 1850000},
                "payment_date": {"type": "string", "nullable": True, "example": "2026-08-31"},
                "reference_number": {"type": "string", "nullable": True, "example": "TRX-12345"},
                "notes": {"type": "string", "nullable": True, "example": "Lunas via transfer"},
            },
        },
        "BillDueDateUpdateRequest": {
            "type": "object",
            "properties": {
                "bill_id": {"type": "string", "nullable": True},
                "bill_ids": {"type": "array", "items": {"type": "string"}, "nullable": True},
                "due_date": {"type": "string", "description": "ISO format YYYY-MM-DD", "example": "2026-09-30"},
            },
        },
        "BillDueDateUpdateResponse": {
            "type": "object",
            "required": ["success", "data"],
            "properties": {
                "success": {"type": "boolean", "example": True},
                "data": {
                    "type": "object",
                    "required": ["updated_count", "bills"],
                    "properties": {
                        "updated_count": {"type": "integer", "example": 5},
                        "bills": {"type": "array", "items": {"type": "object"}},
                    },
                },
            },
        },
        "BillSingleResponse": {
            "type": "object",
            "required": ["success", "data"],
            "properties": {
                "success": {"type": "boolean", "example": True},
                "data": {
                    "type": "object",
                    "required": ["bill"],
                    "properties": {"bill": {"type": "object"}},
                },
            },
        },
        "BillsListResponse": {
            "type": "object",
            "required": ["success", "data"],
            "properties": {
                "success": {"type": "boolean", "example": True},
                "data": {
                    "type": "object",
                    "required": ["bills", "pagination", "summary"],
                    "properties": {
                        "bills": {"type": "array", "items": {"type": "object"}},
                        "pagination": {
                            "type": "object",
                            "properties": {
                                "total": {"type": "integer"},
                                "limit": {"type": "integer"},
                                "offset": {"type": "integer"},
                                "page": {"type": "integer"},
                                "total_pages": {"type": "integer"},
                            },
                        },
                        "summary": {"type": "object"},
                    },
                },
            },
        },
        "CreateBillRequest": {
            "type": "object",
            "required": ["nim", "amount", "period", "bill_type"],
            "properties": {
                "nim": {"type": "string", "example": "050117077"},
                "student_id": {"type": "string", "nullable": True},
                "amount": {"type": "integer", "example": 1850000},
                "period": {"type": "string", "example": "2026.1"},
                "bill_type": {"type": "string", "example": "UKT"},
                "payment_method": {"type": "string", "default": "BRIVA", "example": "BRIVA"},
                "briva": {"type": "string", "example": "1234567890"},
                "due_date": {"type": "string", "example": "2026-09-10"},
                "status": {"type": "string", "enum": ["paid", "partial", "unpaid"], "default": "unpaid"},
                "paid_amount": {"type": "integer", "default": 0},
                "instructions": {"type": "string"},
            },
        },
        "UpdateBillRequest": {
            "type": "object",
            "properties": {
                "amount": {"type": "integer"},
                "period": {"type": "string"},
                "bill_type": {"type": "string"},
                "briva": {"type": "string"},
                "due_date": {"type": "string"},
                "instructions": {"type": "string"},
            },
        },
        "BillDetailResponse": {
            "type": "object",
            "required": ["success", "data"],
            "properties": {
                "success": {"type": "boolean", "example": True},
                "data": {
                    "type": "object",
                    "properties": {
                        "bill": {"type": "object"},
                        "student": {"type": "object"},
                        "transactions": {"type": "array", "items": {"type": "object"}},
                    },
                },
            },
        },
        "DeleteBillResponse": {
            "type": "object",
            "required": ["success", "data"],
            "properties": {
                "success": {"type": "boolean", "example": True},
                "data": {
                    "type": "object",
                    "required": ["deleted", "bill"],
                    "properties": {
                        "deleted": {"type": "boolean", "example": True},
                        "bill": {"type": "object"},
                    },
                },
            },
        },
        "RecordPaymentRequest": {
            "type": "object",
            "required": ["amount"],
            "properties": {
                "amount": {"type": "integer", "example": 500000},
                "payment_date": {"type": "string", "example": "2026-08-31"},
                "reference_number": {"type": "string", "example": "REF-001"},
                "notes": {"type": "string", "example": "Bayar angsuran 1"},
                "payment_method": {"type": "string", "default": "BRIVA"},
            },
        },
        "RecordPaymentResponse": {
            "type": "object",
            "required": ["success", "data"],
            "properties": {
                "success": {"type": "boolean", "example": True},
                "data": {
                    "type": "object",
                    "properties": {
                        "bill": {"type": "object"},
                        "transaction": {"type": "object"},
                    },
                },
            },
        },
        "PaymentTransactionsResponse": {
            "type": "object",
            "required": ["success", "data"],
            "properties": {
                "success": {"type": "boolean", "example": True},
                "data": {
                    "type": "object",
                    "required": ["transactions", "total"],
                    "properties": {
                        "transactions": {"type": "array", "items": {"type": "object"}},
                        "total": {"type": "integer"},
                    },
                },
            },
        },
        "StudentListResponse": {
            "type": "object",
            "required": ["success", "data"],
            "properties": {
                "success": {"type": "boolean", "example": True},
                "data": {
                    "type": "object",
                    "required": ["students"],
                    "properties": {
                        "students": {"type": "array", "items": {"type": "object"}},
                    },
                },
            },
        },
        "CreateStudentRequest": {
            "type": "object",
            "required": ["nim", "full_name"],
            "properties": {
                "nim": {"type": "string", "example": "050117077"},
                "full_name": {"type": "string", "example": "Syahla Taqiyyah"},
                "study_program_id": {"type": "string"},
                "study_program_name": {"type": "string"},
                "no_ktp": {"type": "string"},
                "email": {"type": "string"},
                "phone_number": {"type": "string"},
                "academic_status": {"type": "string", "default": "aktif"},
                "entry_period": {"type": "string"},
                "entry_year": {"type": "integer"},
            },
        },
        "UpdateStudentRequest": {
            "type": "object",
            "properties": {
                "full_name": {"type": "string"},
                "study_program_id": {"type": "string"},
                "no_ktp": {"type": "string"},
                "email": {"type": "string"},
                "phone_number": {"type": "string"},
                "academic_status": {"type": "string"},
                "entry_period": {"type": "string"},
                "entry_year": {"type": "integer"},
            },
        },
        "StudentSingleResponse": {
            "type": "object",
            "required": ["success", "data"],
            "properties": {
                "success": {"type": "boolean", "example": True},
                "data": {
                    "type": "object",
                    "required": ["student"],
                    "properties": {"student": {"type": "object"}},
                },
            },
        },
        "DeleteStudentResponse": {
            "type": "object",
            "required": ["success", "data"],
            "properties": {
                "success": {"type": "boolean", "example": True},
                "data": {
                    "type": "object",
                    "required": ["deleted", "student"],
                    "properties": {
                        "deleted": {"type": "boolean", "example": True},
                        "student": {"type": "object"},
                    },
                },
            },
        },
        "Student360DetailResponse": {
            "type": "object",
            "required": ["success", "data"],
            "properties": {
                "success": {"type": "boolean", "example": True},
                "data": {
                    "type": "object",
                    "required": ["student", "summary", "bills"],
                    "properties": {
                        "student": {"type": "object"},
                        "summary": {"type": "object"},
                        "bills": {"type": "array", "items": {"type": "object"}},
                    },
                },
            },
        },
        "DashboardStatsResponse": {
            "type": "object",
            "required": ["success", "data"],
            "properties": {
                "success": {"type": "boolean", "example": True},
                "data": {
                    "type": "object",
                    "required": ["total_students", "total_bills", "total_receipts", "total_outstanding"],
                    "properties": {
                        "total_students": {"type": "integer"},
                        "total_bills": {"type": "integer"},
                        "total_receipts": {"type": "integer"},
                        "total_outstanding": {"type": "integer"},
                    },
                },
            },
        },
        "FinancialSummaryResponse": {
            "type": "object",
            "required": ["success", "data"],
            "properties": {
                "success": {"type": "boolean", "example": True},
                "data": {
                    "type": "object",
                    "required": ["summary", "rows"],
                    "properties": {
                        "summary": {"type": "object"},
                        "rows": {"type": "array", "items": {"type": "object"}},
                    },
                },
            },
        },
        "ImportIssuesResponse": {
            "type": "object",
            "required": ["success", "data"],
            "properties": {
                "success": {"type": "boolean", "example": True},
                "data": {
                    "type": "object",
                    "required": ["issues"],
                    "properties": {
                        "issues": {"type": "array", "items": {"type": "object"}},
                    },
                },
            },
        },
        "StudyProgramsListResponse": {
            "type": "object",
            "required": ["success", "data"],
            "properties": {
                "success": {"type": "boolean", "example": True},
                "data": {
                    "type": "object",
                    "required": ["study_programs"],
                    "properties": {
                        "study_programs": {"type": "array", "items": {"type": "object"}},
                    },
                },
            },
        },
        "CreateStudyProgramRequest": {
            "type": "object",
            "required": ["code", "name"],
            "properties": {
                "code": {"type": "string", "example": "HKM"},
                "name": {"type": "string", "example": "Ilmu Hukum"},
                "degree_level": {"type": "string", "default": "S1", "example": "S1"},
                "faculty": {"type": "string"},
            },
        },
        "UpdateStudyProgramRequest": {
            "type": "object",
            "properties": {
                "code": {"type": "string"},
                "name": {"type": "string"},
                "degree_level": {"type": "string"},
                "faculty": {"type": "string"},
            },
        },
        "StudyProgramSingleResponse": {
            "type": "object",
            "required": ["success", "data"],
            "properties": {
                "success": {"type": "boolean", "example": True},
                "data": {
                    "type": "object",
                    "required": ["study_program"],
                    "properties": {"study_program": {"type": "object"}},
                },
            },
        },
        "AcademicPeriodsListResponse": {
            "type": "object",
            "required": ["success", "data"],
            "properties": {
                "success": {"type": "boolean", "example": True},
                "data": {
                    "type": "object",
                    "required": ["academic_periods"],
                    "properties": {
                        "academic_periods": {"type": "array", "items": {"type": "object"}},
                    },
                },
            },
        },
        "CreateAcademicPeriodRequest": {
            "type": "object",
            "required": ["code", "name"],
            "properties": {
                "code": {"type": "string", "example": "2026.1"},
                "name": {"type": "string", "example": "Ganjil 2026/2027"},
                "is_active": {"type": "boolean", "default": True},
            },
        },
        "UpdateAcademicPeriodRequest": {
            "type": "object",
            "properties": {
                "code": {"type": "string"},
                "name": {"type": "string"},
                "is_active": {"type": "boolean"},
            },
        },
        "AcademicPeriodSingleResponse": {
            "type": "object",
            "required": ["success", "data"],
            "properties": {
                "success": {"type": "boolean", "example": True},
                "data": {
                    "type": "object",
                    "required": ["academic_period"],
                    "properties": {"academic_period": {"type": "object"}},
                },
            },
        },
        "ImportPreviewResponse": {
            "type": "object",
            "required": ["success", "data"],
            "properties": {
                "success": {"type": "boolean", "example": True},
                "data": {
                    "type": "object",
                    "required": [
                        "import_token",
                        "file_name",
                        "valid_rows",
                        "critical_rows",
                        "issue_rows",
                        "new_rows",
                        "update_rows",
                        "unchanged_rows",
                    ],
                    "properties": {
                        "import_token": {"type": "string", "example": "imp_0123456789abcdef0123456789abcdef"},
                        "file_name": {"type": "string", "example": "Data_Tagihan_2026.xlsx"},
                        "valid_rows": {"type": "integer"},
                        "critical_rows": {"type": "integer"},
                        "issue_rows": {"type": "integer"},
                        "new_rows": {"type": "integer"},
                        "update_rows": {"type": "integer"},
                        "unchanged_rows": {"type": "integer"},
                        "amount_change_rows": {"type": "integer"},
                        "briva_change_rows": {"type": "integer"},
                        "issues": {"type": "array", "items": {"type": "object"}},
                    },
                },
            },
        },
        "ImportCommitRequest": {
            "type": "object",
            "required": ["import_token"],
            "properties": {
                "import_token": {"type": "string", "example": "imp_0123456789abcdef0123456789abcdef"},
                "confirm_updates": {"type": "boolean", "default": False},
            },
        },
        "ImportCommitResponse": {
            "type": "object",
            "required": ["success", "data"],
            "properties": {
                "success": {"type": "boolean", "example": True},
                "data": {
                    "type": "object",
                    "required": ["imported_count", "file_name"],
                    "properties": {
                        "imported_count": {"type": "integer"},
                        "file_name": {"type": "string"},
                        "new_students": {"type": "integer"},
                        "updated_bills": {"type": "integer"},
                        "new_bills": {"type": "integer"},
                    },
                },
            },
        },
        "AuditLogListItem": {
            "type": "object",
            "required": ["id", "actor_name", "action", "entity_type", "metadata", "created_at"],
            "properties": {
                "id": {"type": "string"},
                "actor_id": {"type": ["string", "null"]},
                "actor_name": {"type": "string", "example": "Administrator SALUT"},
                "actor_role": {"type": ["string", "null"]},
                "action": {"type": "string", "example": "student.update"},
                "entity_type": {"type": "string", "example": "student"},
                "entity_id": {"type": ["string", "null"]},
                "metadata": {"type": "object", "additionalProperties": True},
                "created_at": {"type": "string", "example": "2026-08-31 08:00:00"},
            },
        },
        "AuditLogListResponse": {
            "type": "object",
            "required": ["success", "data"],
            "properties": {
                "success": {"type": "boolean", "example": True},
                "data": {
                    "type": "object",
                    "required": ["audit_logs", "pagination"],
                    "properties": {
                        "audit_logs": {
                            "type": "array",
                            "items": {"$ref": "#/components/schemas/AuditLogListItem"},
                        },
                        "pagination": {"$ref": "#/components/schemas/Pagination"},
                    },
                },
            },
        },
        "AdminUserListItem": {
            "type": "object",
            "required": ["id", "email", "full_name", "role", "is_active", "permissions", "created_at", "updated_at"],
            "properties": {
                "id": {"type": "string", "example": "usr_01h7abc123"},
                "email": {"type": "string", "example": "operator@salut.test"},
                "full_name": {"type": "string", "example": "Operator SALUT"},
                "role": {
                    "type": "string",
                    "enum": ["viewer", "admin_akademik", "admin_keuangan", "admin", "super_admin"],
                    "example": "admin",
                },
                "is_active": {"type": "boolean", "example": True},
                "permissions": {
                    "type": "array",
                    "items": {"type": "string"},
                    "example": ["manage_billing", "view_reports"],
                },
                "created_at": {"type": "string", "example": "2026-08-31 08:00:00"},
                "updated_at": {"type": "string", "example": "2026-08-31 08:00:00"},
            },
        },
        "CreateAdminUserRequest": {
            "type": "object",
            "required": ["email", "password"],
            "properties": {
                "email": {"type": "string", "example": "newadmin@salut.test"},
                "password": {"type": "string", "minLength": 8, "example": "SangatKuat-2026!"},
                "full_name": {"type": "string", "example": "Staff Keuangan"},
                "role": {
                    "type": "string",
                    "enum": ["viewer", "admin_akademik", "admin_keuangan", "admin", "super_admin"],
                    "default": "admin",
                },
                "is_active": {"type": "boolean", "default": True},
            },
        },
        "UpdateAdminUserRequest": {
            "type": "object",
            "properties": {
                "full_name": {"type": "string", "example": "Nama Baru"},
                "role": {
                    "type": "string",
                    "enum": ["viewer", "admin_akademik", "admin_keuangan", "admin", "super_admin"],
                },
                "is_active": {"type": "boolean"},
                "password": {"type": "string", "minLength": 8},
            },
        },
        "ResetAdminUserPasswordRequest": {
            "type": "object",
            "required": ["password"],
            "properties": {
                "password": {"type": "string", "minLength": 8, "example": "PasswordBaru-2026!"},
            },
        },
        "AdminUserSingleResponse": {
            "type": "object",
            "required": ["success", "data"],
            "properties": {
                "success": {"type": "boolean", "example": True},
                "data": {
                    "type": "object",
                    "required": ["user"],
                    "properties": {
                        "user": {"$ref": "#/components/schemas/AdminUserListItem"},
                    },
                },
            },
        },
        "AdminUserListResponse": {
            "type": "object",
            "required": ["success", "data"],
            "properties": {
                "success": {"type": "boolean", "example": True},
                "data": {
                    "type": "object",
                    "required": ["users"],
                    "properties": {
                        "users": {
                            "type": "array",
                            "items": {"$ref": "#/components/schemas/AdminUserListItem"},
                        },
                    },
                },
            },
        },
        "DeleteAdminUserResponse": {
            "type": "object",
            "required": ["success", "data"],
            "properties": {
                "success": {"type": "boolean", "example": True},
                "data": {
                    "type": "object",
                    "required": ["deleted"],
                    "properties": {
                        "deleted": {"type": "boolean", "example": True},
                    },
                },
            },
        },
        "ResetAdminUserPasswordResponse": {
            "type": "object",
            "required": ["success", "data"],
            "properties": {
                "success": {"type": "boolean", "example": True},
                "data": {
                    "type": "object",
                    "required": ["reset"],
                    "properties": {
                        "reset": {"type": "boolean", "example": True},
                    },
                },
            },
        },
    }

    openapi_schema = {
        "openapi": "3.1.0",
        "info": {
            "title": "Salut Cek Pembayaran",
            "version": APP_VERSION,
            "description": (
                "Academic Information and Billing Verification System API for SALUT. "
                "Provides public lookup endpoints for student tuition verification and "
                "role-protected administrative endpoints for student management, billing, "
                "reporting, and Excel ingestion."
            ),
        },
        "paths": paths,
        "components": {
            "securitySchemes": {
                "cookieAuth": {
                    "type": "apiKey",
                    "in": "cookie",
                    "name": "salut_admin_session",
                    "description": "Session cookie established upon successful login via /api/admin/login",
                }
            },
            "schemas": schemas,
        },
    }

    app.openapi_schema = openapi_schema
    return app.openapi_schema
