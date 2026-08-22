/**
 * Centralized test credentials helper to prevent hardcoded plaintext secrets in test assertions.
 */
export const TEST_CREDENTIALS = {
  adminEmail: process.env.TEST_ADMIN_EMAIL || "hradmin@company.com",
  adminPassword: process.env.TEST_ADMIN_PASSWORD || "TestAdminPassword123!",
  defaultPassword: process.env.TEST_DEFAULT_PASSWORD || "TestDefaultPassword123!",
  newPassword: process.env.TEST_NEW_PASSWORD || "TestNewPassword123!",
  invalidPassword: "InvalidPassword123!",
};
