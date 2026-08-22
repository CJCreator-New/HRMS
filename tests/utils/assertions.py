"""
Custom assertion helpers for HRMS Python Playwright tests.
"""

import re
from playwright.sync_api import Page, expect


def assert_url_contains(page: Page, expected_path: str, timeout: float = 10000):
    """
    Asserts that the page URL path matches or contains the expected path using regex.
    """
    pattern = re.compile(rf".*{re.escape(expected_path)}.*")
    expect(page).to_have_url(pattern, timeout=timeout)


def assert_element_visible(page: Page, locator, timeout: float = 8000):
    """
    Asserts that an element is visible within timeout.
    """
    if isinstance(locator, str):
        locator = page.locator(locator)
    expect(locator.first).to_be_visible(timeout=timeout)


def assert_heading(page: Page, expected_text: str, timeout: float = 8000):
    """
    Asserts that an h1, h2 or page title containing the expected text is visible.
    """
    heading = page.get_by_role("heading", name=expected_text, exact=False).first
    expect(heading).to_be_visible(timeout=timeout)


def assert_toast_message(page: Page, expected_text: str, timeout: float = 8000):
    """
    Asserts that a floating Toast notification containing the expected text appears.
    """
    toast = page.locator("[role='status'], [role='alert'], .toast").filter(
        has_text=expected_text
    ).first
    expect(toast).to_be_visible(timeout=timeout)


def assert_no_horizontal_overflow(page: Page):
    """
    Evaluates that the document body width does not produce unwanted root horizontal scrolling.
    """
    overflow = page.evaluate("""
        () => {
            const bodyWidth = document.body.offsetWidth;
            const winWidth = window.innerWidth;
            return bodyWidth > winWidth + 15;
        }
    """)
    assert not overflow, "Horizontal document overflow detected on page layout"
