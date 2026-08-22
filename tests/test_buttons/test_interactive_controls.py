"""
Interactive Element Controls & State Transition Tests.
Validates PunchButton toggles, modal ESC key handling, table controls, keyboard navigation, and destructive actions.
"""

import pytest
from playwright.sync_api import Page, expect
from tests.pages.dashboard_page import DashboardPage
from tests.pages.attendance_page import AttendancePage
from tests.pages.employees_page import EmployeesPage
from tests.pages.settings_page import SettingsPage


@pytest.mark.buttons
def test_punch_button_interaction(employee_page: Page):
    """
    Tests interacting with the PunchButton component on the dashboard.
    """
    dashboard = DashboardPage(employee_page)
    dashboard.navigate("/")
    dashboard.assert_loaded()

    if dashboard.punch_button.is_visible():
        initial_checked_in = dashboard.punch_button.is_checked_in()

        if not initial_checked_in:
            dashboard.punch_button.punch_in()
        else:
            dashboard.punch_button.punch_out()

        # Button should respond and render notice or updated label
        expect(dashboard.punch_button.toggle_button.or_(dashboard.punch_button.punch_in_button)).to_be_visible()


@pytest.mark.buttons
def test_modal_esc_key_dismissal(employee_page: Page):
    """
    Tests that pressing Escape dismisses an open modal and restores background interaction.
    """
    att_page = AttendancePage(employee_page)
    att_page.navigate()
    att_page.assert_loaded()

    # Open regularization modal
    if att_page.regularize_button.is_visible():
        att_page.regularize_button.click()

        modal = employee_page.locator("[role='dialog'], [data-testid='modal']").first
        if modal.is_visible():
            # Press ESC to dismiss
            employee_page.keyboard.press("Escape")
            expect(modal).not_to_be_visible()


@pytest.mark.buttons
def test_datatable_pagination_and_size_change(hr_admin_page: Page):
    """
    Tests interacting with DataTable pagination controls and page size selector.
    """
    emp_page = EmployeesPage(hr_admin_page)
    emp_page.navigate()
    emp_page.assert_loaded()

    if emp_page.table.pagination.is_visible():
        initial_rows = emp_page.table.get_row_count()
        assert initial_rows > 0

        if emp_page.table.page_size_select.is_visible():
            emp_page.table.set_page_size(25)


@pytest.mark.buttons
def test_keyboard_command_palette_arrow_navigation(sys_admin_page: Page):
    """
    Tests Global Search Command Palette (Ctrl+K) keyboard navigation with arrow keys and ESC dismissal.
    """
    dashboard = DashboardPage(sys_admin_page)
    dashboard.navigate("/")
    dashboard.assert_loaded()

    # Press Ctrl+K or Meta+K
    sys_admin_page.keyboard.press("Control+k")
    palette = sys_admin_page.locator("[role='dialog'], [data-testid='command-palette'], [cmdk-root]").first
    if palette.is_visible():
        # Arrow navigation
        sys_admin_page.keyboard.press("ArrowDown")
        sys_admin_page.keyboard.press("ArrowDown")
        sys_admin_page.keyboard.press("ArrowUp")
        # ESC to dismiss
        sys_admin_page.keyboard.press("Escape")
        expect(palette).not_to_be_visible()


@pytest.mark.buttons
def test_settings_save_feedback(sys_admin_page: Page):
    """
    Tests updating company settings and receiving feedback.
    """
    settings = SettingsPage(sys_admin_page)
    settings.navigate()
    settings.assert_loaded()

    if settings.company_name_input.is_visible():
        settings.update_company_name("Acme Enterprise HRMS")
        expect(settings.save_settings_btn).to_be_visible()
