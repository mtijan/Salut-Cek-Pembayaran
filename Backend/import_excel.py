from __future__ import annotations

import argparse
import re
import sqlite3
import uuid
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

try:
    from Backend.db import DEFAULT_DB_PATH, connect, init_db
    from Backend.excel_reader import clean_excel_text, normalize_imported_name, normalize_name, normalize_nim, normalize_text, read_sheet, read_sheet_headers, workbook_sheet_names
except ModuleNotFoundError:
    from db import DEFAULT_DB_PATH, connect, init_db
    from excel_reader import clean_excel_text, normalize_imported_name, normalize_name, normalize_nim, normalize_text, read_sheet, read_sheet_headers, workbook_sheet_names

DEFAULT_WORKBOOK = Path(__file__).resolve().parents[1] / "Data_Sinkron_BRIVA_UKT_2023_1_sd_2025_2.xlsx"
DEFAULT_PERIOD = "UKT 2023.1 s/d 2025.2"
DEFAULT_BILL_TYPE = "UKT BRIVA"
DEFAULT_CURRENT_PERIOD = "Semester Ganjil 2026"
DEFAULT_INSTRUCTIONS = (
    "Bayar melalui BRIVA BRI dengan nomor VA yang tampil. "
    "Pastikan nama dan nominal sesuai sebelum menyelesaikan pembayaran."
)
REQUIRED_SYNC_HEADERS = ("NIM", "Nama Mahasiswa", "BRIVA", "Jumlah")
OPTIONAL_ISSUE_HEADERS = ("NIM", "Nama Mahasiswa", "BRIVA", "Jumlah", "Keterangan")
CURRENT_REQUIRED_HEADERS = ("NIM", "Nama", "No Rek", "Jumlah")


@dataclass(frozen=True)
class ImportLayout:
    kind: str
    data_sheet: str
    issue_sheet: str | None
    headers: dict[str, str]
    default_period: str


def _amount_to_int(value: str) -> int | None:
    cleaned = re.sub(r"\D+", "", clean_excel_text(value))
    if not cleaned or not cleaned.isdigit():
        return None
    return int(cleaned)


def _normalized_headers(headers: list[str]) -> dict[str, str]:
    return {
        normalize_text(header).casefold(): normalize_text(header)
        for header in headers
        if normalize_text(header)
    }


def _require_headers(workbook: Path) -> ImportLayout:
    sheet_names = workbook_sheet_names(workbook)
    if "Data Sinkron" in sheet_names and "Data Belum Lengkap" in sheet_names:
        sync_headers = _normalized_headers(read_sheet_headers(workbook, "Data Sinkron"))
        missing = [header for header in REQUIRED_SYNC_HEADERS if header.casefold() not in sync_headers]
        if missing:
            raise ValueError(
                "Struktur header sheet Data Sinkron tidak sesuai. "
                f"Kolom wajib: {', '.join(REQUIRED_SYNC_HEADERS)}. "
                f"Kolom belum ditemukan: {', '.join(missing)}."
            )

        issue_headers = _normalized_headers(read_sheet_headers(workbook, "Data Belum Lengkap"))
        missing_issue_headers = [header for header in OPTIONAL_ISSUE_HEADERS if header.casefold() not in issue_headers]
        if missing_issue_headers:
            raise ValueError(
                "Struktur header sheet Data Belum Lengkap tidak sesuai. "
                f"Kolom wajib: {', '.join(OPTIONAL_ISSUE_HEADERS)}. "
                f"Kolom belum ditemukan: {', '.join(missing_issue_headers)}."
            )
        return ImportLayout("legacy", "Data Sinkron", "Data Belum Lengkap", sync_headers, DEFAULT_PERIOD)

    for sheet_name in sheet_names:
        headers = _normalized_headers(read_sheet_headers(workbook, sheet_name))
        if all(header.casefold() in headers for header in CURRENT_REQUIRED_HEADERS):
            return ImportLayout("current", sheet_name, None, headers, DEFAULT_CURRENT_PERIOD)

    raise ValueError(
        "Struktur Excel tidak dikenali. Gunakan format Data Sinkron lama atau format terbaru "
        "dengan kolom NIM, Nama, No Rek, dan Jumlah."
    )


