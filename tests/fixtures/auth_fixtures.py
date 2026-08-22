"""
Authentication fixtures for HRMS Python Playwright test suite.
Provides fast session injection and full UI login helpers.
"""

import os
import re
from typing import Callable
import pytest
from playwright.sync_api import Browser, BrowserContext, Page
from tests.fixtures.personas import TEST_PERSONAS, DEFAULT_PASSWORD
from tests.utils.cookie_signer import create_mock_cookie_dict


def authenticate_context(
    context: BrowserContext,
    persona_key: str,
    base_url: str = "http://localhost:3000",
) -> BrowserContext:
    """
    Directly injects the signed session cookie into the BrowserContext.
    Executes in 0ms without UI login latency.
    """
    persona = TEST_PERSONAS.get(persona_key)
    if not persona:
        raise ValueError(f"Unknown test persona: {persona_key}")

    cookie = create_mock_cookie_dict(persona.email, base_url=base_url)
    context.add_cookies([cookie])
    return context


def login_via_ui(
    page: Page,
    email: str,
    password: str = DEFAULT_PASSWORD,
    base_url: str = "http://localhost:3000",
) -> Page:
    """
    Performs full browser-based login through the /login form.
    """
    page.goto(f"{base_url}/login")
    page.fill('input[type="email"], input[name="email"]', email)
    page.fill('input[type="password"], input[name="password"]', password)
    page.click('button[type="submit"]')

    # Wait for redirect away from /login
    page.wait_for_url(re.compile(r"^(?!.*\/login).*$"), timeout=10000)
    return page
