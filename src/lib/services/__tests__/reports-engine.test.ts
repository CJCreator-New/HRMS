import { describe, it, expect } from "vitest";
import {
  csvCell,
  csvRow,
  buildCsv,
  buildAttendanceCsv,
  buildLeaveCsv,
  buildStatutoryCsv,
  buildPayrollCsv,
} from "../reports-engine";

describe("csvCell", () => {
  it("leaves plain values unquoted", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell(123)).toBe("123");
    expect(csvCell(true)).toBe("true");
  });

  it("quotes values containing commas, quotes or newlines", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("treats null/undefined as empty", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("supports force quoting to match the legacy export format", () => {
    expect(csvCell("E1001", true)).toBe('"E1001"');
    expect(csvCell("Ja\"ne", true)).toBe('"Ja""ne"');
  });
});

describe("csvRow / buildCsv", () => {
  it("joins cells with commas", () => {
    expect(csvRow(["a", "b,c", 1])).toBe('a,"b,c",1');
  });

  it("builds a document with header and trailing newline", () => {
    const csv = buildCsv(["A", "B"], [["x", "y"], ["p", "q"]]);
    expect(csv).toBe("A,B\nx,y\np,q\n");
  });
});

describe("report builders (legacy format contract)", () => {
  it("builds the rep-01 attendance export", () => {
    const csv = buildAttendanceCsv([
      {
        employee_id: "e1", full_name: "Alice", employee_code: "E1", month_year: "2026-07",
        present_count: 20, half_day_count: 1, absent_count: 0, extra_work_count: 1,
        pending_review_count: 0, total_work_hours: 180,
      },
    ]);
    expect(csv).toBe(
      "Employee ID,Full Name,Employee Code,Month Year,Present,Half Day,Absent,Extra Work,Pending Review,Total Work Hours\n" +
      '"e1","Alice","E1","2026-07",20,1,0,1,0,180\n'
    );
  });

  it("builds the rep-02 leave utilization export", () => {
    const csv = buildLeaveCsv([
      {
        employee_id: "e2", full_name: "Bob", employee_code: "E2", leave_type_code: "CL",
        leave_type_name: "Casual Leave", year: 2026, allocated_days: 12, used_days: 4,
        pending_days: 1, current_balance: 8,
      },
    ]);
    expect(csv).toContain('"e2","Bob","E2","CL","Casual Leave",2026,12,4,1,8');
  });

  it("builds the rep-03 statutory register and escapes embedded quotes", () => {
    const csv = buildStatutoryCsv([
      {
        employees: { employee_code: "E3", full_name: 'Doe, "Jane"' },
        pan_number: "ABCDE1234F", uan_number: "100000000001",
        pf_applicable: true, esi_applicable: false, pt_state: "Karnataka", tax_regime: "new_regime",
      },
    ]);
    expect(csv).toContain('"E3","Doe, ""Jane"""');
    expect(csv).toContain(",true,false,");
  });

  it("builds the rep-04 payroll register export", () => {
    const csv = buildPayrollCsv([
      {
        revision_number: 1, employee_code: "E4", full_name: "Carol", payable_units: 28,
        lop_units: 2, gross_earnings: 70000, total_deductions: 2020, net_pay: 67980,
        is_published: false,
      },
    ]);
    expect(csv).toBe(
      "Revision Number,Employee Code,Full Name,Payable Units,LOP Units,Gross Earnings,Total Deductions,Net Pay,Is Published\n" +
      '1,"E4","Carol",28,2,70000,2020,67980,false\n'
    );
  });
});
