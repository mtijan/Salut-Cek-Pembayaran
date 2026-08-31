"""Master data repository data access layer for Study Programs and Academic Periods."""

from __future__ import annotations

import sqlite3
import uuid


class StudyProgramRepository:
    """Data access object for querying and mutating study program master data."""

    def __init__(self, connection: sqlite3.Connection) -> None:
        self._connection = connection

    def list_all_active_with_counts(self) -> list[sqlite3.Row]:
        """Retrieve active study programs with aggregate student counts."""
        return self._connection.execute(
            """
            select sp.id, sp.code, sp.name, sp.degree, sp.faculty, sp.is_active, sp.created_at, sp.updated_at,
                   count(distinct s.id) as student_count
            from study_programs sp
            left join students s on (
                s.study_program_id = sp.id
                or (
                    s.study_program_id is null
                    and trim(coalesce(s.program_study, '')) <> ''
                    and lower(trim(s.program_study)) = lower(trim(sp.name))
                )
            ) and s.deleted_at is null
            where sp.is_active = 1
            group by sp.id, sp.code, sp.name, sp.degree, sp.faculty, sp.is_active, sp.created_at, sp.updated_at
            order by sp.name asc
            """
        ).fetchall()

    def find_by_id(self, program_id: str) -> sqlite3.Row | None:
        """Find a study program by UUID primary key."""
        return self._connection.execute(
            """
            select id, code, name, degree, faculty, is_active, created_at, updated_at
            from study_programs
            where id = ?
            """,
            (program_id,),
        ).fetchone()

    def find_by_code(self, code: str, exclude_id: str | None = None) -> sqlite3.Row | None:
        """Find a study program by unique program code."""
        if exclude_id:
            return self._connection.execute(
                """
                select id, code, name, degree, faculty, is_active, created_at, updated_at
                from study_programs
                where upper(code) = upper(?) and id <> ?
                """,
                (code, exclude_id),
            ).fetchone()
        return self._connection.execute(
            """
            select id, code, name, degree, faculty, is_active, created_at, updated_at
            from study_programs
            where upper(code) = upper(?)
            """,
            (code,),
        ).fetchone()

    def create(
        self,
        code: str,
        name: str,
        degree: str = "S1",
        faculty: str | None = None,
        is_active: int = 1,
    ) -> sqlite3.Row:
        """Create a new study program record."""
        program_id = f"sp_{uuid.uuid4().hex[:12]}"
        self._connection.execute(
            """
            insert into study_programs (id, code, name, degree, faculty, is_active, updated_at)
            values (?, ?, ?, ?, ?, ?, datetime('now'))
            """,
            (program_id, code.upper(), name, degree, faculty, is_active),
        )
        row = self.find_by_id(program_id)
        assert row is not None
        return row

    def update(
        self,
        program_id: str,
        code: str,
        name: str,
        degree: str,
        faculty: str | None,
        is_active: int,
    ) -> sqlite3.Row | None:
        """Update an existing study program record."""
        self._connection.execute(
            """
            update study_programs
            set code = ?, name = ?, degree = ?, faculty = ?, is_active = ?, updated_at = datetime('now')
            where id = ?
            """,
            (code, name, degree, faculty, is_active, program_id),
        )
        return self.find_by_id(program_id)

    def soft_deactivate(self, program_id: str) -> bool:
        """Deactivate a study program preserving FK integrity."""
        cursor = self._connection.execute(
            """
            update study_programs
            set is_active = 0, updated_at = datetime('now')
            where id = ? and is_active = 1
            """,
            (program_id,),
        )
        return cursor.rowcount > 0


class AcademicPeriodRepository:
    """Data access object for querying and mutating academic period master data."""

    def __init__(self, connection: sqlite3.Connection) -> None:
        self._connection = connection

    def list_all(self) -> list[sqlite3.Row]:
        """Retrieve all registered academic periods ordered by code descending."""
        return self._connection.execute(
            """
            select id, code, name, semester_type, is_active, default_due_date, created_at, updated_at
            from academic_periods
            order by code desc
            """
        ).fetchall()

    def find_by_id(self, period_id: str) -> sqlite3.Row | None:
        """Find an academic period by UUID primary key."""
        return self._connection.execute(
            """
            select id, code, name, semester_type, is_active, default_due_date, created_at, updated_at
            from academic_periods
            where id = ?
            """,
            (period_id,),
        ).fetchone()

    def find_by_code(self, code: str, exclude_id: str | None = None) -> sqlite3.Row | None:
        """Find an academic period by period code."""
        if exclude_id:
            return self._connection.execute(
                """
                select id, code, name, semester_type, is_active, default_due_date, created_at, updated_at
                from academic_periods
                where code = ? and id <> ?
                """,
                (code, exclude_id),
            ).fetchone()
        return self._connection.execute(
            """
            select id, code, name, semester_type, is_active, default_due_date, created_at, updated_at
            from academic_periods
            where code = ?
            """,
            (code,),
        ).fetchone()

    def deactivate_all_active(self, exclude_id: str | None = None) -> None:
        """Deactivate active academic periods."""
        if exclude_id:
            self._connection.execute(
                "update academic_periods set is_active = 0 where id <> ?",
                (exclude_id,),
            )
        else:
            self._connection.execute("update academic_periods set is_active = 0")

    def create(
        self,
        code: str,
        name: str,
        semester_type: str = "ganjil",
        is_active: int = 0,
        default_due_date: str | None = None,
    ) -> sqlite3.Row:
        """Create a new academic period record."""
        period_id = f"prd_{uuid.uuid4().hex[:12]}"
        if is_active == 1:
            self.deactivate_all_active()
        self._connection.execute(
            """
            insert into academic_periods (id, code, name, semester_type, is_active, default_due_date, updated_at)
            values (?, ?, ?, ?, ?, ?, datetime('now'))
            """,
            (period_id, code, name, semester_type, is_active, default_due_date),
        )
        row = self.find_by_id(period_id)
        assert row is not None
        return row

    def update(
        self,
        period_id: str,
        code: str,
        name: str,
        semester_type: str,
        is_active: int,
        default_due_date: str | None,
    ) -> sqlite3.Row | None:
        """Update an existing academic period record."""
        if is_active == 1:
            self.deactivate_all_active(exclude_id=period_id)
        self._connection.execute(
            """
            update academic_periods
            set code = ?, name = ?, semester_type = ?, is_active = ?, default_due_date = ?, updated_at = datetime('now')
            where id = ?
            """,
            (code, name, semester_type, is_active, default_due_date, period_id),
        )
        return self.find_by_id(period_id)
