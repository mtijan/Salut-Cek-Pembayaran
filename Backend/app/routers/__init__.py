"""FastAPI route slices composed by the application entry point.

This package contains modular route definitions separated by domain:
- lookup: Public student billing lookup endpoint
- auth: Admin authentication and session management
- billing: Admin billing, payment recording, and transaction ledger
- students: Student management and Student 360 profile
- reports: Dashboard statistics and financial summary reports
- master_data: Study programs and academic periods management
- imports: Excel workbook preview, validation, and ingestion
"""

from Backend.app.routers.auth import build_auth_router
from Backend.app.routers.billing import build_billing_router
from Backend.app.routers.imports import build_import_router
from Backend.app.routers.lookup import build_lookup_router
from Backend.app.routers.master_data import build_master_data_router
from Backend.app.routers.reports import build_report_router
from Backend.app.routers.students import build_student_router
from Backend.app.routers.users import build_user_router

__all__ = [
    "build_auth_router",
    "build_billing_router",
    "build_import_router",
    "build_lookup_router",
    "build_master_data_router",
    "build_report_router",
    "build_student_router",
    "build_user_router",
]
