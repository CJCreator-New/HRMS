"""
DataTable Reusable Component Object.
Provides interactions with paginated, sortable data grids.
"""

from playwright.sync_api import Page, Locator, expect


class DataTableComponent:
    def __init__(self, page: Page, name: str = ""):
        self.page = page
        self.name = name
        self.container = (
            page.locator(f"[data-testid='{name}-table']").first
            if name
            else page.locator("table, [data-testid*='-table']").first
        )
        self.table = (
            page.locator(f"[data-testid='{name}-table'] table").or_(
                page.locator(f"[data-testid='{name}-table']")
            ).first
            if name
            else page.locator("table").first
        )
        self.pagination = page.locator("[data-testid='pagination']").first
        self.prev_button = page.locator("[data-testid='pagination-prev']").first
        self.next_button = page.locator("[data-testid='pagination-next']").first
        self.page_size_select = page.locator("[data-testid='pagination-size']").first

    def get_row_count(self) -> int:
        """Returns the count of data rows in the table body."""
        return self.page.locator("tbody tr").count()

    def get_cell_text(self, row_idx: int, col_idx: int) -> str:
        """Gets cell text at given 0-indexed row and column."""
        row = self.page.locator("tbody tr").nth(row_idx)
        cell = row.locator("td, th").nth(col_idx)
        return cell.inner_text().strip() if cell.is_visible() else ""

    def sort_by_column(self, column_key: str):
        """Clicks column header to toggle sort order."""
        sort_btn = self.page.locator(f"[data-testid='sort-{column_key}'], th button").first
        expect(sort_btn).to_be_visible()
        sort_btn.click()
        self.page.wait_for_timeout(300)

    def next_page(self):
        """Clicks next pagination page."""
        expect(self.next_button).to_be_visible()
        self.next_button.click()
        self.page.wait_for_timeout(300)

    def prev_page(self):
        """Clicks previous pagination page."""
        expect(self.prev_button).to_be_visible()
        self.prev_button.click()
        self.page.wait_for_timeout(300)

    def set_page_size(self, size: int):
        """Selects page size from dropdown."""
        expect(self.page_size_select).to_be_visible()
        self.page_size_select.select_option(str(size))
        self.page_size_timeout = 300
