import ExcelJS from "exceljs";
import Papa from "papaparse";
import type {
  BatchColumnDefinition,
  BatchSchemaDefinition,
  BatchValidationReport,
  BatchRowResult,
} from "./types";

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const UAN_REGEX = /^\d{12}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Normalizes a header or key to snake_case / lowercase identifier for matching.
 */
export function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Parses raw text (CSV) or ArrayBuffer / Buffer (XLSX or CSV) into an array of objects.
 */
export async function parseRawFileContent(
  content: string | ArrayBuffer | Uint8Array
): Promise<Array<Record<string, unknown>>> {
  if (typeof content === "string") {
    const parsed = Papa.parse<Record<string, unknown>>(content, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (header) => header.trim(),
    });
    return (parsed.data || []) as Array<Record<string, unknown>>;
  }

  const uint8 = content instanceof Uint8Array ? content : new Uint8Array(content);

  // Check if buffer is an XLSX file (PK zip signature: 0x50, 0x4B)
  const isZip = uint8.length >= 4 && uint8[0] === 0x50 && uint8[1] === 0x4b;

  if (isZip) {
    const workbook = new ExcelJS.Workbook();
    const arrayBuffer = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength) as ArrayBuffer;
    await workbook.xlsx.load(arrayBuffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) return [];

    const headers: string[] = [];
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headers[colNumber] = cell.text?.trim() || "";
    });

    const rawRows: Array<Record<string, unknown>> = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const rowObj: Record<string, unknown> = {};
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const header = headers[colNumber];
        if (header) {
          let val: unknown = cell.value;
          if (val && typeof val === "object") {
            if ("result" in (val as Record<string, unknown>)) {
              val = (val as Record<string, unknown>).result;
            } else if ("text" in (val as Record<string, unknown>)) {
              val = (val as Record<string, unknown>).text;
            }
          }
          if (val instanceof Date) {
            val = val.toISOString().split("T")[0];
          }
          rowObj[header] = val !== undefined && val !== null ? String(val).trim() : "";
        }
      });
      rawRows.push(rowObj);
    });

    return rawRows;
  }

  // Otherwise, treat as UTF-8 CSV text
  const text = new TextDecoder("utf-8").decode(uint8);
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });
  return (parsed.data || []) as Array<Record<string, unknown>>;
}

/**
 * Validates and transforms a single column value.
 */
function validateColumnValue(
  col: BatchColumnDefinition,
  rawValue: unknown,
  row: Record<string, unknown>
): { value: unknown; error: string | null } {
  let val = rawValue !== undefined && rawValue !== null ? String(rawValue).trim() : "";

  // Check required
  if (col.required && val.length === 0) {
    return { value: null, error: `${col.label} is required.` };
  }

  if (val.length === 0) {
    return { value: null, error: null };
  }

  // Column type checks
  if (col.type === "number") {
    const num = Number(val.replace(/,/g, ""));
    if (isNaN(num)) {
      return { value: val, error: `${col.label} must be a valid number.` };
    }
    return { value: num, error: null };
  }

  if (col.type === "boolean") {
    const lower = val.toLowerCase();
    if (["true", "yes", "1", "y"].includes(lower)) {
      return { value: true, error: null };
    }
    if (["false", "no", "0", "n"].includes(lower)) {
      return { value: false, error: null };
    }
    return { value: val, error: `${col.label} must be 'yes'/'no' or 'true'/'false'.` };
  }

  if (col.type === "pan") {
    val = val.toUpperCase();
    if (!PAN_REGEX.test(val)) {
      return { value: val, error: `${col.label} must be a valid 10-character PAN (e.g. ABCDE1234F).` };
    }
    return { value: val, error: null };
  }

  if (col.type === "uan") {
    if (!UAN_REGEX.test(val)) {
      return { value: val, error: `${col.label} must be a valid 12-digit UAN number.` };
    }
    return { value: val, error: null };
  }

  if (col.type === "email") {
    if (!EMAIL_REGEX.test(val)) {
      return { value: val, error: `${col.label} must be a valid email address.` };
    }
    return { value: val, error: null };
  }

  if (col.type === "date") {
    // Handle formats like YYYY-MM-DD or DD/MM/YYYY or date object string
    let formattedDate = val;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
      const [d, m, y] = val.split("/");
      formattedDate = `${y}-${m}-${d}`;
    } else if (/^\d{2}-\d{2}-\d{4}$/.test(val)) {
      const [d, m, y] = val.split("-");
      formattedDate = `${y}-${m}-${d}`;
    }

    if (!DATE_REGEX.test(formattedDate)) {
      // Check if Date.parse works
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        formattedDate = d.toISOString().split("T")[0];
      } else {
        return { value: val, error: `${col.label} must be a valid date in YYYY-MM-DD format.` };
      }
    }
    return { value: formattedDate, error: null };
  }

  if (col.enumValues && col.enumValues.length > 0) {
    const matched = col.enumValues.find(
      (e) => e.toLowerCase() === val.toLowerCase() || normalizeHeader(e) === normalizeHeader(val)
    );
    if (!matched) {
      return {
        value: val,
        error: `${col.label} must be one of: ${col.enumValues.join(", ")}.`,
      };
    }
    val = matched;
  }

  if (col.pattern && !col.pattern.test(val)) {
    return {
      value: val,
      error: col.patternError || `${col.label} is in an invalid format.`,
    };
  }

  if (col.customValidator) {
    const customErr = col.customValidator(val, row);
    if (customErr) {
      return { value: val, error: customErr };
    }
  }

  let finalVal: unknown = val;
  if (col.transform) {
    finalVal = col.transform(val);
  }

  return { value: finalVal, error: null };
}

