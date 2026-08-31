"""Student repository data access layer."""

from __future__ import annotations

import sqlite3
from typing import cast

from Backend.excel_reader import normalize_text


class StudentRepository:
    """Data access object for querying and mutating student profiles."""

    def __init__(self, connection: sqlite3.Connection) -> None:
        self._connection = connection

    def find_active_for_public_lookup(self, nim: str) -> sqlite3.Row | None:
        """Find active student record by unique NIM for public lookup."""
        return self._connection.execute(
            """
            select id, nim, full_name, program_study
            from students
            where nim = ? and deleted_at is null
            """,
            (nim,),
        ).fetchone()

    def find_by_id(self, student_id: str) -> sqlite3.Row | None:
        """Find a student by ID."""
        return self._connection.execute(
            """
            select s.id, s.nim, s.full_name, s.name_norm, s.no_ktp, s.tempat_lahir, s.tanggal_lahir, s.nama_ibu_kandung,
                   s.program_study, s.study_program_id, s.academic_status,
                   s.entry_year, s.entry_semester, s.entry_period,
                   s.email, s.address, s.phone_number, s.initial_registration, s.created_at, s.updated_at,
                   sp.name as study_program_name, sp.code as study_program_code, sp.degree as study_program_degree
            from students s
            left join study_programs sp on sp.id = s.study_program_id
            where s.id = ? and s.deleted_at is null
            """,
            (student_id,),
        ).fetchone()

    def find_by_nim(self, nim: str) -> sqlite3.Row | None:
        """Find a student by unique NIM."""
        return self._connection.execute(
            """
            select id, nim, full_name, deleted_at
            from students
            where nim = ?
            """,
            (nim,),
        ).fetchone()

    def find_duplicate_nim(self, nim: str, exclude_id: str) -> sqlite3.Row | None:
        """Find duplicate NIM excluding a specific student ID."""
        return self._connection.execute(
            """
            select id from students where nim = ? and id <> ?
            """,
            (nim, exclude_id),
        ).fetchone()

    def list_admin(
        self,
        query: str = "",
        limit: int = 2000,
        study_program_id: str = "",
        academic_status: str = "",
        entry_year: int | None = None,
        entry_period: str = "",
        sort_by: str = "",
    ) -> list[sqlite3.Row]:
        """List students with dynamic filters, search, and sorting."""
        search = normalize_text(query)
        limit = max(1, min(int(limit or 2000), 5000))
        params: list[object] = []
        where_clauses = ["s.deleted_at is null"]
        if search:
            where_clauses.append(
                "(s.nim like ? or s.full_name like ? or s.program_study like ? or sp.name like ? or sp.code like ? or s.no_ktp like ? or s.email like ? or s.phone_number like ?)"
            )
            params.extend([f"%{search}%"] * 8)
        if study_program_id:
            where_clauses.append(
                "(s.study_program_id = ? or sp.code = ? or lower(s.program_study) = lower(?) or lower(sp.name) = lower(?))"
            )
            params.extend([study_program_id.strip()] * 4)
        if academic_status:
            where_clauses.append("s.academic_status = ?")
            params.append(academic_status.lower().strip())
        if entry_year is not None and str(entry_year).isdigit():
            where_clauses.append("s.entry_year = ?")
            params.append(int(entry_year))
        if entry_period:
            where_clauses.append("(s.entry_period = ? or s.initial_registration like ?)")
            params.extend([entry_period.strip(), f"%{entry_period.strip()}%"])

        order_by = "order by s.nim asc"
        if sort_by == "entry_period_asc":
            order_by = "order by s.entry_period asc nulls last, s.nim asc"
        elif sort_by == "entry_period_desc":
            order_by = "order by s.entry_period desc nulls last, s.nim asc"
        elif sort_by == "name_asc":
            order_by = "order by s.full_name asc"
        elif sort_by == "updated_at_desc":
            order_by = "order by s.updated_at desc"

        where = "where " + " and ".join(where_clauses)
        return self._connection.execute(
            f"""
            select s.id, s.nim, s.full_name, s.no_ktp, s.tempat_lahir, s.tanggal_lahir, s.nama_ibu_kandung,
                   s.program_study, s.study_program_id, s.academic_status,
                   s.entry_year, s.entry_semester, s.entry_period,
                   s.email, s.address, s.phone_number, s.initial_registration,
                   sp.name as study_program_name, sp.code as study_program_code,
                   count(b.id) as bill_count, coalesce(sum(b.amount), 0) as total_amount
            from students s
            left join study_programs sp on sp.id = s.study_program_id
            left join bills b on b.student_id = s.id and b.deleted_at is null
            {where}
            group by s.id, s.nim, s.full_name, s.no_ktp, s.tempat_lahir, s.tanggal_lahir, s.nama_ibu_kandung,
                     s.program_study, s.study_program_id, s.academic_status, s.entry_year, s.entry_semester, s.entry_period,
                     s.email, s.address, s.phone_number, s.initial_registration, sp.name, sp.code
            {order_by}
            limit ?
            """,
            (*params, limit),
        ).fetchall()

    def get_bills_for_student(self, student_id: str) -> list[sqlite3.Row]:
        """Retrieve active bills for a student."""
        from Backend.app.domain.billing import joined_bill_select

        return self._connection.execute(
            f"""
            {joined_bill_select()}
            where b.student_id = ? and b.deleted_at is null
            order by b.created_at desc, b.period desc
            """,
            (student_id,),
        ).fetchall()

    def soft_delete(self, student_id: str, actor_id: str | None = None, reason: str = "") -> sqlite3.Row | None:
        """Soft-delete a student and cascade soft deletion to associated active bills."""
        row = self._connection.execute(
            "select id, nim, full_name from students where id = ? and deleted_at is null", (student_id,)
        ).fetchone()
        if row:
            self._connection.execute(
                """
                update students
                set deleted_at = datetime('now'), deleted_by = ?, delete_reason = ?, updated_at = datetime('now')
                where id = ?
                """,
                (actor_id, reason, student_id),
            )
            self._connection.execute(
                """
                update bills
                set deleted_at = datetime('now'), deleted_by = ?, delete_reason = ?, updated_at = datetime('now')
                where student_id = ? and deleted_at is null
                """,
                (actor_id, reason, student_id),
            )
        return cast(sqlite3.Row | None, row)
