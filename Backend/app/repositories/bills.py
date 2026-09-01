"""Bill repository data access layer."""

from __future__ import annotations

import sqlite3
from typing import cast

from Backend.app.domain.billing import joined_bill_select
from Backend.excel_reader import normalize_text


class BillRepository:
    """Data access object for querying and mutating student billing records."""

    def __init__(self, connection: sqlite3.Connection) -> None:
        self._connection = connection

    def list_active_for_public_lookup(self, student_id: str) -> list[sqlite3.Row]:
        """Retrieve active billing rows for public lookup by student UUID."""
        return self._connection.execute(
            """
            select briva, amount, coalesce(paid_amount, 0) as paid_amount,
                   period, bill_type, status, payment_method, instructions, due_date
            from bills
            where student_id = ? and deleted_at is null
            order by period desc, created_at asc, briva asc
            """,
            (student_id,),
        ).fetchall()

    def list_recent_transactions_for_public_lookup(
        self,
        student_id: str,
        limit: int = 50,
    ) -> list[sqlite3.Row]:
        """Retrieve a bounded, privacy-minimized payment history for public lookup."""
        bounded_limit = max(1, min(int(limit or 50), 50))
        return self._connection.execute(
            """
            select pt.transaction_type, pt.amount, pt.payment_date, pt.payment_method,
                   b.bill_type, b.briva
            from payment_transactions pt
            left join bills b on b.id = pt.bill_id
            where coalesce(pt.student_id, b.student_id) = ?
            order by pt.payment_date desc, pt.created_at desc, pt.rowid desc
            limit ?
            """,
            (student_id, bounded_limit),
        ).fetchall()

    def find_by_id(self, bill_id: str) -> sqlite3.Row | None:
        """Find an active bill record by UUID primary key."""
        return self._connection.execute(
            f"{joined_bill_select()} where b.id = ? and b.deleted_at is null and s.deleted_at is null",
            (bill_id,),
        ).fetchone()

    def find_by_briva(self, briva: str) -> sqlite3.Row | None:
        """Find an active bill by BRIVA number."""
        return self._connection.execute(
            "select id, student_id, briva, amount, status from bills where briva = ? and deleted_at is null",
            (briva,),
        ).fetchone()

    def list_admin(
        self,
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
    ) -> list[sqlite3.Row]:
        """Retrieve paginated billing records matching multi-criteria filters and custom sorting."""
        limit = max(1, min(int(limit or 2000), 5000))
        offset = max(0, int(offset or 0))
        where, params = self._build_filter_clause(
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

        return self._connection.execute(
            f"""
            {joined_bill_select()}
            {where}
            {order_clause}
            limit ? offset ?
            """,
            (*params, limit, offset),
        ).fetchall()

    def count_admin(
        self,
        query: str = "",
        status: str = "",
        source: str = "",
        study_program_id: str = "",
        period: str = "",
        bill_type: str = "",
        entry_period: str = "",
    ) -> int:
        """Count total bills matching given filter criteria."""
        where, params = self._build_filter_clause(
            query=query,
            status=status,
            source=source,
            study_program_id=study_program_id,
            period=period,
            bill_type=bill_type,
            entry_period=entry_period,
        )
        row = self._connection.execute(
            f"""
            select count(*) as total
            from bills b
            join students s on s.id = b.student_id
            {where}
            """,
            params,
        ).fetchone()
        return int(row["total"] if row else 0)

    def get_summary_stats(
        self,
        query: str = "",
        status: str = "",
        source: str = "",
        study_program_id: str = "",
        period: str = "",
        bill_type: str = "",
        entry_period: str = "",
    ) -> sqlite3.Row | None:
        """Calculate summary statistics for filtered billing records."""
        where, params = self._build_filter_clause(
            query=query,
            status=status,
            source=source,
            study_program_id=study_program_id,
            period=period,
            bill_type=bill_type,
            entry_period=entry_period,
        )
        return self._connection.execute(
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

    def list_imported_groups_rows(self) -> list[sqlite3.Row]:
        """Retrieve active imported bills for grouping."""
        return self._connection.execute(
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

    def soft_delete(self, bill_id: str, actor_id: str | None = None, reason: str = "") -> sqlite3.Row | None:
        """Soft-delete an active bill."""
        row = self._connection.execute(
            "select id, briva, amount from bills where id = ? and deleted_at is null", (bill_id,)
        ).fetchone()
        if row:
            self._connection.execute(
                """
                update bills
                set deleted_at = datetime('now'), deleted_by = ?, delete_reason = ?, updated_at = datetime('now')
                where id = ?
                """,
                (actor_id, reason, bill_id),
            )
        return cast(sqlite3.Row | None, row)

    def _build_filter_clause(
        self,
        query: str = "",
        status: str = "",
        source: str = "",
        study_program_id: str = "",
        period: str = "",
        bill_type: str = "",
        entry_period: str = "",
    ) -> tuple[str, list[object]]:
        """Construct SQL WHERE clause and parameter list for billing queries."""
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
