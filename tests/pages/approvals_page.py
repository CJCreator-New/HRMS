"""
Unified Approvals Workspace Page Object (/approvals).
"""

from playwright.sync_api import Page, expect
from tests.pages.base_page import BasePage
from tests.components.datatable import DataTableComponent


class ApprovalsPage(BasePage):
    PATH = "/approvals"

    def __init__(self, page: Page):
        super().__init__(page)
        self.table = DataTableComponent(page, name="approvals")
        self.all_items_chip = page.locator("button").filter(has_text="All Items").first
        self.leave_chip = page.locator("button").filter(has_text="Leave Requests").first
        self.reimbursement_chip = page.locator("button").filter(has_text="Reimbursements").first
        self.attendance_chip = page.locator("button").filter(has_text="Attendance Corrections").first
        self.clear_filters_button = page.locator("button").filter(has_text="Clear Filter").or_(page.locator("button").filter(has_text="Clear All Filters")).first
        self.select_all_checkbox = page.locator("[data-testid='select-all-approvals']")
        self.batch_approve_button = page.locator("[data-testid='approve-selected-btn']")

    def filter_by_module(self, module_label: str):
        """Clicks module filter chip."""
        chip = self.page.locator("button").filter(has_text=module_label).first
        expect(chip).to_be_visible()
        chip.click()
        self.page.wait_for_timeout(400)

    def approve_first_item(self):
        """Approves the first pending item in the table."""
        approve_btn = self.page.locator("button").filter(has_text="Approve").first
        expect(approve_btn).to_be_visible()
        approve_btn.click()
        self.page.wait_for_timeout(800)
