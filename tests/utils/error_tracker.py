"""
Error tracking utility for Playwright tests.
Monitors console errors, unhandled exceptions, and failed network responses.
"""

from typing import List, Dict, Any
from playwright.sync_api import Page, ConsoleMessage, Response


class ErrorTracker:
    def __init__(self, page: Page):
        self.page = page
        self.page_errors: List[str] = []
        self.console_errors: List[str] = []
        self.failed_requests: List[Dict[str, Any]] = []

        self._attach_listeners()

    def _attach_listeners(self):
        self.page.on("pageerror", self._on_page_error)
        self.page.on("console", self._on_console_message)
        self.page.on("response", self._on_response)

    def _on_page_error(self, exc):
        self.page_errors.append(str(exc))

    def _on_console_message(self, msg: ConsoleMessage):
        if msg.type == "error":
            text = msg.text
            # Ignore harmless Next.js dev server notices or expected CSP notices
            if "favicon.ico" not in text and "Download the React DevTools" not in text:
                self.console_errors.append(text)

    def _on_response(self, response: Response):
        status = response.status
        url = response.url
        # Capture unexpected server 500 errors
        if status >= 500:
            self.failed_requests.append({
                "url": url,
                "status": status,
                "status_text": response.status_text,
            })

    def assert_no_critical_errors(self):
        """
        Asserts that no uncaught React/JavaScript exceptions or 500 server crashes occurred.
        """
        assert len(self.page_errors) == 0, (
            f"Uncaught page exceptions detected ({len(self.page_errors)}):\n"
            + "\n".join(f"  - {err}" for err in self.page_errors)
        )
        assert len(self.failed_requests) == 0, (
            f"Server 5xx errors detected ({len(self.failed_requests)}):\n"
            + "\n".join(f"  - {req['url']} [{req['status']}]" for req in self.failed_requests)
        )

    def clear(self):
        self.page_errors.clear()
        self.console_errors.clear()
        self.failed_requests.clear()
