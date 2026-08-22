"""
Direct Employee Onboarding Wizard Page Object (/onboarding).
"""

from playwright.sync_api import Page, expect
from tests.pages.base_page import BasePage


class OnboardingPage(BasePage):
    PATH = "/onboarding"

    def __init__(self, page: Page):
        super().__init__(page)
        self.next_button = (
            page.locator("button")
            .filter(has_text="Next Step")
            .or_(page.locator("button").filter(has_text="Next"))
            .first
        )
        self.prev_button = (
            page.locator("button")
            .filter(has_text="Previous")
            .or_(page.locator("button").filter(has_text="Back"))
            .first
        )
        self.submit_button = (
            page.locator("button")
            .filter(has_text="Complete Onboarding")
            .or_(page.locator("button").filter(has_text="Submit"))
            .first
        )

    def fill_personal_info(self, first_name: str, last_name: str, email: str, phone: str = "9876543210"):
        """Fills Step 1 Personal Information."""
        self.page.fill("input[name='first_name'], input[placeholder*='First']", first_name)
        self.page.fill("input[name='last_name'], input[placeholder*='Last']", last_name)
        self.page.fill("input[name='email'], input[placeholder*='Email']", email)
        phone_input = self.page.locator("input[name='phone'], input[placeholder*='Phone']").first
        if phone_input.is_visible():
            phone_input.fill(phone)
        expect(self.next_button).to_be_enabled()
        self.next_button.click()

    def fill_job_details(self, department_idx: int = 1, designation: str = "Software Engineer"):
        """Fills Step 2 Job Details."""
        dept_select = self.page.locator("select[name='department_id'], select").first
        if dept_select.is_visible():
            dept_select.select_option(index=department_idx)
        desig_input = self.page.locator("input[name='designation'], input[placeholder*='Designation']").first
        if desig_input.is_visible():
            desig_input.fill(designation)
        expect(self.next_button).to_be_enabled()
        self.next_button.click()

    def fill_compensation(self, basic_salary: str = "50000"):
        """Fills Step 3 Compensation details."""
        salary_input = self.page.locator("input[name='basic_salary'], input[placeholder*='Basic'], input[type='number']").first
        if salary_input.is_visible():
            salary_input.fill(basic_salary)
        expect(self.next_button).to_be_enabled()
        self.next_button.click()

    def submit_onboarding(self):
        """Completes and submits the onboarding wizard."""
        expect(self.submit_button).to_be_visible()
        self.submit_button.click()
