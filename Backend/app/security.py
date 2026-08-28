from __future__ import annotations

import hashlib
import hmac
import secrets

from Backend.app import config


def digest(value: str) -> str:
    return hmac.new(
        config.LOOKUP_HASH_SECRET.encode("utf-8"),
        value.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def hash_password(password: str, salt: str | None = None, iterations: int = 260000) -> str:
    salt = salt or secrets.token_hex(16)
    password_hash = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), iterations)
    return f"pbkdf2_sha256${iterations}${salt}${password_hash.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, iterations, salt, expected = stored_hash.split("$", 3)
    except ValueError:
        return False
    if algorithm != "pbkdf2_sha256":
        return False
    candidate = hash_password(password, salt, int(iterations)).split("$", 3)[3]
    return hmac.compare_digest(candidate, expected)


def cookie_header(token: str, max_age: int) -> str:
    parts = [
        f"{config.SESSION_COOKIE}={token}",
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        f"Max-Age={max_age}",
    ]
    if config.APP_ENV == "production":
        parts.append("Secure")
    return "; ".join(parts)