def _get_existing_id(conn: sqlite3.Connection, table: str, column: str, value: str) -> str | None:
    row = conn.execute(f"select id from {table} where {column} = ?", (value,)).fetchone()
    return str(row["id"]) if row else None


def _record_value(record: dict[str, str], headers: dict[str, str], name: str) -> str:
    return record.get(headers.get(name.casefold(), ""), "")


def _normalize_briva(value: object) -> str:
    return normalize_nim(value)


def _read_sync_rows(
    workbook: Path,
    layout: ImportLayout,
    period: str,
) -> tuple[list[dict[str, object]], list[dict[str, object]], list[dict[str, object]], int, list[dict[str, object]]]:
    rows: list[dict[str, object]] = []
    errors: list[dict[str, object]] = []
    sample: list[dict[str, object]] = []
    identity_conflict_rows = 0
    skipped_issues: list[dict[str, object]] = []

    for record in read_sheet(workbook, layout.data_sheet):
        nim = normalize_nim(_record_value(record, layout.headers, "NIM"))
        name_header = "Nama Mahasiswa" if layout.kind == "legacy" else "Nama"
        briva_header = "BRIVA" if layout.kind == "legacy" else "No Rek"
        full_name = normalize_imported_name(_record_value(record, layout.headers, name_header))
        briva = _normalize_briva(_record_value(record, layout.headers, briva_header))
        amount = _amount_to_int(_record_value(record, layout.headers, "Jumlah"))
        row_number = int(record.get("_row_number") or 0)
        if not nim or not full_name or not briva or amount is None:
            message = "Baris dilewati karena NIM, nama, BRIVA, atau nominal tidak valid."
            errors.append(
                {
                    "sheet": layout.data_sheet,
                    "row_number": row_number,
                    "severity": "warning",
                    "message": message,
                }
            )
            skipped_issues.append(
                {
                    "sheet_name": layout.data_sheet,
                    "row_number": row_number,
                    "nim": nim,
                    "full_name": full_name,
                    "briva": briva,
                    "amount": clean_excel_text(_record_value(record, layout.headers, "Jumlah")),
                    "note": message,
                }
            )
            continue
        row = {
            "nim": nim,
            "full_name": full_name,
            "briva": briva,
            "amount": amount,
            "row_number": row_number,
            "period": period,
            "program_study": clean_excel_text(_record_value(record, layout.headers, "Program Studi")),
            "initial_registration": clean_excel_text(_record_value(record, layout.headers, "Registrasi Awal")),
            "phone_number": normalize_nim(_record_value(record, layout.headers, "No Hp")),
            "due_date": clean_excel_text(_record_value(record, layout.headers, "Batas Pembayaran")),
        }
        rows.append(row)
        if len(sample) < 5:
            sample.append({key: row[key] for key in ("nim", "full_name", "briva", "amount", "program_study", "due_date")})

    canonical_profiles: dict[str, dict[str, object]] = {}
    for row in rows:
        nim = str(row["nim"])
        canonical = canonical_profiles.get(nim)
        if canonical is None:
            canonical_profiles[nim] = row
            continue
        if normalize_name(str(canonical["full_name"])) != normalize_name(str(row["full_name"])):
            identity_conflict_rows += 1
            errors.append(
                {
                    "sheet": layout.data_sheet,
                    "row_number": row["row_number"],
                    "severity": "warning",
                    "message": "NIM muncul dengan nama berbeda. Nama pada baris pertama digunakan untuk profil mahasiswa.",
                }
            )
        for field in ("full_name", "program_study", "initial_registration", "phone_number"):
            row[field] = canonical[field]

    return rows, errors, sample, identity_conflict_rows, skipped_issues


