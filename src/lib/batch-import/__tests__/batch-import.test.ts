import { describe, it, expect } from "vitest";
import {
  generateCsvTemplate,
  generateXlsxTemplate,
  parseAndValidateBatchFile,
  validateBatchRows,
  normalizeHeader,
} from "../index";
import {
  SalaryStructureBatchSchema,
  StatutoryProfileBatchSchema,
  DepartmentAssignmentBatchSchema,
  CalendarAssignmentBatchSchema,
  EmployeeImportBatchSchema,
} from "../schemas";

describe("Batch Import Utilities", () => {
  describe("normalizeHeader", () => {
    it("converts spaces, hyphens, and casing to uniform snake_case", () => {
      expect(normalizeHeader("Employee Code")).toBe("employee_code");
      expect(normalizeHeader("Employee-Code")).toBe("employee_code");
      expect(normalizeHeader("  EMPLOYEE_CODE  ")).toBe("employee_code");
      expect(normalizeHeader("PAN Number *")).toBe("pan_number");
    });
  });

  describe("Template Generation", () => {
    it("generates CSV template with correct headers and example row", () => {
      const csv = generateCsvTemplate(SalaryStructureBatchSchema);
      expect(csv).toContain("employee_code,annual_ctc,effective_start_date,effective_end_date");
      expect(csv).toContain("EMP-101,900000,2026-09-01,");
    });

    it("generates valid XLSX workbook buffer", async () => {
      const buffer = await generateXlsxTemplate(StatutoryProfileBatchSchema);
      expect(buffer).toBeInstanceOf(Uint8Array);
      expect(buffer.length).toBeGreaterThan(100);
    });
  });

  describe("Parser & Validator", () => {
    it("parses valid CSV string and produces valid report", async () => {
      const csv = `employee_code,annual_ctc,effective_start_date,effective_end_date\nEMP-101,900000,2026-09-01,\nEMP-102,1200000,2026-09-01,`;
      const report = await parseAndValidateBatchFile(csv, SalaryStructureBatchSchema);

      expect(report.totalRows).toBe(2);
      expect(report.validCount).toBe(2);
      expect(report.invalidCount).toBe(0);
      expect(report.isValid).toBe(true);
      expect(report.rows[0].data.employee_code).toBe("EMP-101");
      expect(report.rows[0].data.annual_ctc).toBe(900000);
    });

    it("parses valid XLSX buffer and produces valid report", async () => {
      const xlsxBuffer = await generateXlsxTemplate(SalaryStructureBatchSchema);
      const report = await parseAndValidateBatchFile(xlsxBuffer, SalaryStructureBatchSchema);

      expect(report.totalRows).toBeGreaterThanOrEqual(1);
      expect(report.isValid).toBe(true);
      expect(report.rows[0].data.employee_code).toBe("EMP-101");
    });

    it("flags invalid row with missing required fields or bad format", async () => {
      const csv = `employee_code,pan_number,pt_state,tax_regime\nEMP-101,INVALIDPAN,Karnataka,new_regime\nEMP-102,ABCDE1234F,InvalidState,new_regime`;
      const report = await parseAndValidateBatchFile(csv, StatutoryProfileBatchSchema);

      expect(report.totalRows).toBe(2);
      expect(report.validCount).toBe(0);
      expect(report.invalidCount).toBe(2);
      expect(report.isValid).toBe(false);

      expect(report.rows[0].errors[0]).toContain("PAN");
      expect(report.rows[1].errors[0]).toContain("PT State must be one of");
    });

    it("detects date range anomalies and internal duplicates in salary schema", async () => {
      const csv = `employee_code,annual_ctc,effective_start_date,effective_end_date\nEMP-101,900000,2026-09-01,2026-08-01\nEMP-102,1000000,2026-09-01,\nEMP-102,1200000,2026-09-01,`;
      const report = await parseAndValidateBatchFile(csv, SalaryStructureBatchSchema);

      expect(report.rows[0].errors.some((e) => e.includes("cannot be after end date"))).toBe(true);
      expect(report.rows[2].errors.some((e) => e.includes("Duplicate entry for employee"))).toBe(true);
    });

    it("enforces max row limit", () => {
      const mockRows = Array.from({ length: 505 }, (_, i) => ({
        employee_code: `EMP-${i}`,
        department: "Engineering",
        effective_date: "2026-09-01",
      }));
      const report = validateBatchRows(mockRows, DepartmentAssignmentBatchSchema);
      expect(report.isValid).toBe(false);
      expect(report.errors?.[0]).toContain("exceeds maximum limit of 500 rows");
    });
  });
});
