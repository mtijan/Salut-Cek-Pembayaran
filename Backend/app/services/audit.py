"""Audit & payment ledger slice – append-only write_audit, record_payment_transaction, and query helpers."""

from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from Backend.app import config
from Backend.app.domain.common import rupiah
from Backend.app.security import digest
from Backend.db import database_connection, database_transaction


def write_lookup_log(nim: str, name: str, result_type: str) -> None:
    """Record a hashed audit entry of a public student billing lookup attempt."""
    with database_transaction(config.DB_PATH) as conn:
        conn.execute(
            """
            insert into lookup_logs (id, nim_hash, name_hash, result_type)
            values (?, ?, ?, ?)
            """,
            (str(uuid.uuid4()), digest(nim), digest(name), result_type),
        )


def write_audit(
    conn: sqlite3.Connection,
    actor_id: str | None,
    action: str,
    entity_type: str,
    entity_id: str | None,
    metadata: dict[str, object] | None = None,
) -> None:
    """Write an immutable audit log entry for administrative actions within a database transaction."""
    # Service-level callers (imports/tests/system jobs) may not have an
    # admin_users row. Preserve the audit event as a system event instead of
    # failing and rolling back an otherwise valid transaction on FK checking.
    if actor_id and not conn.execute("select 1 from admin_users where id = ?", (actor_id,)).fetchone():
        actor_id = None
    conn.execute(
        """
        insert into audit_logs (id, actor_id, action, entity_type, entity_id, metadata)
        values (?, ?, ?, ?, ?, ?)
        """,
        (str(uuid.uuid4()), actor_id, action, entity_type, entity_id, json.dumps(metadata or {}, ensure_ascii=False)),
    )


def record_payment_transaction(
    conn: sqlite3.Connection,
    bill_id: str,
    student_id: str,
    old_status: str,
    new_status: str,
    old_paid: int,
    new_paid: int,
    recorded_by: str | None = None,
    payment_method: str | None = None,
    payment_date: str | None = None,
    reference_number: str | None = None,
    notes: str | None = None,
    source: str = "manual",
) -> None:
    """Record a payment state change as an append-only transaction log entry."""
    delta = new_paid - old_paid
    if delta == 0 and old_status == new_status:
        return  # No actual change, skip recording

    if delta > 0:
        tx_type = "payment"
    elif delta < 0:
        tx_type = "reversal"
    else:
        tx_type = "correction"

    # WIB is UTC+07:00 year-round, so an explicit fixed offset avoids relying
    # on OS/tzdata availability while keeping server-independent dates.
    today = payment_date or datetime.now(timezone(timedelta(hours=7))).date().isoformat()
    admin_id_val = recorded_by
    if admin_id_val:
        row = conn.execute("select id from admin_users where id = ?", (admin_id_val,)).fetchone()
        if not row:
            admin_id_val = None

    conn.execute(
        """
        insert into payment_transactions
            (id, bill_id, student_id, transaction_type, amount, running_paid_total,
             previous_status, new_status, payment_date, payment_method,
             reference_number, notes, recorded_by, source)
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            str(uuid.uuid4()),
            bill_id,
            student_id,
            tx_type,
            delta,
            new_paid,
            old_status,
            new_status,
            today,
            payment_method,
            reference_number,
            notes,
            admin_id_val,
            source,
        ),
    )


def list_payment_transactions(
    db_path: str | Path = config.DB_PATH,
    bill_id: str | None = None,
    student_id: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, object]:
    """Retrieve paginated payment transactions filtered by bill_id or student_id."""
    conditions = []
    params: list[object] = []
    if bill_id:
        conditions.append("pt.bill_id = ?")
        params.append(bill_id)
    if student_id:
        conditions.append("(pt.student_id = ? or b.student_id = ?)")
        params.extend([student_id, student_id])

    where = f"where {' and '.join(conditions)}" if conditions else ""

    with database_connection(db_path) as conn:
        count_row = conn.execute(
            f"select count(*) as cnt from payment_transactions pt left join bills b on b.id = pt.bill_id {where}",
            params,
        ).fetchone()
        total = int(count_row["cnt"]) if count_row else 0

        rows = conn.execute(
            f"""
            select pt.id, pt.bill_id, coalesce(pt.student_id, b.student_id) as student_id,
                   pt.transaction_type, pt.amount,
                   pt.running_paid_total, pt.previous_status, pt.new_status,
                   pt.payment_date, pt.payment_method, pt.reference_number, pt.notes,
                   pt.recorded_by, pt.source, pt.created_at,
                   au.full_name as recorded_by_name,
                   b.briva, s.nim, s.full_name as student_name
            from payment_transactions pt
            left join admin_users au on au.id = pt.recorded_by
            left join bills b on b.id = pt.bill_id
            left join students s on s.id = coalesce(pt.student_id, b.student_id)
            {where}
            order by pt.created_at desc, pt.rowid desc
            limit ? offset ?
            """,
            (*params, limit, offset),
        ).fetchall()

    transactions = []
    for r in rows:
        tx = {
            "id": r["id"],
            "bill_id": r["bill_id"],
            "student_id": r["student_id"],
            "transaction_type": r["transaction_type"],
            "amount": r["amount"],
            "amount_formatted": rupiah(abs(r["amount"])),
            "running_paid_total": r["running_paid_total"],
            "running_paid_total_formatted": rupiah(r["running_paid_total"]),
            "previous_status": r["previous_status"],
            "new_status": r["new_status"],
            "payment_date": r["payment_date"],
            "payment_method": r["payment_method"],
            "reference_number": r["reference_number"],
            "notes": r["notes"],
            "recorded_by": r["recorded_by"],
            "recorded_by_name": r["recorded_by_name"],
            "source": r["source"],
            "created_at": r["created_at"],
            "briva": r["briva"],
            "nim": r["nim"],
            "student_name": r["student_name"],
        }
        transactions.append(tx)

    return {
        "transactions": transactions,
        "pagination": {"total": total, "limit": limit, "offset": offset},
    }


def payment_transaction_target_exists(
    db_path: str | Path,
    bill_id: str | None = None,
    student_id: str | None = None,
) -> bool:
    """Return whether the active bill or student requested by a history route exists."""
    if bool(bill_id) == bool(student_id):
        raise ValueError("Tentukan tepat satu target riwayat pembayaran.")

    with database_connection(db_path) as conn:
        if bill_id:
            row = conn.execute(
                "select 1 from bills where id = ? and deleted_at is null",
                (bill_id,),
            ).fetchone()
        else:
            row = conn.execute(
                "select 1 from students where id = ? and deleted_at is null",
                (student_id,),
            ).fetchone()
        return row is not None
