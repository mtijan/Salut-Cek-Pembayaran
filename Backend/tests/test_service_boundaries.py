from __future__ import annotations

from Backend.app import services
from Backend.app.services import billing, billing_commands, billing_queries
from Backend.tests.test_base import BackendBaseTestCase


class ServiceBoundaryTests(BackendBaseTestCase):
    def test_billing_facade_preserves_public_service_exports(self) -> None:
        query_exports = (
            "bill_filter_clause",
            "count_bills",
            "get_bill_detail",
            "get_bills_summary",
            "list_bills",
            "list_import_issues",
            "list_imported_bill_groups",
        )
        command_exports = (
            "create_bill",
            "delete_bill",
            "delete_imported_bill_group",
            "record_bill_payment",
            "update_bill",
            "update_bill_due_date",
            "update_bill_status",
        )

        for name in query_exports:
            with self.subTest(name=name):
                implementation = getattr(billing_queries, name)
                self.assertIs(getattr(billing, name), implementation)
                self.assertIs(getattr(services, name), implementation)

        for name in command_exports:
            with self.subTest(name=name):
                implementation = getattr(billing_commands, name)
                self.assertIs(getattr(billing, name), implementation)
                self.assertIs(getattr(services, name), implementation)

        self.assertIs(services.sanitize_filename, billing.sanitize_filename)
