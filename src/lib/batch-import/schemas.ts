import type { BatchSchemaDefinition } from "./types";

/**
 * 1. Salary Structure Version Import Schema (§5.1)
 */
export interface SalaryImportRow {
  employee_code: string;
  component?: string;
  annual_ctc: number;
  effective_start_date: string;
  effective_end_date?: string;
}

export const SalaryStructureBatchSchema: BatchSchemaDefinition<SalaryImportRow> = {
  entityName: "salary_structure",
  displayName: "Salary Structure Versions",
  description: "Bulk assign effective-dated salary structure versions with annual CTC or component amounts.",
  templateFileName: "salary_structure_template.xlsx",
  columns: [
    {
      key: "employee_code",
      label: "Employee Code",
      type: "string",
      required: true,
      description: "Unique employee code (e.g. EMP-101)",
      exampleValue: "EMP-101",
    },
    {
      key: "annual_ctc",
      label: "Annual CTC (INR)",
      type: "number",
      required: true,
      description: "Total annual CTC amount in INR (e.g. 900000)",
      exampleValue: 900000,
    },
    {
      key: "effective_start_date",
      label: "Effective Start Date",
      type: "date",
      required: true,
      description: "Start date in YYYY-MM-DD format (e.g. 2026-09-01)",
      exampleValue: "2026-09-01",
    },
    {
      key: "effective_end_date",
      label: "Effective End Date",
      type: "date",
      required: false,
      description: "Optional end date in YYYY-MM-DD format. Leave blank for open-ended version.",
      exampleValue: "",
    },
  ],
  sampleRows: [
    {
      employee_code: "EMP-101",
      annual_ctc: 900000,
      effective_start_date: "2026-09-01",
      effective_end_date: "",
    },
    {
      employee_code: "EMP-102",
      annual_ctc: 1200000,
      effective_start_date: "2026-09-01",
      effective_end_date: "",
    },
  ],
  notes: [
    "Effective dates must not overlap with existing versions for the same employee.",
    "If effective_end_date is empty, the version remains active until a subsequent version is created.",
    "Monthly gross (CTC / 12) and Basic salary (50% of gross) are computed automatically.",
  ],
  rowValidator: (row, index, allRows) => {
    if (row.effective_start_date && row.effective_end_date) {
      if (new Date(row.effective_start_date) > new Date(row.effective_end_date)) {
        return `Effective start date (${row.effective_start_date}) cannot be after end date (${row.effective_end_date}).`;
      }
    }
    // Check internal batch duplicates for same employee and overlapping start date
    for (let j = 0; j < index; j++) {
      const prev = allRows[j];
      if (prev.employee_code && prev.employee_code.toLowerCase() === row.employee_code?.toLowerCase()) {
        if (prev.effective_start_date === row.effective_start_date) {
          return `Duplicate entry for employee ${row.employee_code} with same start date ${row.effective_start_date} in this batch.`;
        }
      }
    }
    return null;
  },
};

/**
 * 2. Statutory Profile Import Schema (§5.10)
 */
export interface StatutoryImportRow {
  employee_code: string;
  pan_number: string;
  uan_number?: string;
  pf_number?: string;
  esi_number?: string;
  pt_state: string;
  tax_regime: "new_regime" | "old_regime";
  pf_applicable: boolean;
  esi_applicable: boolean;
}

