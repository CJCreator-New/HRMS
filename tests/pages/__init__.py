# tests/pages/__init__.py
from .base_page import BasePage
from .login_page import LoginPage
from .dashboard_page import DashboardPage
from .attendance_page import AttendancePage
from .leave_page import LeavePage
from .payroll_page import PayrollPage
from .employees_page import EmployeesPage
from .approvals_page import ApprovalsPage
from .onboarding_page import OnboardingPage
from .offboarding_page import OffboardingPage
from .reimbursements_page import ReimbursementsPage
from .permissions_page import PermissionsPage
from .settings_page import SettingsPage

__all__ = [
    "BasePage",
    "LoginPage",
    "DashboardPage",
    "AttendancePage",
    "LeavePage",
    "PayrollPage",
    "EmployeesPage",
    "ApprovalsPage",
    "OnboardingPage",
    "OffboardingPage",
    "ReimbursementsPage",
    "PermissionsPage",
    "SettingsPage",
]
