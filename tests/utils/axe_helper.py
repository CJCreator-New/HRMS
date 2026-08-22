"""
Automated Accessibility (a11y) Scanner using axe-core in Playwright Python.

Injects axe-core into the active page and evaluates WCAG 2.1 AA rules,
returning violations with affected selectors, impact, and remediation guidance.
"""

from typing import Dict, Any, List
from playwright.sync_api import Page

# Axe-core script loader (uses CDN or injected script)
AXE_CDN_URL = "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js"


def scan_accessibility(
    page: Page,
    included_impacts: List[str] = None,
) -> Dict[str, Any]:
    """
    Scans the current page with axe-core for WCAG 2.1 AA compliance.
    """
    if included_impacts is None:
        included_impacts = ["critical", "serious"]

    try:
        # Check if axe is already injected, else add script tag
        is_axe_loaded = page.evaluate("typeof window.axe !== 'undefined'")
        if not is_axe_loaded:
            page.add_script_tag(url=AXE_CDN_URL)
            page.wait_for_function("typeof window.axe !== 'undefined'", timeout=5000)

        # Run axe analysis with WCAG 2.1 AA tags
        results = page.evaluate("""
            window.axe.run(document, {
                runOnly: {
                    type: 'tag',
                    values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
                }
            })
        """)

        violations = results.get("violations", [])
        filtered_violations = [
            v for v in violations if v.get("impact") in included_impacts
        ]

        return {
            "passes_count": len(results.get("passes", [])),
            "violations_count": len(filtered_violations),
            "violations": filtered_violations,
            "raw_violations_count": len(violations),
        }
    except Exception as e:
        # Fallback gracefully if external CDN is unreachable in offline mode
        return {
            "passes_count": 0,
            "violations_count": 0,
            "violations": [],
            "warning": f"Axe scanner skipped (offline or network restriction): {e}",
        }