/**
 * Validates an array of parsed rows against a BatchSchemaDefinition.
 */
export function validateBatchRows<T = Record<string, unknown>>(
  rawRows: Array<Record<string, unknown>>,
  schema: BatchSchemaDefinition<T>
): BatchValidationReport<T> {
  const maxRows = schema.maxRows ?? 500;
  const globalErrors: string[] = [];

  if (rawRows.length === 0) {
    return {
      totalRows: 0,
      validCount: 0,
      invalidCount: 0,
      rows: [],
      isValid: false,
      errors: ["The uploaded file contains no data rows."],
    };
  }

  if (rawRows.length > maxRows) {
    globalErrors.push(
      `File exceeds maximum limit of ${maxRows} rows (found ${rawRows.length} rows). Please upload in smaller batches.`
    );
  }

  // Create a mapping of normalized header to column definition
  const headerToColMap: Record<string, BatchColumnDefinition> = {};
  for (const col of schema.columns) {
    headerToColMap[normalizeHeader(col.key)] = col;
    headerToColMap[normalizeHeader(col.label)] = col;
  }

  const processedRows: BatchRowResult<T>[] = [];
  const processedDataSoFar: T[] = [];
  let validCount = 0;
  let invalidCount = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const rawRow = rawRows[i];
    const rowErrors: string[] = [];
    const normalizedRowData: Record<string, unknown> = {};

    // Map each raw key to matched schema column
    const rawRowNormalized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(rawRow)) {
      rawRowNormalized[normalizeHeader(key)] = val;
    }

    for (const col of schema.columns) {
      const normKey = normalizeHeader(col.key);
      const normLabel = normalizeHeader(col.label);
      const rawVal = rawRowNormalized[normKey] ?? rawRowNormalized[normLabel] ?? rawRow[col.key] ?? rawRow[col.label];

      const { value, error } = validateColumnValue(col, rawVal, rawRow);
      if (error) {
        rowErrors.push(error);
      }
      normalizedRowData[col.key] = value;
    }

    if (schema.rowValidator) {
      const rowErr = schema.rowValidator(normalizedRowData as T, i, processedDataSoFar);
      if (rowErr) {
        rowErrors.push(rowErr);
      }
    }

    const isValid = rowErrors.length === 0;
    if (isValid) {
      validCount++;
    } else {
      invalidCount++;
    }

    processedDataSoFar.push(normalizedRowData as T);
    processedRows.push({
      rowNumber: i + 1,
      status: isValid ? "valid" : "invalid",
      data: normalizedRowData as T,
      raw: rawRow,
      errors: rowErrors,
    });
  }

  return {
    totalRows: rawRows.length,
    validCount,
    invalidCount,
    rows: processedRows,
    isValid: invalidCount === 0 && globalErrors.length === 0,
    errors: globalErrors.length > 0 ? globalErrors : undefined,
  };
}

/**
 * High-level parser that takes raw file content (CSV text or ArrayBuffer) and schema,
 * parses and returns the full validation report.
 */
export async function parseAndValidateBatchFile<T = Record<string, unknown>>(
  fileContent: string | ArrayBuffer | Uint8Array,
  schema: BatchSchemaDefinition<T>
): Promise<BatchValidationReport<T>> {
  try {
    const rawRows = await parseRawFileContent(fileContent);
    return validateBatchRows(rawRows, schema);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid CSV or XLSX format";
    return {
      totalRows: 0,
      validCount: 0,
      invalidCount: 0,
      rows: [],
      isValid: false,
      errors: [`Failed to parse file: ${message}`],
    };
  }
}
