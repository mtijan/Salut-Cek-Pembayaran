"""Student repository data access layer."""

from __future__ import annotations

import sqlite3
import uuid
from typing import cast

from Backend.app.domain.billing import joined_bill_select
from Backend.app.domain.common import escape_like_query
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

    def find_study_program_name(self, identifier: str) -> str | None:
        """Resolve a study-program name from its ID or case-insensitive code."""
        row = self._connection.execute(
            "select name from study_programs where id = ? or upper(code) = ?",
            (identifier, identifier.upper()),
        ).fetchone()
        return str(row["name"]) if row else None

    def update_or_restore_by_nim(
        self,
        student_id: str,
        *,
        full_name: str,
        name_norm: str,
        deleted: bool,
        optional_fields: dict[str, object],
    ) -> sqlite3.Row:
        """Update an existing NIM profile, restoring a soft-deleted row when needed."""
        allowed_fields = {
            "program_study",
            "study_program_id",
            "academic_status",
            "entry_year",
            "entry_semester",
            "entry_period",
            "email",
            "address",
            "phone_number",
            "no_ktp",
            "tempat_lahir",
            "tanggal_lahir",
            "nama_ibu_kandung",
            "initial_registration",
        }
        unknown_fields = set(optional_fields) - allowed_fields
        if unknown_fields:
            raise ValueError(f"Kolom profil mahasiswa tidak didukung: {', '.join(sorted(unknown_fields))}")

        assignments = ["full_name = ?", "name_norm = ?", "updated_at = datetime('now')"]
        params: list[object] = [full_name, name_norm]
        if deleted:
            assignments.extend(["deleted_at = null", "deleted_by = null", "delete_reason = null"])
        for column, value in optional_fields.items():
            assignments.append(f"{column} = ?")
            params.append(value)
        params.append(student_id)
        self._connection.execute(
            f"update students set {', '.join(assignments)} where id = ?",
            params,
        )
        row = self._connection.execute(
            "select id, nim, full_name from students where id = ?",
            (student_id,),
        ).fetchone()
        assert row is not None
        return row

    def create_profile(self, profile: dict[str, object]) -> sqlite3.Row:
        """Insert a normalized student profile and return its public identity."""
        student_id = str(profile.get("id") or f"stu_{uuid.uuid4().hex[:12]}")
        self._connection.execute(
            """
            insert into students (
                id, nim, full_name, name_norm,
                no_ktp, tempat_lahir, tanggal_lahir, nama_ibu_kandung,
                program_study, study_program_id, academic_status, entry_year,
                entry_semester, entry_period, email, address, phone_number,
                initial_registration
            )
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                student_id,
                profile["nim"],
                profile["full_name"],
                profile["name_norm"],
                profile.get("no_ktp"),
                profile.get("tempat_lahir"),
                profile.get("tanggal_lahir"),
                profile.get("nama_ibu_kandung"),
                profile.get("program_study"),
                profile.get("study_program_id"),
                profile.get("academic_status") or "aktif",
                profile.get("entry_year"),
                profile.get("entry_semester"),
                profile.get("entry_period"),
                profile.get("email"),
                profile.get("address"),
                profile.get("phone_number"),
                profile.get("initial_registration"),
            ),
        )
        row = self._connection.execute(
            "select id, nim, full_name from students where id = ?",
            (student_id,),
        ).fetchone()
        assert row is not None
        return row

    def update_profile(self, student_id: str, profile: dict[str, object]) -> sqlite3.Row:
        """Replace the editable fields of an active student profile."""
        self._connection.execute(
            """
            update students
            set nim = ?, full_name = ?, name_norm = ?, no_ktp = ?, tempat_lahir = ?,
                tanggal_lahir = ?, nama_ibu_kandung = ?, program_study = ?,
                study_program_id = ?, academic_status = ?, entry_year = ?,
                entry_semester = ?, entry_period = ?, email = ?, address = ?,
                phone_number = ?, initial_registration = ?, updated_at = datetime('now')
            where id = ? and deleted_at is null
            """,
            (
                profile["nim"],
                profile["full_name"],
                profile["name_norm"],
                profile.get("no_ktp"),
                profile.get("tempat_lahir"),
                profile.get("tanggal_lahir"),
                profile.get("nama_ibu_kandung"),
                profile.get("program_study"),
                profile.get("study_program_id"),
                profile.get("academic_status"),
                profile.get("entry_year"),
                profile.get("entry_semester"),
                profile.get("entry_period"),
                profile.get("email"),
                profile.get("address"),
                profile.get("phone_number"),
                profile.get("initial_registration"),
                student_id,
            ),
        )
        row = self.find_by_id(student_id)
        assert row is not None
        return row

    def upsert_import_profile(self, profile: dict[str, object]) -> str:
        """Upsert an imported profile while preserving non-empty existing demographics."""
        student_id = str(profile.get("id") or uuid.uuid4())
        self._connection.execute(
            """
            insert into students (
                id, nim, full_name, name_norm, no_ktp, tempat_lahir, tanggal_lahir,
                nama_ibu_kandung, program_study, initial_registration, entry_year,
                entry_semester, entry_period, phone_number, email, academic_status,
                updated_at
            )
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aktif', datetime('now'))
            on conflict(nim) do update set
              full_name = excluded.full_name,
              name_norm = excluded.name_norm,
              deleted_at = null,
              deleted_by = null,
              delete_reason = null,
              no_ktp = coalesce(nullif(excluded.no_ktp, ''), students.no_ktp),
              tempat_lahir = coalesce(nullif(excluded.tempat_lahir, ''), students.tempat_lahir),
              tanggal_lahir = coalesce(nullif(excluded.tanggal_lahir, ''), students.tanggal_lahir),
              nama_ibu_kandung = coalesce(nullif(excluded.nama_ibu_kandung, ''), students.nama_ibu_kandung),
              program_study = coalesce(nullif(excluded.program_study, ''), students.program_study),
              initial_registration = coalesce(
                  nullif(excluded.initial_registration, ''), students.initial_registration
              ),
              entry_year = coalesce(excluded.entry_year, students.entry_year),
              entry_semester = coalesce(excluded.entry_semester, students.entry_semester),
              entry_period = coalesce(excluded.entry_period, students.entry_period),
              phone_number = coalesce(nullif(excluded.phone_number, ''), students.phone_number),
              email = coalesce(nullif(excluded.email, ''), students.email),
              updated_at = datetime('now')
            """,
            (
                student_id,
                profile["nim"],
                profile["full_name"],
                profile["name_norm"],
                profile.get("no_ktp"),
                profile.get("tempat_lahir"),
                profile.get("tanggal_lahir"),
                profile.get("nama_ibu_kandung"),
                profile.get("program_study"),
                profile.get("initial_registration"),
                profile.get("entry_year"),
                profile.get("entry_semester"),
                profile.get("entry_period"),
                profile.get("phone_number"),
                profile.get("email"),
            ),
        )
        row = self.find_by_nim(str(profile["nim"]))
        assert row is not None
        return str(row["id"])

    def set_study_program(self, student_id: str, study_program_id: str) -> None:
        """Associate an imported student with a resolved study-program record."""
        self._connection.execute(
            "update students set study_program_id = ? where id = ?",
            (study_program_id, student_id),
        )

    def list_admin(
        self,
        query: str = "",
        limit: int = 2000,
        offset: int = 0,
        study_program_id: str = "",
        academic_status: str = "",
        entry_year: int | None = None,
        entry_period: str = "",
        sort_by: str = "",
    ) -> list[sqlite3.Row]:
        """List students with dynamic filters, search, sorting, and pagination."""
        search = normalize_text(query)
        limit = max(1, min(int(limit or 2000), 5000))
        offset = max(0, int(offset or 0))
        params: list[object] = []
        where_clauses = ["s.deleted_at is null"]
        if search:
            escaped_search = escape_like_query(search)
            where_clauses.append(
                "(s.nim like ? escape '\\' or s.full_name like ? escape '\\' or s.program_study like ? escape '\\' or sp.name like ? escape '\\' or sp.code like ? escape '\\' or s.no_ktp like ? escape '\\' or s.email like ? escape '\\' or s.phone_number like ? escape '\\')"
            )
            params.extend([f"%{escaped_search}%"] * 8)
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
            escaped_entry = escape_like_query(entry_period.strip())
            where_clauses.append("(s.entry_period = ? or s.initial_registration like ? escape '\\')")
            params.extend([entry_period.strip(), f"%{escaped_entry}%"])

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
            limit ? offset ?
            """,
            (*params, limit, offset),
        ).fetchall()

    def get_bills_for_student(self, student_id: str) -> list[sqlite3.Row]:
        """Retrieve active bills for a student."""
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
