# 1. Direct Admin Password Generation for Employee Onboarding

* **Status**: Accepted
* **Date**: 2026-08-12

## Context
When onboarding a new employee, the system must bind the local employee record (`employees`) to an authentication account (`auth_user_id`) and transition the employee status from `invited` to `active`.

We evaluated two main activation patterns:
1. Email invitation links with one-time activation tokens.
2. Direct admin password generation with forced password change on first login.

## Decision
We chose **Direct Admin Password Generation**. 

When HR creates a new employee record:
1. HR enters the employee details and sets an initial temporary password.
2. The system creates the authentication user account immediately and links `auth_user_id`.
3. On first login with the temporary password, the system forces a mandatory password reset.
4. Upon successful password reset, the employee status transitions from `invited` to `active`, recording `activated_at` timestamp and initializing annual leave balance allocations.

## Consequences
### Positive
* Enables offline / local backend testing without requiring an operational SMTP email server.
* Gives HR immediate control to set up employees and hand over credentials directly.

### Negative / Trade-offs
* HR must securely communicate temporary credentials to the new employee.
* Requires application logic to enforce `must_change_password` flag before allowing full application access.
