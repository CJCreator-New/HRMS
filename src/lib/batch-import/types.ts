export type ColumnType = "string" | "number" | "date" | "boolean" | "enum" | "pan" | "uan" | "email";

export interface BatchColumnDefinition {
  key: string;
  label: string;
  type?: ColumnType;
  required?: boolean;
  description?: string;
  exampleValue?: string | number | boolean;
  enumValues?: string[];
  pattern?: RegExp;
  patternError?: string;
  customValidator?: (value: unknown, row: Record<string, unknown>) => string | null;
  transform?: (value: unknown) => unknown;
}

export interface BatchSchemaDefinition<T = any> {
  entityName: string;
  displayName: string;
  description?: string;
  templateFileName: string;
  columns: BatchColumnDefinition[];
  sampleRows?: Record<string, unknown>[];
  notes?: string[];
  maxRows?: number;
  rowValidator?: (row: T, rowIndex: number, allRows: T[]) => string | null;
}

export interface BatchRowResult<T = any> {
  rowNumber: number;
  status: "valid" | "invalid";
  data: T;
  raw: Record<string, unknown>;
  errors: string[];
}

export interface BatchValidationReport<T = any> {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  rows: BatchRowResult<T>[];
  isValid: boolean;
  errors?: string[];
}

export interface BatchCommitResult<T = any> {
  success: boolean;
  total: number;
  successCount: number;
  errorCount: number;
  errors: string[];
  rowResults?: Array<{
    rowNumber: number;
    status: "success" | "failed";
    message?: string;
    data?: T;
  }>;
}
