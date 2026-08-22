"""
Adversarial Red-Team: Awkward Responsive Breakpoints & Viewport Stress Tests.
Tests viewports right at border breakpoints (320px, 374px, 391px, 767px, 769px, 1023px, 1025px).
"""

import pytest
from playwright.sync_api import Page, expect
from tests.utils.assertions import assert_no_horizontal_overflow


AWKWARD_VIEWPORTS = [
    {"name": "Ultra Narrow 320px", "width": 320, "height": 568},
    {"name": "Narrow Mobile 350px", "width": 350, "height": 600},
    {"name": "Sub-Standard Mobile 374px", "width": 374, "height": 667},
    {"name": "Plus-Size Mobile 391px", "width": 391, "height": 844},
    {"name": "Pre-Tablet 767px", "width": 767, "height": 1024},
    {"name": "Post-Tablet 769px", "width": 769, "height": 1024},
    {"name": "Pre-Desktop 1023px", "width": 1023, "height": 768},
    {"name": "Post-Desktop 1025px", "width": 1025, "height": 768},
]


@pytest.mark.redteam
@pytest.mark.responsive
@pytest.mark.parametrize("vp", AWKWARD_VIEWPORTS, ids=lambda v: v["name"])
def test_awkward_viewports_no_horizontal_overflow(sys_admin_page: Page, vp: dict):
    """
    Responsive Red-Team: Scans critical pages across edge breakpoint viewports.
    Verifies that layout grid and tables do not break horizontal bounds.
    """
    sys_admin_page.set_viewport_size({"width": vp["width"], "height": vp["height"]})
    sys_admin_page.goto("http://localhost:3000/attendance")
    sys_admin_page.wait_for_load_state("domcontentloaded")

    assert_no_horizontal_overflow(sys_admin_page)
    expect(sys_admin_page.locator("body")).not_to_contain_text("Application error")
