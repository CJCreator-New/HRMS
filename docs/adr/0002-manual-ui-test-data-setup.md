# 2. Manual UI Test Data Setup Strategy

* **Status**: Accepted
* **Date**: 2026-08-12

## Context
During local development and testing of the HRMS application, sample data is required to test various workflows (employee onboarding, attendance marking, leave approval, payroll generation).

We evaluated two approaches:
1. Hardcoded automated SQL seed scripts (`00_test_seeds.sql`) pre-populating mock employees and attendance.
2. Manual UI data setup through the application UI to maintain a clean database state and test user flows end-to-end.

## Decision
We chose **Manual UI Data Setup**.

The database schema scripts will seed only essential baseline system catalog entries:
* Baseline RBAC roles (`employee`, `manager`, `hr`, `payroll_admin`, `system_admin`) and permission catalog.
* Standard default company settings container (`company_settings`).
* Standard Leave Types master (`CL`, `SL`, `EL`, `MATERNITY`, `PATERNITY`, `COMP_OFF`, `LOP`).
* Standard Indian Salary Component master (`BASIC`, `HRA`, `SPECIAL_ALLOWANCE`, `PF_EMP`, `ESI_EMP`, `PT`, `TDS`).

All operational test data (departments, managers, employees, work calendar assignments, attendance punches, leave requests, and payroll runs) will be created manually via the application UI during local testing.

## Consequences
### Positive
* Keeps database schema scripts clean and production-ready without dummy mock data pollution.
* Forces true end-to-end verification of application UI forms, validation logic, and authorization rules.

### Negative / Trade-offs
* Initial testing setup requires manually creating the first System Admin employee record and configuring organization structures via UI.
