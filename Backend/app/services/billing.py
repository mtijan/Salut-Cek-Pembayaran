"""Billing slice – bill CRUD, filter, import groups, status/due-date bulk updates, and payment recording."""

from __future__ import annotations

import sqlite3
import uuid
from pathlib import Path
from typing import cast

from Backend.app import config
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
from Backend.app.domain.files import sanitize_filename as sanitize_filename  # re-export
from Backend.app.services import audit as _audit
from Backend.app.services.audit import list_payment_transactions, record_payment_transaction
from Backend.app.services.students import ensure_student, require_delete_reason
from Backend.db import connect, database_connection, database_transaction
from Backend.excel_reader import normalize_text


def bill_filter_clause(
    query: str = "",
    status: str = "",
    source: str = "",
    study_program_id: str = "",
    period: str = "",
    bill_type: str = "",
    entry_period: str = "",
) -> tuple[str, list[object]]:
    search = normalize_text(query)
    normalized_status = normalize_text(status).lower()
    normalized_source = normalize_text(source).lower()
    normalized_prodi = normalize_text(study_program_id)
    normalized_period = normalize_text(period)
    normalized_type = normalize_text(bill_type)
    normalized_entry_period = normalize_text(entry_period)
    params: list[object] = []
    where_clauses = ["b.deleted_at is null", "s.deleted_at is null"]
    if search:
        where_clauses.append(
            "(s.nim like ? or s.full_name like ? or b.briva like ? or b.period like ? or b.bill_type like ?)"
        )
        params.extend([f"%{search}%", f"%{search}%", f"%{search}%", f"%{search}%", f"%{search}%"])
    if normalized_status:
        where_clauses.append("b.status = ?")
        params.append(normalized_status)
    if normalized_source == "manual":
        where_clauses.append("lower(trim(b.source_file)) in ('manual', 'manual admin')")
    elif normalized_source == "import":
        where_clauses.append("lower(trim(b.source_file)) not in ('manual', 'manual admin')")
    if normalized_prodi:
        where_clauses.append("s.study_program_id = ?")
        params.append(normalized_prodi)
    if normalized_period:
        where_clauses.append("b.period = ?")
        params.append(normalized_period)
    if normalized_type:
        where_clauses.append("b.bill_type = ?")
        params.append(normalized_type)
    if normalized_entry_period:
        where_clauses.append("(s.entry_period = ? or s.initial_registration like ?)")
        params.extend([normalized_entry_period, f"%{normalized_entry_period}%"])
    return "where " + " and ".join(where_clauses), params


def list_bills(
    db_path: str | Path = config.DB_PATH,
    query: str = "",
    limit: int = 2000,
    offset: int = 0,
    status: str = "",
    source: str = "",
    study_program_id: str = "",
    period: str = "",
    bill_type: str = "",
    sort_by: str = "",
    entry_period: str = "",
) -> list[dict[str, object]]:
    limit = max(1, min(int(limit or 2000), 5000))
    offset = max(0, int(offset or 0))
    where, params = bill_filter_clause(
        query=query,
        status=status,
        source=source,
        study_program_id=study_program_id,
        period=period,
        bill_type=bill_type,
        entry_period=entry_period,
    )

    sort_order_map = {
        "updated_desc": "order by b.updated_at desc, b.created_at desc",
        "updated_asc": "order by b.updated_at asc, b.created_at asc",
        "created_desc": "order by b.created_at desc, b.rowid desc",
        "created_asc": "order by b.created_at asc, b.rowid asc",
        "amount_desc": "order by b.amount desc",
        "amount_asc": "order by b.amount asc",
        "due_date_asc": "order by case when b.due_date is null or b.due_date = '' then 1 else 0 end, b.due_date asc",
        "due_date_desc": "order by b.due_date desc",
        "nim_asc": "order by s.nim asc",
        "name_asc": "order by s.full_name asc",
    }
    order_clause = sort_order_map.get(sort_by, "order by b.updated_at desc, b.created_at desc")

    with database_connection(db_path) as conn:
        rows = conn.execute(
            f"""
            {joined_bill_select()}
            {where}
            {order_clause}
            limit ? offset ?
            """,
            (*params, limit, offset),
        ).fetchall()
    return [bill_row_to_dict(row) for row in rows]