def _existing_bills(
    db_path: str | Path,
    nims: set[str],
    period: str,
    source_file: str,
) -> tuple[dict[str, list[sqlite3.Row]], dict[str, list[sqlite3.Row]], dict[int, sqlite3.Row]]:
    if not nims:
        return {}, {}, {}

    conn = connect(db_path)
    init_db(conn)
    placeholders = ",".join("?" for _ in nims)
    rows = conn.execute(
        f"""
        select b.id, b.student_id, b.briva, b.amount, b.period, b.status, b.source_file, b.source_row_number,
               b.due_date, s.nim, s.full_name, s.program_study, s.initial_registration, s.phone_number
        from bills b
        join students s on s.id = b.student_id
        where (b.source_file = ? or b.period = ? or s.nim in ({placeholders}))
          and b.deleted_at is null
          and s.deleted_at is null
        """,
        (source_file, period, *sorted(nims)),
    ).fetchall()
    conn.close()

    by_briva: dict[str, list[sqlite3.Row]] = {}
    by_nim: dict[str, list[sqlite3.Row]] = {}
    by_source_row: dict[int, sqlite3.Row] = {}
    for row in rows:
        by_briva.setdefault(str(row["briva"]), []).append(row)
        if row["period"] == period:
            by_nim.setdefault(str(row["nim"]), []).append(row)
        if row["source_file"] == source_file and row["source_row_number"] is not None:
            by_source_row[int(row["source_row_number"])] = row
    return by_briva, by_nim, by_source_row


def _append_limited(items: list[dict[str, object]], item: dict[str, object], limit: int = 12) -> None:
    if len(items) < limit:
        items.append(item)


