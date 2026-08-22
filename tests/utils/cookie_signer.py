"""
Cookie signer utility for mock authentication in Python Playwright test suite.

Replicates the cryptographic HMAC-SHA256 signing from src/lib/auth/mock-cookie.ts.
Allows tests to inject authenticated sessions directly into the browser context in 0ms.
"""

import base64
import hashlib
import hmac
import os
import time
import urllib.parse
from pathlib import Path
from typing import Dict, Any
from dotenv import load_dotenv

# Automatically load environment variables from .env.local and .env
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(ROOT_DIR / ".env.local")
load_dotenv(ROOT_DIR / ".env")

MOCK_COOKIE_NAME = "sb-access-token"
DEFAULT_MOCK_SECRET = "hrms-mock-dev-secret-key-2026"
MOCK_COOKIE_EXPIRY_MS = 24 * 60 * 60 * 1000  # 24 hours


def get_mock_secret() -> str:
    return os.environ.get(
        "MOCK_COOKIE_SECRET",
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY", DEFAULT_MOCK_SECRET),
    )


def sign_mock_cookie(email: str, secret: str = None) -> str:
    """
    Generates a valid HMAC-SHA256 signed mock cookie token.
    Format: base64(encodeURIComponent(email)):expiryTimestamp:hmacSignature
    """
    if secret is None:
        secret = get_mock_secret()

    now_ms = int(time.time() * 1000)
    expiry = now_ms + MOCK_COOKIE_EXPIRY_MS
    data = f"{email}:{expiry}"

    key_bytes = secret.encode("utf-8")
    data_bytes = data.encode("utf-8")
    sig = hmac.new(key_bytes, data_bytes, hashlib.sha256).hexdigest()

    encoded_email = urllib.parse.quote(email, safe="")
    b64_encoded = base64.b64encode(encoded_email.encode("utf-8")).decode("utf-8")

    return f"{b64_encoded}:{expiry}:{sig}"


def create_mock_cookie_dict(
    email: str,
    base_url: str = "http://localhost:3000",
    secret: str = None,
) -> Dict[str, Any]:
    """
    Produces a Playwright-compatible cookie dictionary for browser_context.add_cookies().
    """
    token_value = sign_mock_cookie(email, secret=secret)
    parsed = urllib.parse.urlparse(base_url)
    domain = parsed.hostname or "localhost"

    return {
        "name": MOCK_COOKIE_NAME,
        "value": token_value,
        "domain": domain,
        "path": "/",
        "httpOnly": True,
        "secure": False,
        "sameSite": "Lax",
    }
