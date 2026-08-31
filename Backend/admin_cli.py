"""Administrator CLI for account recovery, password rotation, and user provisioning.

This module provides a standalone command-line interface for system operators to:
- Create initial or recovery super_admin accounts
- Reset administrator passwords and revoke active sessions
- List administrator accounts without exposing credentials
- Activate or deactivate administrator accounts with last-admin safeguards

Usage:
    python -m Backend.admin_cli create-superadmin --email user@example.test --name "Admin Name"
    python -m Backend.admin_cli reset-password --email user@example.test
    python -m Backend.admin_cli list
    python -m Backend.admin_cli set-active --email user@example.test --active 0
"""

from __future__ import annotations

import argparse
import getpass
import sys

from Backend.app import config
from Backend.app.services.users import (
    create_admin_user,
    list_admin_users,
    reset_admin_password,
    update_admin_user,
)
from Backend.db import connect, database_connection, init_db, resolve_db_path


def _prompt_password(prompt: str = "Password baru (min 8 karakter): ") -> str:
    """Prompt for password securely using getpass or stdin."""
    if sys.stdin.isatty():
        password = getpass.getpass(prompt)
    else:
        password = sys.stdin.readline().rstrip("\r\n")
    return password


def handle_create_superadmin(args: argparse.Namespace) -> int:
    """Handle create-superadmin command."""
    db_path = resolve_db_path(args.db)
    conn = connect(db_path)
    init_db(conn)
    conn.close()

    email = (args.email or "").strip().casefold()
    if not email or "@" not in email:
        print("ERROR: Email wajib diisi dengan format valid.", file=sys.stderr)
        return 1

    password = args.password
    if not password:
        password = _prompt_password("Password super_admin (min 8 karakter): ")

    if not password or len(password) < 8:
        print("ERROR: Password wajib minimal 8 karakter.", file=sys.stderr)
        return 1

    full_name = (args.name or "Super Admin").strip()
    payload = {
        "email": email,
        "password": password,
        "full_name": full_name,
        "role": "super_admin",
        "is_active": True,
    }

    try:
        user = create_admin_user(db_path, payload, actor_id="cli.recovery")
        print(f"OK: Super admin '{user['email']}' berhasil dibuat (ID: {user['id']}).")
        return 0
    except ValueError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


def handle_reset_password(args: argparse.Namespace) -> int:
    """Handle reset-password command."""
    db_path = resolve_db_path(args.db)
    identifier = (args.email or args.id or "").strip()
    if not identifier:
        print("ERROR: Tentukan --email atau --id target admin.", file=sys.stderr)
        return 1

    user_id = identifier
    with database_connection(db_path) as conn:
        if "@" in identifier:
            row = conn.execute("select id, email from admin_users where email = ?", (identifier.casefold(),)).fetchone()
        else:
            row = conn.execute("select id, email from admin_users where id = ?", (identifier,)).fetchone()

        if not row:
            print(f"ERROR: Admin '{identifier}' tidak ditemukan.", file=sys.stderr)
            return 1
        user_id = str(row["id"])
        target_email = str(row["email"])

    password = args.password
    if not password:
        password = _prompt_password(f"Password baru untuk {target_email} (min 8 karakter): ")

    if not password or len(password) < 8:
        print("ERROR: Password wajib minimal 8 karakter.", file=sys.stderr)
        return 1

    try:
        reset_admin_password(db_path, user_id, password, actor_id="cli.recovery")
        print(f"OK: Password admin '{target_email}' berhasil direset dan session aktif dicabut.")
        return 0
    except ValueError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


def handle_list_admins(args: argparse.Namespace) -> int:
    """Handle list command."""
    db_path = resolve_db_path(args.db)
    users = list_admin_users(db_path)
    if not users:
        print("Tidak ada administrator terdaftar.")
        return 0

    header = f"{'ID':<36} | {'Email':<30} | {'Nama':<22} | {'Role':<15} | {'Status':<8}"
    separator = "-" * len(header)
    print(header)
    print(separator)
    for u in users:
        status = "Aktif" if u["is_active"] else "Nonaktif"
        print(f"{u['id']:<36} | {u['email']:<30} | {u['full_name'][:22]:<22} | {u['role']:<15} | {status:<8}")
    print(f"\nTotal: {len(users)} admin")
    return 0