def _analyze_workbook(
    workbook_path: str | Path,
    db_path: str | Path | None = None,
    period: str | None = None,
    source_file_name: str | None = None,
) -> dict[str, object]:
    workbook = Path(workbook_path)
    if not workbook.exists():
        raise FileNotFoundError(f"File Excel tidak ditemukan: {workbook}")

    layout = _require_headers(workbook)
    effective_period = period or layout.default_period
    source_file = source_file_name or workbook.name
    rows, errors, sample, identity_conflict_rows, skipped_issues = _read_sync_rows(workbook, layout, effective_period)
    valid_rows = len(rows)
    issue_rows = len(errors)
    critical_rows = sum(1 for error in errors if error["severity"] == "critical")
    briva_counts = Counter(str(row["briva"]) for row in rows)
    nim_counts = Counter(str(row["nim"]) for row in rows)
    duplicate_briva_conflict_rows = 0
    multiple_bill_rows = 0

    for row in rows:
        rows_with_same_briva = [candidate for candidate in rows if candidate["briva"] == row["briva"]]
        nims_for_same_briva = {str(candidate["nim"]) for candidate in rows_with_same_briva}
        if briva_counts[str(row["briva"])] > 1 and len(nims_for_same_briva) > 1:
            duplicate_briva_conflict_rows += 1
            critical_rows += 1
            issue_rows += 1
            _append_limited(
                errors,
                {
                    "sheet": layout.data_sheet,
                    "row_number": row["row_number"],
                    "severity": "critical",
                    "message": "BRIVA yang sama muncul untuk NIM berbeda dalam file.",
                },
            )
        if nim_counts[str(row["nim"])] > 1:
            multiple_bill_rows += 1
            issue_rows += 1
            _append_limited(
                errors,
                {
                    "sheet": layout.data_sheet,
                    "row_number": row["row_number"],
                    "severity": "warning",
                    "message": "NIM muncul lebih dari satu kali. Sistem akan menyimpan sebagai beberapa tagihan.",
                },
            )

    by_briva: dict[str, list[sqlite3.Row]] = {}
    by_nim: dict[str, list[sqlite3.Row]] = {}
    by_source_row: dict[int, sqlite3.Row] = {}
    if db_path is not None:
        by_briva, by_nim, by_source_row = _existing_bills(
            db_path, {str(row["nim"]) for row in rows}, effective_period, source_file
        )

    new_rows = 0
    unchanged_rows = 0
    update_rows = 0
    amount_change_rows = 0
    briva_change_rows = 0
    conflict_rows = 0
    requires_update_confirmation = False
    changes: list[dict[str, object]] = []
    actions: list[dict[str, object]] = []
    used_existing_bill_ids: set[str] = set()

    for row in rows:
        nim = str(row["nim"])
        briva = str(row["briva"])
        amount = int(row["amount"])
        row_number = int(row["row_number"])
        existing_source_row = by_source_row.get(row_number)
        matching_briva_rows = [
            candidate
            for candidate in by_briva.get(briva, [])
            if candidate["nim"] == nim and candidate["period"] == effective_period and str(candidate["id"]) not in used_existing_bill_ids
        ]
        conflicting_briva_rows = [candidate for candidate in by_briva.get(briva, []) if candidate["nim"] != nim]
        existing_briva = matching_briva_rows[0] if matching_briva_rows else None
        current_bills = [candidate for candidate in by_nim.get(nim, []) if str(candidate["id"]) not in used_existing_bill_ids]

        if existing_source_row:
            if existing_source_row["nim"] != nim:
                critical_rows += 1
                issue_rows += 1
                conflict_rows += 1
                _append_limited(
                    errors,
                    {
                        "sheet": layout.data_sheet,
                        "row_number": row["row_number"],
                        "severity": "critical",
                        "message": "Baris sumber file ini sebelumnya terdaftar untuk NIM lain.",
                    },
                )
                continue
            if str(existing_source_row["id"]) not in used_existing_bill_ids:
                existing_briva = existing_source_row

        if conflicting_briva_rows:
            critical_rows += 1
            issue_rows += 1
            conflict_rows += 1
            _append_limited(
                errors,
                {
                    "sheet": layout.data_sheet,
                    "row_number": row["row_number"],
                    "severity": "critical",
                    "message": "BRIVA sudah terdaftar untuk NIM lain.",
                },
            )
            continue

        if existing_briva:
            if existing_briva["period"] != effective_period:
                critical_rows += 1
                issue_rows += 1
                conflict_rows += 1
                _append_limited(
                    errors,
                    {
                        "sheet": layout.data_sheet,
                        "row_number": row["row_number"],
                        "severity": "critical",
                        "message": "BRIVA sudah terdaftar pada periode lain.",
                    },
                )
                continue

            amount_changed = int(existing_briva["amount"]) != amount
            name_changed = normalize_name(str(existing_briva["full_name"])) != normalize_name(str(row["full_name"]))
            program_changed = normalize_text(existing_briva["program_study"]) != normalize_text(row["program_study"])
            registration_changed = normalize_text(existing_briva["initial_registration"]) != normalize_text(row["initial_registration"])
            phone_changed = normalize_text(existing_briva["phone_number"]) != normalize_text(row["phone_number"])
            due_date_changed = normalize_text(existing_briva["due_date"]) != normalize_text(row["due_date"])
            if existing_briva["status"] != "unpaid" and amount_changed:
                critical_rows += 1
                issue_rows += 1
                conflict_rows += 1
                _append_limited(
                    errors,
                    {
                        "sheet": layout.data_sheet,
                        "row_number": row["row_number"],
                        "severity": "critical",
                        "message": "Nominal tagihan yang sudah lunas atau dicicil tidak boleh diubah melalui import.",
                    },
                )
                continue

            if not any((amount_changed, name_changed, program_changed, registration_changed, phone_changed, due_date_changed)):
                unchanged_rows += 1
                actions.append({"type": "unchanged", "row": row, "existing": existing_briva})
                used_existing_bill_ids.add(str(existing_briva["id"]))
                continue

            update_rows += 1
            if amount_changed:
                amount_change_rows += 1
                requires_update_confirmation = True
            action = "update_amount" if amount_changed else "update_profile"
            actions.append({"type": action, "row": row, "existing": existing_briva})
            used_existing_bill_ids.add(str(existing_briva["id"]))
            if len(changes) < 10:
                changes.append(
                    {
                        "row_number": row["row_number"],
                        "nim": nim,
                        "full_name": row["full_name"],
                        "change_type": "nominal" if amount_changed else "nama",
                        "old_briva": existing_briva["briva"],
                        "new_briva": briva,
                        "old_amount": existing_briva["amount"],
                        "new_amount": amount,
                    }
                )
            continue

        has_multiple_rows_for_nim = nim_counts[nim] > 1
        if len(current_bills) == 0 or has_multiple_rows_for_nim:
            new_rows += 1
            actions.append({"type": "new", "row": row, "existing": None})
            continue

        if len(current_bills) > 1:
            new_rows += 1
            actions.append({"type": "new", "row": row, "existing": None})
            continue

        existing = current_bills[0]
        if existing["status"] != "unpaid":
            critical_rows += 1
            issue_rows += 1
            conflict_rows += 1
            _append_limited(
                errors,
                {
                    "sheet": layout.data_sheet,
                    "row_number": row["row_number"],
                    "severity": "critical",
                    "message": "BRIVA tagihan yang sudah lunas atau dicicil tidak boleh diganti melalui import.",
                },
            )
            continue

        update_rows += 1
        briva_change_rows += 1
        requires_update_confirmation = True
        if int(existing["amount"]) != amount:
            amount_change_rows += 1
        actions.append({"type": "replace_briva", "row": row, "existing": existing})
        used_existing_bill_ids.add(str(existing["id"]))
        if len(changes) < 10:
            changes.append(
                {
                    "row_number": row["row_number"],
                    "nim": nim,
                    "full_name": row["full_name"],
                    "change_type": "BRIVA dan nominal" if int(existing["amount"]) != amount else "BRIVA",
                    "old_briva": existing["briva"],
                    "new_briva": briva,
                    "old_amount": existing["amount"],
                    "new_amount": amount,
                }
            )

    if layout.issue_sheet:
        for record in read_sheet(workbook, layout.issue_sheet):
            issue_rows += 1
            _append_limited(
                errors,
                {
                    "sheet": layout.issue_sheet,
                    "row_number": int(record.get("_row_number") or 0),
                    "severity": "warning",
                    "message": normalize_text(record.get("Keterangan")) or "Data belum lengkap.",
                },
            )

    return {
        "valid_rows": valid_rows,
        "critical_rows": critical_rows,
        "issue_rows": issue_rows,
        "new_rows": new_rows,
        "unchanged_rows": unchanged_rows,
        "update_rows": update_rows,
        "amount_change_rows": amount_change_rows,
        "briva_change_rows": briva_change_rows,
        "duplicate_briva_conflict_rows": duplicate_briva_conflict_rows,
        "multiple_bill_rows": multiple_bill_rows,
        "identity_conflict_rows": identity_conflict_rows,
        "skipped_rows": len(skipped_issues),
        "conflict_rows": conflict_rows,
        "requires_update_confirmation": requires_update_confirmation,
        "sample": sample,
        "changes": changes,
        "errors": errors,
        "_skipped_issues": skipped_issues,
        "actions": actions,
    }


