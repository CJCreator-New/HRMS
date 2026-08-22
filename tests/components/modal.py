"""
Modal and Dialog Component Object.
Handles accessible modals, confirm dialogs, focus trapping, ESC key, and submit/cancel actions.
"""

from playwright.sync_api import Page, Locator, expect


class ModalComponent:
    def __init__(self, page: Page, test_id: str = "modal"):
        self.page = page
        self.test_id = test_id
        self.overlay = page.locator(f"[data-testid='{test_id}']").first
        self.dialog = self.overlay.locator("[role='dialog']").first
        self.close_button = self.dialog.locator("button[aria-label*='Close'], button[aria-label*='close']").first
        self.cancel_button = self.dialog.locator("button").filter(has_text="Cancel").first
        self.confirm_button = self.dialog.locator("button").filter(has_text="Confirm").or_(self.dialog.locator("button[type='submit']")).first

    def is_open(self) -> bool:
        """Returns whether the modal dialog is currently visible."""
        return self.dialog.is_visible()

    def get_title(self) -> str:
        """Returns the modal header title text."""
        header = self.dialog.locator("h2, h3, [data-testid*='title']").first
        return header.inner_text().strip() if header.is_visible() else ""

    def close(self):
        """Closes the dialog via the close 'X' button."""
        expect(self.close_button).to_be_visible()
        self.close_button.click()
        expect(self.dialog).not_to_be_visible()

    def cancel(self):
        """Cancels and dismisses the dialog."""
        expect(self.cancel_button).to_be_visible()
        self.cancel_button.click()
        expect(self.dialog).not_to_be_visible()

    def confirm(self):
        """Confirms the dialog action."""
        expect(self.confirm_button).to_be_visible()
        self.confirm_button.click()
        self.page.wait_for_timeout(300)

    def press_escape(self):
        """Dismisses the modal by triggering the Escape key."""
        self.page.keyboard.press("Escape")
        expect(self.dialog).not_to_be_visible()