def handle_set_active(args: argparse.Namespace) -> int:
    """Handle set-active command."""
    db_path = resolve_db_path(args.db)
    identifier = (args.email or args.id or "").strip()
    if not identifier:
        print("ERROR: Tentukan --email atau --id target admin.", file=sys.stderr)
        return 1

    raw_active = str(args.active).strip().lower()
    is_active = raw_active in {"1", "true", "yes", "aktif"}

    with database_connection(db_path) as conn:
        if "@" in identifier:
            row = conn.execute(
                "select id, email, full_name, role from admin_users where email = ?", (identifier.casefold(),)
            ).fetchone()
        else:
            row = conn.execute(
                "select id, email, full_name, role from admin_users where id = ?", (identifier,)
            ).fetchone()

        if not row:
            print(f"ERROR: Admin '{identifier}' tidak ditemukan.", file=sys.stderr)
            return 1
        user_id = str(row["id"])
        target_email = str(row["email"])

    try:
        update_admin_user(db_path, user_id, {"is_active": is_active}, actor_id="cli.recovery")
        state_label = "diaktifkan" if is_active else "dinonaktifkan"
        print(f"OK: Akun admin '{target_email}' berhasil {state_label}.")
        return 0
    except ValueError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


def build_parser() -> argparse.ArgumentParser:
    """Build argument parser for admin CLI."""
    parser = argparse.ArgumentParser(
        prog="python -m Backend.admin_cli",
        description="Administrator account management and emergency recovery CLI.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Subcommand: create-superadmin
    p_create = subparsers.add_parser("create-superadmin", help="Buat akun super_admin baru")
    p_create.add_argument("--email", required=True, help="Email super admin")
    p_create.add_argument("--name", default="Super Admin", help="Nama lengkap super admin")
    p_create.add_argument("--password", help="Password (jika tidak diisi, akan ditanyakan interaktif)")
    p_create.add_argument("--db", default=str(config.DB_PATH), help="Path database SQLite")
    p_create.set_defaults(handler=handle_create_superadmin)

    # Subcommand: reset-password
    p_reset = subparsers.add_parser("reset-password", help="Reset password admin dan cabut session aktif")
    p_reset.add_argument("--email", help="Email target admin")
    p_reset.add_argument("--id", help="ID target admin")
    p_reset.add_argument("--password", help="Password baru (opsional, prompt jika kosong)")
    p_reset.add_argument("--db", default=str(config.DB_PATH), help="Path database SQLite")
    p_reset.set_defaults(handler=handle_reset_password)

    # Subcommand: list
    p_list = subparsers.add_parser("list", help="Tampilkan seluruh akun admin")
    p_list.add_argument("--db", default=str(config.DB_PATH), help="Path database SQLite")
    p_list.set_defaults(handler=handle_list_admins)

    # Subcommand: set-active
    p_active = subparsers.add_parser("set-active", help="Aktifkan atau nonaktifkan akun admin")
    p_active.add_argument("--email", help="Email target admin")
    p_active.add_argument("--id", help="ID target admin")
    p_active.add_argument("--active", required=True, help="1/0, true/false, yes/no")
    p_active.add_argument("--db", default=str(config.DB_PATH), help="Path database SQLite")
    p_active.set_defaults(handler=handle_set_active)

    return parser


def main(argv: list[str] | None = None) -> int:
    """CLI entrypoint."""
    parser = build_parser()
    args = parser.parse_args(argv)
    handler = getattr(args, "handler", None)
    if not handler:
        parser.print_help()
        return 1
    return int(handler(args))


if __name__ == "__main__":
    raise SystemExit(main())
