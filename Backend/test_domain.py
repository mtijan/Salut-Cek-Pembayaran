from __future__ import annotations

import unittest

from Backend.app import services
from Backend.app.domain.billing import summarize_payment_status, validate_paid_amount
from Backend.app.domain.common import format_due_date, rupiah
from Backend.app.domain.files import sanitize_filename
from Backend.app.domain.students import validate_nim_value


class DomainBoundaryTests(unittest.TestCase):
    def test_legacy_service_exports_point_to_domain_helpers(self) -> None:
        self.assertIs(services.validate_nim_value, validate_nim_value)
        self.assertIs(services.summarize_payment_status, summarize_payment_status)
        self.assertIs(services.sanitize_filename, sanitize_filename)

    def test_common_presenters_keep_existing_indonesian_output(self) -> None:
        self.assertEqual(rupiah(1_250_000), "Rp 1.250.000")
        self.assertEqual(format_due_date("2026-08-26"), "26 Agustus 2026")

    def test_student_and_billing_validation_are_independent_of_database(self) -> None:
        self.assertEqual(validate_nim_value("050-117 077"), "050117077")
        self.assertEqual(validate_paid_amount("250.000", 1_000_000, "partial"), 250_000)
        with self.assertRaises(ValueError):
            validate_paid_amount(1_000_000, 1_000_000, "partial")


if __name__ == "__main__":
    unittest.main()
