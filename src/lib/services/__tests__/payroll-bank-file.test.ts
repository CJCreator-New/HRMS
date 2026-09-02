import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeSupabase } from "./helpers/fake-supabase";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  assertPermission: vi.fn(),
  validateRequestOrigin: vi.fn(),
  writeAuditLogAction: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/auth/assertPermission", () => ({
  assertPermission: mocks.assertPermission,
}));
vi.mock("@/lib/security", () => ({
  validateRequestOrigin: mocks.validateRequestOrigin,
}));
vi.mock("@/lib/actions/audit", () => ({
  writeAuditLogAction: mocks.writeAuditLogAction,
}));

import { generateBankDisbursementFileAction } from "@/lib/actions/payroll";

describe("Bank Disbursement File Generation (P2-6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertPermission.mockResolvedValue(null);
    mocks.validateRequestOrigin.mockResolvedValue(null);
    mocks.writeAuditLogAction.mockResolvedValue({ success: true });
  });

  it("generates generic CSV bank file with checksum and totals", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "payroll_periods") {
          return {
            data: { id: "period-1", year: 2026, month: 8, status: "completed" },
            error: null,
          };
        }
        if (state.table === "payslips") {
          return {
            data: [
              {
                id: "ps-1",
                net_pay: 50000,
                employee_id: "emp-1",
                employees: { id: "emp-1", full_name: "Alice Smith", employee_code: "EMP001" },
                statutory_profiles: { bank_account_number: "1234567890", bank_ifsc_code: "HDFC0001234", bank_name: "HDFC Bank" },
              },
              {
                id: "ps-2",
                net_pay: 60000,
                employee_id: "emp-2",
                employees: { id: "emp-2", full_name: "Bob Jones", employee_code: "EMP002" },
                statutory_profiles: { bank_account_number: "9876543210", bank_ifsc_code: "ICIC0005678", bank_name: "ICICI Bank" },
              },
            ],
            error: null,
          };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await generateBankDisbursementFileAction("period-1", "generic_csv");
    expect(res.success).toBe(true);
    expect(res.totalRecords).toBe(2);
    expect(res.totalAmount).toBe(110000);
    expect(res.fileName).toBe("BANK_DISBURSEMENT_GENERIC_CSV_2026_08.csv");
    expect(res.checksumSha256).toBeDefined();
    expect(res.fileContent).toContain("Sl_No,Employee_Code,Beneficiary_Name");
    expect(res.fileContent).toContain("Alice Smith");
    expect(res.fileContent).toContain("50000.00");
  });

  it("generates SBI format file when sbi format requested", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "payroll_periods") {
          return {
            data: { id: "period-1", year: 2026, month: 8, status: "completed" },
            error: null,
          };
        }
        if (state.table === "payslips") {
          return {
            data: [
              {
                id: "ps-1",
                net_pay: 75000,
                employee_id: "emp-1",
                employees: { id: "emp-1", full_name: "Charlie Brown", employee_code: "EMP003" },
                statutory_profiles: { bank_account_number: "111222333", bank_ifsc_code: "SBIN0000123", bank_name: "State Bank of India" },
              },
            ],
            error: null,
          };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await generateBankDisbursementFileAction("period-1", "sbi");
    expect(res.success).toBe(true);
    expect(res.fileName).toBe("BANK_DISBURSEMENT_SBI_2026_08.csv");
    expect(res.fileContent).toContain("Account_Type,Beneficiary_Account_Number,Amount");
    expect(res.fileContent).toContain("SAVINGS,111222333,75000.00,Charlie Brown");
  });

  it("fails if user lacks payroll.process permission", async () => {
    mocks.assertPermission.mockResolvedValue({ error: "Access denied" });
    const res = await generateBankDisbursementFileAction("period-1");
    expect(res.success).toBe(false);
    expect(res.error).toBe("Access denied");
  });
});