def preview_workbook(
    workbook_path: str | Path,
    db_path: str | Path | None = None,
    period: str | None = None,
    source_file_name: str | None = None,
) -> dict[str, object]:
    analysis = _analyze_workbook(workbook_path, db_path, period, source_file_name)
    return {key: value for key, value in analysis.items() if key not in {"actions", "_skipped_issues"}}


def _upsert_student(conn: sqlite3.Connection, row: dict[str, object]) -> str:
    nim = str(row["nim"])
    full_name = normalize_imported_name(row["full_name"])
    student_id = _get_existing_id(conn, "students", "nim", nim) or str(uuid.uuid4())
    conn.execute(
        """
        insert into students (id, nim, full_name, name_norm, program_study, initial_registration, phone_number, updated_at)
        values (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        on conflict(nim) do update set
          full_name = excluded.full_name,
          name_norm = excluded.name_norm,
          program_study = case when excluded.program_study <> '' then excluded.program_study else students.program_study end,
          initial_registration = case when excluded.initial_registration <> '' then excluded.initial_registration else students.initial_registration end,
          phone_number = case when excluded.phone_number <> '' then excluded.phone_number else students.phone_number end,
          updated_at = datetime('now')
        """,
        (
            student_id,
            nim,
            full_name,
            normalize_name(full_name),
            clean_excel_text(row.get("program_study")),
            clean_excel_text(row.get("initial_registration")),
            normalize_nim(row.get("phone_number")),
        ),
    )
    return student_id


