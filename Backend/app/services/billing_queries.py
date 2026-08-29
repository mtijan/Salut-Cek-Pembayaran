"""Read-only billing queries and list projections."""

from __future__ import annotations

from pathlib import Path
from typing import cast

from Backend.app import config
from Backend.app.domain.billing import bill_row_to_dict, joined_bill_select
from Backend.app.domain.students import student_row_to_dict
from Backend.app.services.audit import list_payment_transactions
from Backend.db import database_connection
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


def get_bill_detail(db_path: str | Path, bill_id: str) -> dict[str, object] | None:
    with database_connection(db_path) as conn:
        row = conn.execute(
            f"{joined_bill_select()} where b.id = ? and b.deleted_at is null and s.deleted_at is null",
            (bill_id,),
        ).fetchone()
        if not row:
            return None

        student_id = str(row["student_id"])
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