def count_bills(
    db_path: str | Path = config.DB_PATH,
    query: str = "",
    status: str = "",
    source: str = "",
    study_program_id: str = "",
    period: str = "",
    bill_type: str = "",
    entry_period: str = "",
) -> int:
    where, params = bill_filter_clause(
        query=query,
        status=status,
        source=source,
        study_program_id=study_program_id,
        period=period,
        bill_type=bill_type,
        entry_period=entry_period,
    )
    with database_connection(db_path) as conn:
        row = conn.execute(
            f"""
            select count(*) as total
            from bills b
            join students s on s.id = b.student_id
            {where}
            """,
            params,
        ).fetchone()
    return int(row["total"] if row else 0)


def get_bills_summary(
    db_path: str | Path = config.DB_PATH,
    query: str = "",
    status: str = "",
    source: str = "",
    study_program_id: str = "",
    period: str = "",
    bill_type: str = "",
    entry_period: str = "",
) -> dict[str, int]:
    where, params = bill_filter_clause(
        query=query,
        status=status,
        source=source,
        study_program_id=study_program_id,
        period=period,
        bill_type=bill_type,
        entry_period=entry_period,
    )
    with database_connection(db_path) as conn:
        row = conn.execute(
            f"""
            select
                count(b.id) as total_count,
                count(distinct b.student_id) as student_count,
                coalesce(sum(b.amount), 0) as total_amount,
                coalesce(sum(b.paid_amount), 0) as total_paid,
                coalesce(sum(case when b.status = 'paid' then 1 else 0 end), 0) as paid_count,
                coalesce(sum(case when b.status = 'partial' then 1 else 0 end), 0) as partial_count,
                coalesce(sum(case when b.status = 'unpaid' then 1 else 0 end), 0) as unpaid_count
            from bills b
            join students s on s.id = b.student_id
            {where}
            """,
            params,
        ).fetchone()

    if not row:
        return {
            "total_count": 0,
            "student_count": 0,
            "total_amount": 0,
            "total_paid": 0,
            "total_remaining": 0,
            "paid_count": 0,
            "partial_count": 0,
            "unpaid_count": 0,
        }

    total_amount = int(row["total_amount"] or 0)
    total_paid = int(row["total_paid"] or 0)
    return {
        "total_count": int(row["total_count"] or 0),
        "student_count": int(row["student_count"] or 0),
        "total_amount": total_amount,
        "total_paid": total_paid,
        "total_remaining": max(0, total_amount - total_paid),
        "paid_count": int(row["paid_count"] or 0),
        "partial_count": int(row["partial_count"] or 0),
        "unpaid_count": int(row["unpaid_count"] or 0),
    }


def list_import_issues(db_path: str | Path = config.DB_PATH, limit: int = 500) -> list[dict[str, object]]:
    limit = max(1, min(int(limit or 500), 2000))
    with database_connection(db_path) as conn:
        rows = conn.execute(
            """
            select id, source_file, sheet_name, row_number, nim, full_name, briva, amount, note, created_at
            from import_issues
            order by created_at desc, source_file asc, row_number asc
            limit ?
            """,
            (limit,),
        ).fetchall()
    return [dict(row) for row in rows]


def create_bill(db_path: str | Path, payload: dict[str, object], actor_id: str | None = None) -> sqlite3.Row:
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


