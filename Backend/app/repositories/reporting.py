"""Reporting repository aggregate queries layer."""

from __future__ import annotations

import sqlite3


class ReportingRepository:
    """Read-only aggregate queries for dashboard and financial reporting."""

    def __init__(self, connection: sqlite3.Connection) -> None:
        self._connection = connection

    def dashboard_counts(self) -> tuple[sqlite3.Row | None, sqlite3.Row | None]:
        """Aggregate total students, active count, total bills, and paid/unpaid financial amounts."""
        student_row = self._connection.execute(
            """
            select
              count(*) as total_students,
              sum(case when academic_status = 'aktif' then 1 else 0 end) as active_students
            from students
            where deleted_at is null
            """
        ).fetchone()
        bill_row = self._connection.execute(
            """
            select
              count(*) as total_bills,
              sum(case when b.status = 'paid' then 1 else 0 end) as paid_bills,
              sum(case when b.status = 'partial' then 1 else 0 end) as partial_bills,
              sum(case when b.status = 'unpaid' then 1 else 0 end) as unpaid_bills,
              coalesce(sum(b.amount), 0) as total_billed_amount,
              coalesce(
                sum(
                  case
                    when b.status = 'paid' then b.amount
                    when b.status = 'partial' then coalesce(b.paid_amount, 0)
                    else 0
                  end
                ),
                0
              ) as total_paid_amount
            from bills b
            join students s on s.id = b.student_id
            where b.deleted_at is null and s.deleted_at is null and coalesce(b.is_active, 1) = 1
            """
        ).fetchone()
        return student_row, bill_row

    def financial_rows(
        self,
        *,
        period: str,
        study_program_id: str,
        entry_period: str,
    ) -> tuple[list[sqlite3.Row], list[sqlite3.Row]]:
        """Query aggregated study program rows and individual student breakdown rows for financial reporting."""
        filter_sql, params = self._financial_filter(
            period=period,
            study_program_id=study_program_id,
            entry_period=entry_period,
        )
        program_rows = self._connection.execute(
            f"""
            select
              coalesce(sp.name, s.program_study, 'Lainnya') as program_study,
              count(distinct s.id) as total_students,
              count(b.id) as total_bills,
              coalesce(sum(b.amount), 0) as billed_amount,
              coalesce(
                sum(
                  case
                    when b.status = 'paid' then b.amount
                    when b.status = 'partial' then coalesce(b.paid_amount, 0)
                    else 0
                  end
                ),
                0
              ) as paid_amount
            from students s
            left join study_programs sp on sp.id = s.study_program_id
            join bills b on b.student_id = s.id
            {filter_sql}
            group by coalesce(sp.name, s.program_study, 'Lainnya')
            order by billed_amount desc
            """,
            params,
        ).fetchall()
        student_rows = self._connection.execute(
            f"""
            select
              s.id as student_id,
              s.nim,
              s.full_name,
              coalesce(s.phone_number, '-') as phone_number,
              coalesce(sp.name, s.program_study, 'Lainnya') as program_study,
              coalesce(nullif(s.entry_period, ''), nullif(s.initial_registration, ''), '-') as entry_period,
              count(b.id) as total_bills,
              coalesce(sum(b.amount), 0) as billed_amount,
              coalesce(
                sum(
                  case
                    when b.status = 'paid' then b.amount
                    when b.status = 'partial' then coalesce(b.paid_amount, 0)
                    else 0
                  end
                ),
                0
              ) as paid_amount
            from students s
            left join study_programs sp on sp.id = s.study_program_id
            join bills b on b.student_id = s.id
            {filter_sql}
            group by
              s.id,
              s.nim,
              s.full_name,
              coalesce(s.phone_number, '-'),
              coalesce(sp.name, s.program_study, 'Lainnya'),
              coalesce(nullif(s.entry_period, ''), nullif(s.initial_registration, ''), '-')
            order by billed_amount desc, s.full_name asc
            """,
            params,
        ).fetchall()
        return program_rows, student_rows

    @staticmethod
    def _financial_filter(
        *,
        period: str,
        study_program_id: str,
        entry_period: str,
    ) -> tuple[str, list[object]]:
        where_clauses = ["s.deleted_at is null", "b.deleted_at is null"]
        params: list[object] = []
        if period:
            where_clauses.append(
                """(
                    b.period = ?
                    or exists (
                        select 1 from academic_periods ap
                        where (ap.code = ? or ap.name = ? or lower(ap.name) = lower(?) or lower(ap.code) = lower(?))
                          and (
                            b.period = ap.code
                            or b.period = ap.name
                            or lower(b.period) = lower(ap.code)
                            or lower(b.period) = lower(ap.name)
                            or lower(b.period) = lower(replace(ap.name, 'Periode ', ''))
                            or lower(ap.name) like '%' || lower(b.period) || '%'
                            or lower(b.period) like '%' || lower(replace(ap.name, 'Periode ', '')) || '%'
                          )
                    )
                )"""
            )
            params.extend([period, period, period, period, period])
        if study_program_id:
            where_clauses.append("(s.study_program_id = ? or sp.id = ?)")
            params.extend([study_program_id, study_program_id])
        if entry_period:
            where_clauses.append("(s.entry_period = ? or s.initial_registration like ?)")
            params.extend([entry_period, f"%{entry_period}%"])
        return "where " + " and ".join(where_clauses), params
