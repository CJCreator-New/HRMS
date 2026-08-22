"""
Employee Directory Page Object (/employees).
"""

from playwright.sync_api import Page, expect
from tests.pages.base_page import BasePage
from tests.components.datatable import DataTableComponent


class EmployeesPage(BasePage):
    PATH = "/employees"

    def __init__(self, page: Page):
        super().__init__(page)
        self.table = DataTableComponent(page, name="employees")
        self.search_input = (
            page.locator("input[placeholder*='Search employees'], input[placeholder*='Search']").first
        )
        self.department_filter = page.locator("select[aria-label*='Department'], select").first
        self.status_filter = page.locator("select[aria-label*='Status'], select").nth(1)
        self.add_employee_btn = (
            page.locator("a[href='/onboarding'], button")
            .filter(has_text="Add Employee")
            .or_(page.locator("a[href='/onboarding']"))
            .first
        )

    def search_employee(self, query: str):
        """Types query in employee search box with debounced DOM update."""
        expect(self.search_input).to_be_visible()
        self.search_input.fill(query)

    def search(self, query: str):
        """Alias for search_employee."""
        self.search_employee(query)

    def filter_by_department(self, dept_name: str):
        """Filters employee directory by department."""
        if self.department_filter.is_visible():
            self.department_filter.select_option(label=dept_name)