def get_bill_detail(db_path: str | Path, bill_id: str) -> dict[str, object] | None:
    with database_connection(db_path) as conn:
        row = conn.execute(
            f"{joined_bill_select()} where b.id = ? and b.deleted_at is null and s.deleted_at is null",
            (bill_id,),
        ).fetchone()
        if not row:
            return None

        student_id = str(row["student_id"])
        from Backend.app.domain.students import student_row_to_dict

        student = conn.execute(
            """
            select s.id, s.nim, s.full_name, s.no_ktp, s.tempat_lahir, s.tanggal_lahir, s.nama_ibu_kandung,
                   s.program_study, s.study_program_id, s.academic_status,
                   s.entry_year, s.entry_semester, s.entry_period,
                   s.email, s.address, s.phone_number, s.initial_registration, s.created_at,
                   sp.name as study_program_name, sp.code as study_program_code
            from students s
            left join study_programs sp on sp.id = s.study_program_id
            where s.id = ? and s.deleted_at is null
            """,
            (student_id,),
        ).fetchone()

    bill_dict = bill_row_to_dict(row)
    tx_res = list_payment_transactions(db_path, bill_id=bill_id, limit=50, offset=0)

    return {
        "bill": bill_dict,
        "student": student_row_to_dict(student) if student else None,
        "transactions": tx_res["transactions"],
        "pagination": tx_res["pagination"],
    }


def record_bill_payment(
    db_path: str | Path,
    bill_id: str,
    payload: dict[str, object],
    actor_id: str | None = None,
) -> dict[str, object]:
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


def list_imported_bill_groups(db_path: str | Path = config.DB_PATH) -> list[dict[str, object]]:
    with database_connection(db_path) as conn:
        rows = conn.execute(
            """
            select b.id, b.briva, b.amount, b.period, b.bill_type, b.status, b.payment_method, b.due_date, b.created_at,
                   b.source_file, b.source_row_number, s.nim, s.full_name
            from bills b
            join students s on s.id = b.student_id
            where b.deleted_at is null
              and s.deleted_at is null
              and lower(trim(b.source_file)) not in ('manual', 'manual admin')
            order by b.source_file desc, s.nim asc, b.source_row_number asc, b.created_at asc, b.briva asc
            """
        ).fetchall()

    groups: list[dict[str, object]] = []
    by_file: dict[str, dict[str, object]] = {}
    for row in rows:
        source_file = str(row["source_file"])
        group = by_file.get(source_file)
        if group is None:
            group = {
                "file_name": source_file,
                "total": 0,
                "student_count": 0,
                "total_amount": 0,
                "imported_at": str(row["created_at"]),
                "paid": 0,
                "partial": 0,
                "unpaid": 0,
                "bills": [],
                "_student_nims": set(),
            }
            by_file[source_file] = group
            groups.append(group)
        bills = group["bills"]
        assert isinstance(bills, list)
        bills.append(bill_row_to_dict(row))
        group["total"] = cast(int, group["total"]) + 1
        group["total_amount"] = cast(int, group["total_amount"]) + int(row["amount"])
        imported_at = str(row["created_at"])
        if imported_at < str(group["imported_at"]):
            group["imported_at"] = imported_at
        student_nims = group["_student_nims"]
        assert isinstance(student_nims, set)
        student_nims.add(str(row["nim"]))
        if row["status"] == "paid":
            group["paid"] = cast(int, group["paid"]) + 1
        elif row["status"] == "partial":
            group["partial"] = cast(int, group["partial"]) + 1
        else:
            group["unpaid"] = cast(int, group["unpaid"]) + 1
    for group in groups:
        student_nims = group.pop("_student_nims")
        assert isinstance(student_nims, set)
        group["student_count"] = len(student_nims)
    groups.sort(key=lambda group: str(group["imported_at"]), reverse=True)
    return groups


def delete_imported_bill_group(
    db_path: str | Path,
    source_file: object,
    actor_id: str | None = None,
    reason: str = "",
) -> dict[str, object] | None:
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
    if not bill_ids:
        return []
    due_date_str = str(due_date or "").strip()
    if due_date_str:
        parts = due_date_str.split("-")
        if len(parts) != 3 or not all(p.isdigit() for p in parts):
            raise ValueError("Format tanggal harus YYYY-MM-DD.")

    with database_transaction(db_path) as conn:
        placeholders = ",".join("?" for _ in bill_ids)
        conn.execute(
            f"update bills set due_date = ?, updated_at = datetime('now') where deleted_at is null and id in ({placeholders})",
            (due_date_str or None, *bill_ids),
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
