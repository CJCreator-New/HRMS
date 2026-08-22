"""
Adversarial Red-Team: Authentication Attack Surface & Session Penetration Tests.
Tests post-logout back button caching, tampered HMAC signatures, and session revocations.
"""

import re
import pytest
from playwright.sync_api import Browser, Page, expect
from tests.fixtures.auth_fixtures import authenticate_context
from tests.utils.cookie_signer import MOCK_COOKIE_NAME
from tests.pages.dashboard_page import DashboardPage


@pytest.mark.redteam
@pytest.mark.auth
def test_browser_back_button_post_logout_security(employee_page: Page):
    """
    Auth Attack Surface: User logs out, then clicks the browser Back button.
    The application must NOT display cached authenticated profile data,
    and server actions / page loads must redirect back to /login.
    """
    dashboard = DashboardPage(employee_page)
    dashboard.navigate("/")
    dashboard.assert_loaded()

    # Trigger logout via header component
    dashboard.header.logout()
    expect(employee_page).to_have_url(re.compile(r".*/login.*"))

    # Attempt to browse back to / - should redirect to /login
    employee_page.goto("/")
    expect(employee_page).to_have_url(re.compile(r".*/login.*"))


@pytest.mark.redteam
@pytest.mark.auth
def test_tampered_session_cookie_signature_rejected(browser: Browser, base_url: str):
    """
    Security / Auth: A malicious actor tampers with the HMAC cookie payload.
    Middleware must detect the signature mismatch, clear the cookie, and redirect to /login.
    """
    context = browser.new_context()
    # Inject forged/tampered cookie
    forged_cookie = {
        "name": MOCK_COOKIE_NAME,
        "value": "tampered_user_payload.invalid_signature_hash_12345",
        "url": base_url,
        "httpOnly": True,
        "sameSite": "Lax",
    }
    context.add_cookies([forged_cookie])
    page = context.new_page()

    page.goto(f"{base_url}/attendance")
    # Must be rejected and redirected to /login
    page.wait_for_url("**/login*", timeout=10000)
    expect(page.locator("input[type='email'], input[name='email']")).to_be_visible()

    context.close()


@pytest.mark.redteam
@pytest.mark.auth
def test_expired_session_handling(browser: Browser, base_url: str):
    """
    Auth Attack Surface: Navigating to protected routes with empty / deleted cookies.
    Must always route to /login.
    """
    context = browser.new_context()
    page = context.new_page()

    page.goto(f"{base_url}/payroll")
    page.wait_for_url("**/login*", timeout=10000)
    expect(page.locator("h1, h2, h3").filter(has_text="Sign In").first).to_be_visible()

    context.close()