export const StatutoryProfileBatchSchema: BatchSchemaDefinition<StatutoryImportRow> = {
  entityName: "statutory_profile",
  displayName: "Statutory Profiles",
  description: "Bulk upsert employee statutory details including PAN, UAN, PF, ESI, PT State, and Tax Regime.",
  templateFileName: "statutory_profiles_template.xlsx",
  columns: [
    {
      key: "employee_code",
      label: "Employee Code",
      type: "string",
      required: true,
      description: "Unique employee code (e.g. EMP-101)",
      exampleValue: "EMP-101",
    },
    {
      key: "pan_number",
      label: "PAN Number",
      type: "pan",
      required: true,
      description: "10-character alphanumeric PAN (e.g. ABCDE1234F)",
      exampleValue: "ABCDE1234F",
    },
    {
      key: "uan_number",
      label: "UAN Number",
      type: "uan",
      required: false,
      description: "12-digit Universal Account Number (e.g. 100904567890)",
      exampleValue: "100904567890",
    },
    {
      key: "pf_number",
      label: "PF Number",
      type: "string",
      required: false,
      description: "PF Member ID / Registration number",
      exampleValue: "KN/BNG/0012345/000/0001234",
    },
    {
      key: "esi_number",
      label: "ESI Number",
      type: "string",
      required: false,
      description: "17-digit ESI Insurance Number",
      exampleValue: "31001234560001001",
    },
    {
      key: "pt_state",
      label: "PT State",
      type: "enum",
      required: true,
      enumValues: ["Karnataka", "Maharashtra", "Tamil Nadu", "Telangana", "Delhi", "West Bengal", "Gujarat", "Andhra Pradesh"],
      description: "State for Professional Tax deduction",
      exampleValue: "Karnataka",
    },
    {
      key: "tax_regime",
      label: "Tax Regime",
      type: "enum",
      required: true,
      enumValues: ["new_regime", "old_regime"],
      description: "Income tax regime: 'new_regime' or 'old_regime'",
      exampleValue: "new_regime",
    },
    {
      key: "pf_applicable",
      label: "PF Applicable",
      type: "boolean",
      required: false,
      description: "Yes / No (defaults to Yes)",
      exampleValue: "Yes",
    },
    {
      key: "esi_applicable",
      label: "ESI Applicable",
      type: "boolean",
      required: false,
      description: "Yes / No (defaults to Yes)",
      exampleValue: "Yes",
    },
  ],
  sampleRows: [
    {
      employee_code: "EMP-101",
      pan_number: "ABCDE1234F",
      uan_number: "100904567890",
      pf_number: "KN/BNG/0012345/000/0001234",
      esi_number: "31001234560001001",
      pt_state: "Karnataka",
      tax_regime: "new_regime",
      pf_applicable: "Yes",
      esi_applicable: "Yes",
    },
  ],
  notes: [
    "PAN must be in valid format (5 letters, 4 digits, 1 letter).",
    "UAN must be 12 numeric digits.",
    "Tax Regime must be 'new_regime' or 'old_regime'.",
  ],
};

/**
 * 3. Department & Org Assignment Import Schema (§2.1, §2.4)
 */
export interface DepartmentAssignmentImportRow {
  employee_code: string;
  department: string;
  designation?: string;
  manager_employee_code?: string;
  effective_date: string;
}

export const DepartmentAssignmentBatchSchema: BatchSchemaDefinition<DepartmentAssignmentImportRow> = {
  entityName: "department_assignment",
  displayName: "Department & Hierarchy Assignments",
  description: "Bulk assign employees to departments, designations, and reporting managers with effective dates.",
  templateFileName: "department_assignments_template.xlsx",
  columns: [
    {
      key: "employee_code",
      label: "Employee Code",
      type: "string",
      required: true,
      description: "Unique employee code (e.g. EMP-101)",
      exampleValue: "EMP-101",
    },
    {
      key: "department",
      label: "Department Name",
      type: "string",
      required: true,
      description: "Name of the department (e.g. Engineering, Sales)",
      exampleValue: "Engineering",
    },
    {
      key: "designation",
      label: "Designation / Title",
      type: "string",
      required: false,
      description: "Job title / designation (e.g. Senior Software Engineer)",
      exampleValue: "Senior Software Engineer",
    },
    {
      key: "manager_employee_code",
      label: "Manager Employee Code",
      type: "string",
      required: false,
      description: "Reporting manager's employee code (e.g. EMP-105)",
      exampleValue: "EMP-105",
    },
    {
      key: "effective_date",
      label: "Effective Date",
      type: "date",
      required: true,
      description: "Date from which this assignment takes effect (YYYY-MM-DD)",
      exampleValue: "2026-09-01",
    },
  ],
  sampleRows: [
    {
      employee_code: "EMP-101",
      department: "Engineering",
      designation: "Senior Software Engineer",
      manager_employee_code: "EMP-105",
      effective_date: "2026-09-01",
    },
    {
      employee_code: "EMP-102",
      department: "Product Management",
      designation: "Product Lead",
      manager_employee_code: "EMP-105",
      effective_date: "2026-09-01",
    },
  ],
  notes: [
    "Department will be created automatically if it does not already exist.",
    "Manager employee code must refer to a valid existing employee in the organization.",
    "Assignments are effective-dated and maintain full audit history.",
  ],
  rowValidator: (row) => {
    if (row.employee_code && row.manager_employee_code) {
      if (row.employee_code.toLowerCase() === row.manager_employee_code.toLowerCase()) {
        return `Employee ${row.employee_code} cannot report to themselves.`;
      }
    }
    return null;
  },
};

