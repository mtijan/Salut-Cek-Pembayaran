"""Stable billing service facade.

Read queries and transactional commands live in separate modules. Existing
callers can keep importing this module or ``Backend.app.services``.
"""

from Backend.app.domain.files import sanitize_filename as sanitize_filename
from Backend.app.services.billing_commands import (
    create_bill as create_bill,
    delete_bill as delete_bill,
    delete_imported_bill_group as delete_imported_bill_group,
    record_bill_payment as record_bill_payment,
    update_bill as update_bill,
    update_bill_due_date as update_bill_due_date,
    update_bill_status as update_bill_status,
)
from Backend.app.services.billing_queries import (
    bill_filter_clause as bill_filter_clause,
    count_bills as count_bills,
    get_bill_detail as get_bill_detail,
    get_bills_summary as get_bills_summary,
    list_bills as list_bills,
    list_import_issues as list_import_issues,
    list_imported_bill_groups as list_imported_bill_groups,
)

__all__ = [
    "bill_filter_clause",
    "count_bills",
    "create_bill",
    "delete_bill",
    "delete_imported_bill_group",
    "get_bill_detail",
    "get_bills_summary",
    "list_bills",
    "list_import_issues",
    "list_imported_bill_groups",
    "record_bill_payment",
    "sanitize_filename",
    "update_bill",
    "update_bill_due_date",
    "update_bill_status",
]
