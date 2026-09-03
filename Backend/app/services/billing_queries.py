"""Read-only billing queries and list projections with repository delegation."""

from __future__ import annotations

from pathlib import Path
from typing import cast

from Backend.app import config
from Backend.app.domain.billing import bill_row_to_dict
from Backend.app.domain.common import escape_like_query
from Backend.app.domain.students import student_row_to_dict
from Backend.app.repositories.bills import BillRepository
from Backend.app.repositories.students import StudentRepository
from Backend.app.services.audit import list_payment_transactions
from Backend.db import database_connection


def bill_filter_clause(
    query: str = "",
    status: str = "",
    source: str = "",
    study_program_id: str = "",
    period: str = "",
    bill_type: str = "",
    entry_period: str = "",
    activation: str = "",
) -> tuple[str, list[object]]:
    """Construct SQL WHERE clause and parameter list for billing queries (compatibility helper)."""
    with database_connection(":memory:") as conn:
        return BillRepository(conn)._build_filter_clause(
            query=query,
            status=status,
            source=source,
            study_program_id=study_program_id,
            period=period,
            bill_type=bill_type,
            entry_period=entry_period,
            activation=activation,
        )


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
    activation: str = "",
) -> list[dict[str, object]]:
    """Retrieve paginated billing records matching multi-criteria filters and custom sorting."""
    with database_connection(db_path) as conn:
        rows = BillRepository(conn).list_admin(
            query=query,
            limit=limit,
            offset=offset,
            status=status,
            source=source,
            study_program_id=study_program_id,
            period=period,
            bill_type=bill_type,
            sort_by=sort_by,
            entry_period=entry_period,
            activation=activation,
        )
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
    activation: str = "",
) -> int:
    """Count the total number of bills matching given filter criteria."""
    with database_connection(db_path) as conn:
        return BillRepository(conn).count_admin(
            query=query,
            status=status,
            source=source,
            study_program_id=study_program_id,
            period=period,
            bill_type=bill_type,
            entry_period=entry_period,
            activation=activation,
        )


def get_bills_summary(
    db_path: str | Path = config.DB_PATH,
    query: str = "",
    status: str = "",
    source: str = "",
    study_program_id: str = "",
    period: str = "",
    bill_type: str = "",
    entry_period: str = "",
    activation: str = "",
) -> dict[str, int]:
    """Calculate financial and status distribution summary for filtered billing records."""
    with database_connection(db_path) as conn:
        row = BillRepository(conn).get_summary_stats(
            query=query,
            status=status,
            source=source,
            study_program_id=study_program_id,
            period=period,
            bill_type=bill_type,
            entry_period=entry_period,
            activation=activation,
        )

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


def _import_issue_filter(
    *, batch_id: str = "", severity: str = "", resolution_status: str = "", query: str = ""
) -> tuple[str, list[object]]:
    clauses: list[str] = []
    params: list[object] = []
    if batch_id.strip():
        clauses.append("i.batch_id = ?")
        params.append(batch_id.strip())
    if severity.strip():
        normalized = severity.strip().casefold()
        if normalized not in {"warning", "critical"}:
            raise ValueError("Severity issue tidak valid.")
        clauses.append("i.severity = ?")
        params.append(normalized)
    if resolution_status.strip():
        normalized_status = resolution_status.strip().casefold()
        if normalized_status not in {"open", "resolved", "ignored"}:
            raise ValueError("Status penyelesaian issue tidak valid.")
        clauses.append("i.resolution_status = ?")
        params.append(normalized_status)
    if query.strip():
        escaped_query = escape_like_query(query.strip())
        clauses.append(
            "(i.nim like ? escape '\\' or i.full_name like ? escape '\\' or i.briva like ? escape '\\' or i.amount like ? escape '\\' or i.issue_code like ? escape '\\' or i.note like ? escape '\\')"
        )
        like = f"%{escaped_query}%"
        params.extend([like, like, like, like, like, like])
    return (" where " + " and ".join(clauses) if clauses else ""), params


def list_import_issues(
    db_path: str | Path = config.DB_PATH,
    limit: int = 500,
    *,
    offset: int = 0,
    batch_id: str = "",
    severity: str = "",
    resolution_status: str = "",
    query: str = "",
) -> list[dict[str, object]]:
    """Retrieve recorded import validation warnings and anomalies."""
    limit = max(1, min(int(limit or 500), 2000))
    offset = max(0, int(offset or 0))
    where, params = _import_issue_filter(
        batch_id=batch_id,
        severity=severity,
        resolution_status=resolution_status,
        query=query,
    )
    with database_connection(db_path) as conn:
        rows = conn.execute(
            f"""
            select i.id, i.batch_id, i.source_file, i.period_code, i.sheet_name, i.row_number,
                   i.severity, i.issue_code, i.nim, i.full_name, i.briva, i.amount, i.note,
                   i.resolution_status, i.resolved_at, i.resolution_note, i.created_at,
                   b.period_label, b.status as batch_status
            from import_issues i
            left join import_batches b on b.id = i.batch_id
            {where}
            order by case i.severity when 'critical' then 0 else 1 end,
                     i.created_at desc, i.source_file asc, i.row_number asc
            limit ? offset ?
            """,
            (*params, limit, offset),
        ).fetchall()
    return [dict(row) for row in rows]


def count_import_issues(
    db_path: str | Path = config.DB_PATH,
    *,
    batch_id: str = "",
    severity: str = "",
    resolution_status: str = "",
    query: str = "",
) -> int:
    """Count import issues using the same filter contract as the paginated list."""
    where, params = _import_issue_filter(
        batch_id=batch_id,
        severity=severity,
        resolution_status=resolution_status,
        query=query,
    )
    with database_connection(db_path) as conn:
        return int(conn.execute(f"select count(*) from import_issues i {where}", params).fetchone()[0])


def get_bill_detail(db_path: str | Path, bill_id: str) -> dict[str, object] | None:
    """Fetch complete billing record details, including student biographical data and payment history."""
    with database_connection(db_path) as conn:
        row = BillRepository(conn).find_by_id(bill_id)
        if not row:
            return None

        student_id = str(row["student_id"])
        student = StudentRepository(conn).find_by_id(student_id)

    bill_dict = bill_row_to_dict(row)
    tx_res = list_payment_transactions(db_path, bill_id=bill_id, limit=50, offset=0)

    return {
        "bill": bill_dict,
        "student": student_row_to_dict(student) if student else None,
        "transactions": tx_res["transactions"],
        "pagination": tx_res["pagination"],
    }


def list_imported_bill_groups(db_path: str | Path = config.DB_PATH) -> list[dict[str, object]]:
    """Group and summarize active billing records by imported spreadsheet filename."""
    with database_connection(db_path) as conn:
        rows = BillRepository(conn).list_imported_groups_rows()

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
