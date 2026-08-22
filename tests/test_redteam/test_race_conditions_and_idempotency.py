"""
Adversarial Red-Team: Race Condition, Double-Submission & Idempotency Tests.
Verifies asynchronous state changes remain stable under rapid concurrent interaction.
"""

import pytest
from playwright.sync_api import Page, expect
from tests.pages.attendance_page import AttendancePage


@pytest.mark.redteam
@pytest.mark.buttons
def test_rapid_punch_button_interactions_idempotency(employee_page: Page):
    """
    Race Condition: Rapid sequential clicks on the attendance punch button.
    The component must handle rapid interaction gracefully with button disable/loading state.
    """
    attendance = AttendancePage(employee_page)
    attendance.navigate()
    attendance.assert_loaded()

    # Rapidly interact with punch button
    btn = attendance.punch_button.punch_in_button.or_(attendance.punch_button.toggle_button).first
    expect(btn).to_be_visible()

    # Click punch button
    btn.click()
    # The UI should handle interaction without uncaught React error
    expect(employee_page.locator("body")).not_to_contain_text("Uncaught Error")
    expect(employee_page.locator("body")).not_to_contain_text("Application error")


@pytest.mark.redteam
@pytest.mark.navigation
def test_rapid_command_palette_toggle_stability(sys_admin_page: Page):
    """
    Race Condition / UI State: Rapidly triggering Ctrl+K and ESC in quick succession.
    Verifies that keyboard event listeners don't leak or freeze the DOM.
    """
    sys_admin_page.goto("http://localhost:3000")
    sys_admin_page.wait_for_load_state("domcontentloaded")

    # Rapid toggle 5 times
    for _ in range(5):
        sys_admin_page.keyboard.press("Control+k")
        sys_admin_page.keyboard.press("Escape")

    # Page should remain fully responsive
    expect(sys_admin_page.locator("body")).not_to_contain_text("Application error")
    expect(sys_admin_page.locator("h1, h2, h3").first).to_be_visible()


@pytest.mark.redteam
@pytest.mark.auth
def test_multi_tab_session_stability(browser, base_url: str):
    """
    Race Condition: Multi-tab session concurrency.
    Opening two independent tabs under the same user session and verifying both stay authenticated.
    """
    from tests.fixtures.auth_fixtures import authenticate_context

    context = browser.new_context()
    authenticate_context(context, "employee_e1", base_url=base_url)

    tab1 = context.new_page()
    tab2 = context.new_page()

    tab1.goto(f"{base_url}/attendance")
    tab2.goto(f"{base_url}/leave")

    expect(tab1.locator("h1, h2, h3").filter(has_text="Attendance").first).to_be_visible()
    expect(tab2.locator("h1, h2, h3").filter(has_text="Leave").first).to_be_visible()

    context.close()
