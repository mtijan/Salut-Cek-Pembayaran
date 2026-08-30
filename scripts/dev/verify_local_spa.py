"""Run an authenticated local SPA smoke test without embedding test identities."""

from __future__ import annotations

import json
import os
import urllib.request


def required_environment(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise SystemExit(f"Set environment variable {name} before running this smoke test.")
    return value


def request_json(request: urllib.request.Request) -> tuple[dict[str, object], str | None]:
    with urllib.request.urlopen(request, timeout=15) as response:
        if response.status != 200:
            raise RuntimeError(f"Unexpected HTTP status: {response.status}")
        payload = json.loads(response.read().decode("utf-8"))
        if not isinstance(payload, dict) or payload.get("success") is not True:
            raise RuntimeError("API smoke check returned an unsuccessful response.")
        return payload, response.headers.get("Set-Cookie")


def main() -> None:
    base_url = os.environ.get("SALUT_VERIFY_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
    admin_email = required_environment("SALUT_VERIFY_ADMIN_EMAIL")
    admin_password = required_environment("SALUT_VERIFY_ADMIN_PASSWORD")
    lookup_nim = required_environment("SALUT_VERIFY_LOOKUP_NIM")

    admin_request = urllib.request.Request(f"{base_url}/admin")
    with urllib.request.urlopen(admin_request, timeout=15) as response:
        html = response.read().decode("utf-8")
        if response.status != 200 or '<div id="root"></div>' not in html:
            raise RuntimeError("Admin SPA root did not return the expected application shell.")
    print("OK: admin SPA shell")

    login_request = urllib.request.Request(
        f"{base_url}/api/admin/login",
        data=json.dumps({"email": admin_email, "password": admin_password}).encode(),
        headers={"Content-Type": "application/json"},
    )
    _, cookie = request_json(login_request)
    if not cookie:
        raise RuntimeError("Login smoke check did not return a session cookie.")
    print("OK: admin login")

    stats_request = urllib.request.Request(
        f"{base_url}/api/admin/dashboard/stats",
        headers={"Cookie": cookie},
    )
    request_json(stats_request)
    print("OK: dashboard statistics")

    lookup_request = urllib.request.Request(
        f"{base_url}/api/lookup",
        data=json.dumps({"nim": lookup_nim}).encode(),
        headers={"Content-Type": "application/json"},
    )
    request_json(lookup_request)
    print("OK: public lookup")


if __name__ == "__main__":
    main()