def _store_import_issue(conn: sqlite3.Connection, issue: dict[str, object], source_file: str) -> None:
    conn.execute(
        """
        insert into import_issues
          (id, sheet_name, row_number, nim, full_name, briva, amount, note, source_file)
        values (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            str(uuid.uuid4()),
            str(issue["sheet_name"]),
            int(issue["row_number"]),
            str(issue.get("nim") or ""),
            str(issue.get("full_name") or ""),
            str(issue.get("briva") or ""),
            str(issue.get("amount") or ""),
            str(issue["note"]),
            source_file,
        ),
    )


def import_workbook(
    workbook_path: str | Path = DEFAULT_WORKBOOK,
    db_path: str | Path = DEFAULT_DB_PATH,
    period: str | None = None,
    bill_type: str = DEFAULT_BILL_TYPE,
    source_file_name: str | None = None,
    confirm_updates: bool = False,
) -> dict[str, object]:
    workbook = Path(workbook_path)
    source_file = source_file_name or workbook.name
    analysis = _analyze_workbook(workbook, db_path, period, source_file)
    if analysis["critical_rows"]:
        raise ValueError("Import dibatalkan karena ada duplikasi atau konflik kritis.")
    if analysis["requires_update_confirmation"] and not confirm_updates:
        raise ValueError("Perubahan nominal atau BRIVA memerlukan konfirmasi admin.")

    conn = connect(db_path)
    init_db(conn)
    issues = 0
    created = 0
    updated = 0
    issue_details: list[dict[str, object]] = []

    with conn:
        conn.execute("delete from import_issues where source_file = ?", (source_file,))
        for issue in analysis["_skipped_issues"]:
            assert isinstance(issue, dict)
            _store_import_issue(conn, issue, source_file)
            issues += 1
            if len(issue_details) < 5:
                issue_details.append({"sheet": issue["sheet_name"], "row_number": issue["row_number"], "note": issue["note"]})
        for action in analysis["actions"]:
            action_type = str(action["type"])
            if action_type == "unchanged":
                continue
            row = action["row"]
            assert isinstance(row, dict)
            nim = str(row["nim"])
            briva = str(row["briva"])
            amount = int(row["amount"])
            row_number = int(row["row_number"])
            due_date = clean_excel_text(row.get("due_date")) or None
            student_id = _upsert_student(conn, row)

            if action_type == "new":
                conn.execute(
                    """
                    insert into bills
                      (id, student_id, briva, amount, period, bill_type, status, instructions, due_date, source_file, source_row_number, updated_at)
                    values (?, ?, ?, ?, ?, ?, 'unpaid', ?, ?, ?, ?, datetime('now'))
                    """,
                    (
                        str(uuid.uuid4()), student_id, briva, amount, str(row["period"]), bill_type,
                        DEFAULT_INSTRUCTIONS, due_date, source_file, row_number,
                    ),
                )
                created += 1
                continue

            existing = action["existing"]
            assert isinstance(existing, sqlite3.Row)
            conn.execute(
                """
                update bills set student_id = ?, briva = ?, amount = ?, period = ?, bill_type = ?, due_date = ?,
                    source_file = ?, source_row_number = ?, updated_at = datetime('now')
                where id = ?
                """,
                (student_id, briva, amount, str(row["period"]), bill_type, due_date, source_file, row_number, existing["id"]),
            )
            updated += 1

        layout = _require_headers(workbook)
        if layout.issue_sheet:
            for record in read_sheet(workbook, layout.issue_sheet):
                issues += 1
                issue = {
                    "sheet_name": layout.issue_sheet,
                    "row_number": int(record.get("_row_number") or 0),
                    "nim": normalize_nim(record.get("NIM")),
                    "full_name": clean_excel_text(record.get("Nama Mahasiswa")),
                    "briva": _normalize_briva(record.get("BRIVA")),
                    "amount": clean_excel_text(record.get("Jumlah")),
                    "note": clean_excel_text(record.get("Keterangan")) or "Data belum lengkap.",
                }
                _store_import_issue(conn, issue, source_file)
                if len(issue_details) < 5:
                    issue_details.append({"sheet": issue["sheet_name"], "row_number": issue["row_number"], "note": issue["note"]})

    conn.close()
    return {
        "imported": created + updated,
        "created": created,
        "updated": updated,
        "unchanged": int(analysis["unchanged_rows"]),
        "issues": issues,
        "issue_details": issue_details,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Import data BRIVA UKT ke SQLite.")
    parser.add_argument("--file", default=str(DEFAULT_WORKBOOK), help="Path file .xlsx")
    parser.add_argument("--db", default=str(DEFAULT_DB_PATH), help="Path file SQLite")
    parser.add_argument("--period", help="Opsional. Default mengikuti struktur workbook.")
    parser.add_argument("--confirm-updates", action="store_true", help="Setujui perubahan nominal atau BRIVA.")
    args = parser.parse_args()

    result = import_workbook(args.file, args.db, args.period, confirm_updates=args.confirm_updates)
    print(f"Changed rows: {result['imported']}")
    print(f"Unchanged rows: {result['unchanged']}")
    print(f"Issue rows: {result['issues']}")
    print(f"Database: {Path(args.db).resolve()}")


if __name__ == "__main__":
    main()
