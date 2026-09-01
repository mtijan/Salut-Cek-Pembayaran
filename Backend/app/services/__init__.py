"""
Backend.app.services – backward-compatibility re-export shim.

All public symbols are re-exported from their respective domain slice modules
so that existing callers (main.py, import_excel.py, test suite) can continue
to import from ``Backend.app.services`` without any change.
"""

from __future__ import annotations

from Backend.app.services.audit import (  # noqa: F401
    list_payment_transactions,
    payment_transaction_target_exists,
    record_payment_transaction,
    write_audit,
    write_lookup_log,
)
from Backend.app.services.auth import (  # noqa: F401
    authenticate_admin,
    claim_import_preview_for_admin,
    consume_import_preview_claim,
    create_admin_session,
    delete_admin_session,
    delete_import_preview,
    find_admin_by_session,
    get_import_preview_for_admin,
    list_import_preview_issues,
    release_import_preview_claim,
    store_import_preview,
)
from Backend.app.services.billing import (  # noqa: F401
    bill_filter_clause,
    bulk_update_bill_activation,
    count_bills,
    count_import_issues,
    create_bill,
    delete_bill,
    delete_imported_bill_group,
    get_bill_detail,
    get_bills_summary,
    list_bills,
    list_import_issues,
    list_imported_bill_groups,
    preview_bill_activation,
    record_bill_payment,
    sanitize_filename,
    update_bill,
    update_bill_activation,
    update_bill_due_date,
    update_bill_status,
)
from Backend.app.services.master_data import (  # noqa: F401
    create_academic_period,
    create_study_program,
    delete_study_program,
    get_dashboard_stats,
    get_financial_summary,
    list_academic_periods,
    list_study_programs,
    update_academic_period,
    update_study_program,
)
from Backend.app.services.students import (  # noqa: F401
    create_student,
    delete_student,
    ensure_student,
    get_student_detail,
    list_students,
    require_delete_reason,
    update_student,
)
from Backend.app.services.system import (  # noqa: F401
    cleanup_operational_data,
    cleanup_stale_imports,
    ensure_database,
    validate_runtime_configuration,
)
from Backend.app.services.users import (  # noqa: F401
    create_admin_user,
    delete_admin_user,
    get_admin_user,
    list_admin_users,
    reset_admin_password,
    update_admin_user,
)

# Re-export domain helpers that main.py imports from services for convenience.
from Backend.app.domain.billing import bill_row_to_dict, summarize_payment_status  # noqa: F401
from Backend.app.domain.common import format_due_date  # noqa: F401
from Backend.app.domain.students import student_row_to_dict, validate_nim_value  # noqa: F401

# Expose config so callers that access services.config continue to work.
from Backend.app import config  # noqa: F401
