"""
Login Page Object.
Handles /login user authentication, form inputs, validation errors, and password reset.
"""

from playwright.sync_api import Page, expect
from tests.pages.base_page import BasePage


class LoginPage(BasePage):
    PATH = "/login"

    def __init__(self, page: Page):
        super().__init__(page)
        self.email_input = page.locator("input[type='email'], input[name='email']").first
        self.password_input = page.locator("input[type='password'], input[name='password']").first
        self.submit_button = page.locator("button[type='submit']").first
        self.error_banner = page.locator("[role='alert'], .text-red-600, .bg-red-50").first
        self.forgot_password_button = page.locator("button, a").filter(has_text="Forgot").first
        self.reset_email_input = page.locator("input[placeholder*='work email'], input[placeholder*='name@company.com'], input[type='email']").first
        self.send_reset_link_button = page.locator("button").filter(has_text="Send Reset Instructions").or_(page.locator("button").filter(has_text="Send")).first

    def login(self, email: str, password: str):
        """Fills credentials and submits the login form."""
        self.navigate()
        expect(self.email_input).to_be_visible()
        self.email_input.fill(email)
        self.password_input.fill(password)
        self.submit_button.click()
        return self

    def get_error_text(self) -> str:
        """Returns the displayed error message text."""
        banner = self.page.locator("[role='alert'], div.text-red-600, div.bg-red-50, p.text-red-600").first
        if banner.count() > 0:
            return banner.text_content() or ""
        return ""

    def open_forgot_password(self):
        """Opens the forgot password sub-form."""
        if self.forgot_password_button.is_visible():
            self.forgot_password_button.click()
            self.page.wait_for_timeout(300)

    def request_password_reset(self, email: str):
        """Requests password reset for the specified email."""
        self.navigate()
        self.open_forgot_password()
        if self.reset_email_input.is_visible():
            self.reset_email_input.fill(email)
        if self.send_reset_link_button.is_visible():
            self.send_reset_link_button.click()
        self.page.wait_for_timeout(500)