/**
 * 4. Calendar Template Assignment Import Schema (§3.5, §7)
 */
export interface CalendarAssignmentImportRow {
  scope: "employee" | "department";
  target_code: string;
  template_name: string;
  effective_start_date: string;
}

export const CalendarAssignmentBatchSchema: BatchSchemaDefinition<CalendarAssignmentImportRow> = {
  entityName: "calendar_assignment",
  displayName: "Calendar Template Assignments",
  description: "Bulk assign work calendar templates by employee code or by department name.",
  templateFileName: "calendar_assignments_template.xlsx",
  columns: [
    {
      key: "scope",
      label: "Assignment Scope",
      type: "enum",
      required: true,
      enumValues: ["employee", "department"],
      description: "Whether assigning to an individual 'employee' or entire 'department'",
      exampleValue: "employee",
    },
    {
      key: "target_code",
      label: "Employee Code or Dept Name",
      type: "string",
      required: true,
      description: "Employee Code (e.g. EMP-101) or Department Name (e.g. Engineering)",
      exampleValue: "EMP-101",
    },
    {
      key: "template_name",
      label: "Calendar Template Code or Name",
      type: "string",
      required: true,
      description: "Name or Code of the Work Calendar Template (e.g. DEFAULT_5DAY, Standard 5-Day Work Week)",
      exampleValue: "DEFAULT_5DAY",
    },
    {
      key: "effective_start_date",
      label: "Effective Start Date",
      type: "date",
      required: true,
      description: "Date when the calendar template takes effect (YYYY-MM-DD)",
      exampleValue: "2026-09-01",
    },
  ],
  sampleRows: [
    {
      scope: "employee",
      target_code: "EMP-101",
      template_name: "DEFAULT_5DAY",
      effective_start_date: "2026-09-01",
    },
    {
      scope: "department",
      target_code: "Engineering",
      template_name: "DEFAULT_5DAY",
      effective_start_date: "2026-09-01",
    },
  ],
  notes: [
    "Scope must be either 'employee' (for individual employee code) or 'department' (for department name).",
    "Department scope will assign all active employees currently assigned to that department.",
    "Calendar template code or name must match an existing work calendar template.",
  ],
};

/**
 * 5. Employee Bulk Provisioning Import Schema (§2.6)
 */
export interface EmployeeImportRow {
  code: string;
  name: string;
  email: string;
  doj: string;
}

export const EmployeeImportBatchSchema: BatchSchemaDefinition<EmployeeImportRow> = {
  entityName: "employee_import",
  displayName: "Employee Bulk Onboarding",
  description: "Bulk provision employee records and generate initial credentials in invited status.",
  templateFileName: "employee_import_template.xlsx",
  columns: [
    {
      key: "code",
      label: "Employee Code",
      type: "string",
      required: true,
      description: "Unique employee identification code (e.g. EMP-101)",
      exampleValue: "EMP-101",
    },
    {
      key: "name",
      label: "Full Name",
      type: "string",
      required: true,
      description: "Employee's complete legal name",
      exampleValue: "Ananya Roy",
    },
    {
      key: "email",
      label: "Corporate Email",
      type: "email",
      required: true,
      description: "Employee's corporate email address",
      exampleValue: "ananya@company.com",
    },
    {
      key: "doj",
      label: "Date of Joining",
      type: "date",
      required: false,
      description: "Date of joining in YYYY-MM-DD format (defaults to current date)",
      exampleValue: "2026-09-01",
    },
  ],
  sampleRows: [
    {
      code: "EMP-101",
      name: "Ananya Roy",
      email: "ananya@company.com",
      doj: "2026-09-01",
    },
    {
      code: "EMP-102",
      name: "Karan Johar",
      email: "karan@company.com",
      doj: "2026-09-01",
    },
  ],
  notes: [
    "Employees are provisioned with status 'invited' and must_change_password=true.",
    "A temporary initial password is automatically generated.",
  ],
};
