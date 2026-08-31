"""Transactional billing commands and payment mutations."""

from __future__ import annotations

import sqlite3
import uuid
from pathlib import Path

from Backend.app.domain.billing import (
    bill_row_to_dict,
    joined_bill_select,
    normalize_status_value,
    validate_amount,
    validate_due_date_value,
    validate_paid_amount,
    validate_payment_metadata,
)
from Backend.app.domain.common import rupiah
from Backend.app.services import audit as _audit
from Backend.app.services.audit import list_payment_transactions, record_payment_transaction
from Backend.app.services.students import ensure_student, require_delete_reason
from Backend.db import connect, database_transaction
from Backend.excel_reader import normalize_text


def create_bill(db_path: str | Path, payload: dict[str, object], actor_id: str | None = None) -> sqlite3.Row:
    """Create a new billing record with validation, payment transaction recording, and audit logging."""
    briva = normalize_text(payload.get("briva"))
    raw_period = normalize_text(payload.get("period"))
    bill_type = normalize_text(payload.get("bill_type")) or "UKT"
    payment_method = normalize_text(payload.get("payment_method")) or "BRIVA"
    if not briva:
        raise ValueError("Nomor BRIVA wajib diisi.")
    if not raw_period:
        raise ValueError("Periode pembayaran wajib diisi.")
    amount = validate_amount(payload.get("amount"))
    status = normalize_status_value(payload.get("status"))
    paid_amount = validate_paid_amount(payload.get("paid_amount"), amount, status)
    due_date = validate_due_date_value(payload.get("due_date"))
    instructions = (
        normalize_text(payload.get("instructions")) or "Bayar melalui BRIVA BRI dengan nomor BRIVA yang tampil."
    )
    payment_date, reference_number, notes = validate_payment_metadata(
        payload.get("payment_date"), payload.get("reference_number"), payload.get("notes")
    )

    conn = connect(db_path)
    try:
        with conn:
            from Backend.db import ensure_academic_period

            period = ensure_academic_period(conn, raw_period) or raw_period

            student_id = normalize_text(payload.get("student_id"))
            if student_id:
                student = conn.execute(
                    "select id, nim, full_name from students where id = ? and deleted_at is null", (student_id,)
                ).fetchone()
                if not student:
                    raise ValueError("Mahasiswa yang dipilih tidak ditemukan.")
            else:
                student = ensure_student(conn, payload.get("nim"), payload.get("full_name"))

            bill_id = str(uuid.uuid4())
            conn.execute(
                """
                insert into bills
                  (id, student_id, briva, amount, paid_amount, period, bill_type, status, payment_method, instructions, due_date, source_file)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    bill_id,
                    student["id"],
                    briva,
                    amount,
                    paid_amount,
                    period,
                    bill_type,
                    status,
                    payment_method,
                    instructions,
                    due_date,
                    "Manual Admin",
                ),
            )
            if status != "unpaid":
                record_payment_transaction(
                    conn,
                    bill_id,
                    student["id"],
                    "unpaid",
                    status,
                    0,
                    paid_amount,
                    recorded_by=actor_id,
                    payment_method=payment_method,
                    payment_date=payment_date,
                    reference_number=reference_number,
                    notes=notes,
                    source="manual",
                )
            bill = conn.execute(f"{joined_bill_select()} where b.id = ?", (bill_id,)).fetchone()
            if actor_id:
                _audit.write_audit(
                    conn, actor_id, "bill.create", "bill", bill_id, {"nim": bill["nim"], "briva": bill["briva"]}
                )
            return bill
    finally:
        conn.close()


def update_bill(
    db_path: str | Path, bill_id: str, payload: dict[str, object], actor_id: str | None = None
) -> sqlite3.Row | None:
    """Update an existing billing record and record associated payment delta transactions."""
    briva = normalize_text(payload.get("briva"))
    raw_period = normalize_text(payload.get("period"))
    bill_type = normalize_text(payload.get("bill_type")) or "UKT"
    payment_method = normalize_text(payload.get("payment_method")) or "BRIVA"
    if not briva:
        raise ValueError("Nomor BRIVA wajib diisi.")
    if not raw_period:
        raise ValueError("Periode pembayaran wajib diisi.")
    amount = validate_amount(payload.get("amount"))
    status = normalize_status_value(payload.get("status"))
    paid_amount = validate_paid_amount(payload.get("paid_amount"), amount, status)
    due_date = validate_due_date_value(payload.get("due_date"))
    instructions = (
        normalize_text(payload.get("instructions")) or "Bayar melalui BRIVA BRI dengan nomor BRIVA yang tampil."
    )
    payment_date, reference_number, notes = validate_payment_metadata(
        payload.get("payment_date"), payload.get("reference_number"), payload.get("notes")
    )

    conn = connect(db_path)
    try:
        with conn:
            current = conn.execute(
                "select id, student_id, status, paid_amount, payment_method from bills where id = ? and deleted_at is null",
                (bill_id,),
            ).fetchone()
            if not current:
                return None

            old_status = str(current["status"] or "unpaid")
            old_paid = int(current["paid_amount"] or 0)
            student_id = str(current["student_id"])

            from Backend.db import ensure_academic_period

            period = ensure_academic_period(conn, raw_period) or raw_period

            conn.execute(
                """
                update bills
                set briva = ?, amount = ?, paid_amount = ?, period = ?, bill_type = ?, status = ?,
                    payment_method = ?, instructions = ?, due_date = ?, updated_at = datetime('now')
                where id = ?
                """,
                (
                    briva,
                    amount,
                    paid_amount,
                    period,
                    bill_type,
                    status,
                    payment_method,
                    instructions,
                    due_date,
                    bill_id,
                ),
            )

            record_payment_transaction(
                conn,
                bill_id=bill_id,
                student_id=student_id,
                old_status=old_status,
                new_status=status,
                old_paid=old_paid,
                new_paid=paid_amount,
                recorded_by=actor_id,
                payment_method=payment_method,
                payment_date=payment_date,
                reference_number=reference_number,
                notes=notes,
                source="manual",
            )

            bill = conn.execute(f"{joined_bill_select()} where b.id = ?", (bill_id,)).fetchone()
            if actor_id:
                _audit.write_audit(
                    conn, actor_id, "bill.update", "bill", bill_id, {"nim": bill["nim"], "briva": bill["briva"]}
                )
            return bill
    finally:
        conn.close()


def record_bill_payment(
    db_path: str | Path,
    bill_id: str,
    payload: dict[str, object],
    actor_id: str | None = None,
) -> dict[str, object]:
    """Record an incremental payment towards a bill, update status, and append to transaction ledger."""
    conn = connect(db_path)
    try:
        with conn:
            row = conn.execute(
                f"{joined_bill_select()} where b.id = ? and b.deleted_at is null and s.deleted_at is null",
                (bill_id,),
            ).fetchone()
            if not row:
                raise ValueError("Tagihan tidak ditemukan.")

            amount = int(row["amount"])
            old_paid = int(row["paid_amount"] or 0)
            old_status = str(row["status"] or "unpaid")
            student_id = str(row["student_id"])
            remaining = max(0, amount - old_paid)

            if remaining <= 0 or old_status == "paid":
                raise ValueError("Tagihan ini sudah lunas.")

            raw_payment_amount = payload.get("payment_amount")
            if raw_payment_amount is None or str(raw_payment_amount).strip() == "":
                raise ValueError("Nominal pembayaran transaksi wajib diisi.")

            payment_amount = validate_amount(raw_payment_amount)
            if payment_amount <= 0:
                raise ValueError("Nominal pembayaran transaksi harus lebih dari 0.")
            if payment_amount > remaining:
                raise ValueError(
                    f"Nominal pembayaran ({rupiah(payment_amount)}) melebihi sisa tagihan ({rupiah(remaining)})."
                )

            new_paid = old_paid + payment_amount
            new_status = "paid" if new_paid >= amount else "partial"

            payment_date, reference_number, notes = validate_payment_metadata(
                payload.get("payment_date"), payload.get("reference_number"), payload.get("notes")
            )
            payment_method = normalize_text(payload.get("payment_method")) or str(row["payment_method"] or "BRIVA")

            conn.execute(
                "update bills set status = ?, paid_amount = ?, updated_at = datetime('now') where id = ?",
                (new_status, new_paid, bill_id),
            )

            record_payment_transaction(
                conn,
                bill_id=bill_id,
                student_id=student_id,
                old_status=old_status,
                new_status=new_status,
                old_paid=old_paid,
                new_paid=new_paid,
                recorded_by=actor_id,
                payment_method=payment_method,
                payment_date=payment_date,
                reference_number=reference_number,
                notes=notes,
                source="manual",
            )

            updated = conn.execute(
                f"{joined_bill_select()} where b.id = ? and b.deleted_at is null and s.deleted_at is null",
                (bill_id,),
            ).fetchone()

            if actor_id:
                _audit.write_audit(
                    conn,
                    actor_id,
                    "bill.payment",
                    "bill",
                    bill_id,
                    {
                        "payment_amount": payment_amount,
                        "old_paid": old_paid,
                        "new_paid": new_paid,
                        "status": new_status,
                        "briva": updated["briva"],
                        "nim": updated["nim"],
                        "payment_method": payment_method,
                        "reference_number": reference_number,
                    },
                )
    finally:
        conn.close()

    tx_res = list_payment_transactions(db_path, bill_id=bill_id, limit=50, offset=0)
    return {
        "bill": bill_row_to_dict(updated),
        "transactions": tx_res["transactions"],
    }


def delete_bill(db_path: str | Path, bill_id: str, actor_id: str | None = None, reason: str = "") -> sqlite3.Row | None:
    """Soft delete a bill record with mandatory audit deletion reason."""
    reason = require_delete_reason(reason)
    conn = connect(db_path)
    try:
        with conn:
            row = conn.execute(f"{joined_bill_select()} where b.id = ? and b.deleted_at is null", (bill_id,)).fetchone()
            if row:
                conn.execute(
                    """
                    update bills
                    set deleted_at = datetime('now'), deleted_by = ?, delete_reason = ?, updated_at = datetime('now')
                    where id = ?
                    """,
                    (actor_id, reason, bill_id),
                )
                if actor_id:
                    _audit.write_audit(
                        conn,
                        actor_id,
                        "bill.delete",
                        "bill",
                        bill_id,
                        {"nim": row["nim"], "briva": row["briva"], "reason": reason},
                    )
        return row
    finally:
        conn.close()


def delete_imported_bill_group(
    db_path: str | Path,
    source_file: object,
    actor_id: str | None = None,
    reason: str = "",
) -> dict[str, object] | None:
    """Soft delete all bills associated with an imported Excel workbook file."""
    file_name = normalize_text(source_file)
    if not file_name:
        raise ValueError("Nama file wajib diisi.")
    if file_name.casefold() in {"manual", "manual admin"}:
        raise ValueError("Data Manual Admin bukan data import per file.")
    delete_reason = require_delete_reason(reason)

    conn = connect(db_path)
    try:
        with conn:
            rows = conn.execute(
                """
                select id
                from bills
                where source_file = ? and deleted_at is null
                """,
                (file_name,),
            ).fetchall()
            if not rows:
                return None
            conn.execute(
                """
                update bills
                set deleted_at = datetime('now'), deleted_by = ?, delete_reason = ?, updated_at = datetime('now')
                where source_file = ? and deleted_at is null
                """,
                (actor_id, delete_reason, file_name),
            )
            conn.execute("delete from import_issues where source_file = ?", (file_name,))
            if actor_id:
                _audit.write_audit(
                    conn,
                    actor_id,
                    "import_file.delete",
                    "import_file",
                    file_name,
                    {"reason": delete_reason, "deleted_bills": len(rows)},
                )
        return {"file_name": file_name, "deleted_bills": len(rows)}
    finally:
        conn.close()


def update_bill_status(
    db_path: str | Path,
    bill_id: str,
    status: str,
    paid_amount: object = None,
    recorded_by: str | None = None,
    payment_date: object = None,
    reference_number: object = None,
    notes: object = None,
) -> sqlite3.Row | None:
    """Update overall bill payment status, adjust paid amount, and log the state transition transaction."""
    if status not in {"paid", "partial", "unpaid"}:
        raise ValueError("Status hanya boleh paid, partial, atau unpaid.")
    normalized_payment_date, normalized_reference_number, normalized_notes = validate_payment_metadata(
        payment_date, reference_number, notes
    )

    conn = connect(db_path)
    try:
        with conn:
            row = conn.execute(
                f"{joined_bill_select()} where b.id = ? and b.deleted_at is null and s.deleted_at is null",
                (bill_id,),
            ).fetchone()
            if not row:
                updated = None
            else:
                old_status = str(row["status"])
                old_paid = int(row["paid_amount"] or 0)
                amount = int(row["amount"])
                student_id = str(row["student_id"])
                if status == "paid":
                    new_paid = amount
                elif status == "unpaid":
                    new_paid = 0
                else:
                    new_paid = validate_paid_amount(paid_amount, amount, "partial")

                conn.execute(
                    "update bills set status = ?, paid_amount = ?, updated_at = datetime('now') where id = ?",
                    (status, new_paid, bill_id),
                )

                record_payment_transaction(
                    conn,
                    bill_id=bill_id,
                    student_id=student_id,
                    old_status=old_status,
                    new_status=status,
                    old_paid=old_paid,
                    new_paid=new_paid,
                    recorded_by=recorded_by,
                    payment_method=str(row["payment_method"] or ""),
                    payment_date=normalized_payment_date,
                    reference_number=normalized_reference_number,
                    notes=normalized_notes,
                    source="manual",
                )

                updated = conn.execute(
                    f"{joined_bill_select()} where b.id = ? and b.deleted_at is null and s.deleted_at is null",
                    (bill_id,),
                ).fetchone()
                if recorded_by:
                    _audit.write_audit(
                        conn,
                        recorded_by,
                        "bill.status_update",
                        "bill",
                        bill_id,
                        {
                            "status": status,
                            "paid_amount": updated["paid_amount"],
                            "briva": updated["briva"],
                            "nim": updated["nim"],
                        },
                    )
    finally:
        conn.close()
    return updated


def update_bill_due_date(
    db_path: str | Path, bill_ids: list[str], due_date: str | None, actor_id: str | None = None
) -> list[sqlite3.Row]:
    """Batch update due dates across multiple active billing records."""
    if not bill_ids:
        return []
    due_date_str = validate_due_date_value(due_date)

    with database_transaction(db_path) as conn:
        placeholders = ",".join("?" for _ in bill_ids)
        conn.execute(
            f"update bills set due_date = ?, updated_at = datetime('now') where deleted_at is null and id in ({placeholders})",
            (due_date_str, *bill_ids),
        )
        updated = conn.execute(
            f"""
            select b.id, b.briva, b.amount, b.period, b.bill_type, b.status, b.payment_method, b.due_date,
                   b.source_file, b.source_row_number, s.nim, s.full_name
            from bills b
            join students s on s.id = b.student_id
            where b.deleted_at is null and s.deleted_at is null and b.id in ({placeholders})
            """,
            (*bill_ids,),
        ).fetchall()
        if actor_id:
            for row in updated:
                _audit.write_audit(
                    conn,
                    actor_id,
                    "bill.due_date_update",
                    "bill",
                    row["id"],
                    {"due_date": row["due_date"], "briva": row["briva"], "nim": row["nim"]},
                )
    return list(updated)
