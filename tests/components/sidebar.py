"""
Sidebar Navigation Component Object.
Manages category groupings, route links, approvals badge count, and mobile drawer toggling.
"""

from playwright.sync_api import Page, Locator, expect


class SidebarComponent:
    def __init__(self, page: Page):
        self.page = page
        self.sidebar = page.locator("aside, nav[aria-label*='Sidebar'], nav").first
        self.mobile_drawer = page.locator("[role='dialog'] nav, aside.fixed").first
        self.mobile_close_btn = page.locator("button[aria-label*='Close navigation menu']").first

    def get_link(self, path: str) -> Locator:
        """Returns the locator for a sidebar route link by href or test id."""
        test_id = f"nav-{path.strip('/').replace('/', '-') or 'home'}"
        return self.page.locator(f"[data-testid='{test_id}']").or_(self.page.locator(f"a[href='{path}']")).first

    def navigate_to(self, path: str):
        """Clicks a sidebar navigation link and waits for domcontentloaded."""
        link = self.get_link(path)
        expect(link).to_be_visible()
        link.click()
        self.page.wait_for_timeout(400)
        self.page.wait_for_load_state("domcontentloaded")

    def is_link_active(self, path: str) -> bool:
        """Returns True if the link is marked active (via aria-current or active CSS class)."""
        link = self.get_link(path)
        if link.count() > 0:
            aria_current = link.get_attribute("aria-current")
            if aria_current == "page":
                return True
            class_attr = link.get_attribute("class") or ""
            return "bg-sidebar-active" in class_attr or "bg-blue-600" in class_attr or "text-white" in class_attr
        return False

    def get_approvals_badge_count(self) -> int:
        """Returns the pending approvals count badge value."""
        badge = self.sidebar.locator("a[href='/approvals'] span.rounded-full, a[href='/approvals'] span.bg-amber-500").first
        if badge.is_visible():
            text = badge.inner_text().strip()
            return int(text) if text.isdigit() else 0
        return 0
