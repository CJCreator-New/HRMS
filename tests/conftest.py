"""
Pytest configuration and global hooks for HRMS Python Playwright Test Suite.
"""

import os
import pytest
from pathlib import Path
from playwright.sync_api import Browser, BrowserContext, Page
from tests.fixtures.page_fixtures import (
    login_as,
    sys_admin_page,
    hr_admin_page,
    payroll_admin_page,
    manager_page,
    employee_page,
    multi_role_page,
)
from tests.utils.error_tracker import ErrorTracker

# Artifact directories
RESULTS_DIR = Path("test-results")
SCREENSHOTS_DIR = RESULTS_DIR / "screenshots"
TRACES_DIR = RESULTS_DIR / "traces"


def pytest_configure(config):
    """Ensures test artifact directories exist before test run."""
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
    TRACES_DIR.mkdir(parents=True, exist_ok=True)


@pytest.fixture(scope="session")
def base_url(pytestconfig) -> str:
    """Base URL for application under test."""
    url = (
        os.environ.get("BASE_URL")
        or os.environ.get("PLAYWRIGHT_TEST_BASE_URL")
        or pytestconfig.getini("base_url")
        or "http://localhost:3000"
    )
    return url.rstrip("/")


@pytest.fixture(scope="function")
def context(browser: Browser, base_url: str) -> BrowserContext:
    """
    Creates an isolated BrowserContext with trace recording enabled.
    """
    context = browser.new_context(
        base_url=base_url,
        viewport={"width": 1280, "height": 800},
        ignore_https_errors=True,
    )
    context.tracing.start(screenshots=True, snapshots=True, sources=True)
    yield context
    try:
        context.close()
    except Exception:
        pass


@pytest.fixture(scope="function")
def page(context: BrowserContext) -> Page:
    """
    Standard unauthenticated Page fixture with error monitoring attached.
    """
    page = context.new_page()
    tracker = ErrorTracker(page)
    setattr(page, "_error_tracker", tracker)
    yield page
    try:
        if not page.is_closed():
            page.close()
    except Exception:
        pass


@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    """
    Hook to capture screenshot and trace when a test fails.
    """
    outcome = yield
    report = outcome.get_result()

    if report.when == "call" and report.failed:
        test_name = (
            item.name.replace("/", "_")
            .replace(":", "_")
            .replace("[", "_")
            .replace("]", "_")
            .replace(" ", "_")
        )

        # Look for any active Page fixture in funcargs
        for arg_name, arg_val in item.funcargs.items():
            if isinstance(arg_val, Page) and not arg_val.is_closed():
                try:
                    screenshot_path = SCREENSHOTS_DIR / f"{test_name}.png"
                    arg_val.screenshot(path=str(screenshot_path), full_page=True)
                except Exception:
                    pass
                break

        # Look for BrowserContext to stop and export trace
        context = item.funcargs.get("context")
        if not context:
            for arg_val in item.funcargs.values():
                if isinstance(arg_val, Page) and not arg_val.is_closed():
                    context = arg_val.context
                    break

        if context:
            try:
                trace_path = TRACES_DIR / f"{test_name}.zip"
                context.tracing.stop(path=str(trace_path))
            except Exception:
                pass
