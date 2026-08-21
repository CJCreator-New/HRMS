import ExcelJS from "exceljs";
import type { BatchSchemaDefinition } from "./types";

/**
 * Generates CSV content as a string for a given schema definition.
 */
export function generateCsvTemplate(schema: BatchSchemaDefinition<any>): string {
  const headers = schema.columns.map((c) => c.key);
  const rows: string[][] = [headers];

  if (schema.sampleRows && schema.sampleRows.length > 0) {
    for (const sample of schema.sampleRows) {
      rows.push(headers.map((h) => {
        const val = sample[h];
        if (val === undefined || val === null) return "";
        const str = String(val);
        if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }));
    }
  } else {
    // Generate 1 example row from column definitions
    const exampleRow = schema.columns.map((c) => {
      const val = c.exampleValue ?? "";
      const str = String(val);
      if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    rows.push(exampleRow);
  }

  return rows.map((r) => r.join(",")).join("\n");
}

/**
 * Generates an XLSX workbook binary buffer for a given schema definition.
 * Includes column headers, descriptions/notes, and sample rows.
 */
export async function generateXlsxTemplate(schema: BatchSchemaDefinition<any>): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "HRMS System";
  workbook.created = new Date();

  // Data sheet
  const sheetName = schema.displayName.slice(0, 31);
  const worksheet = workbook.addWorksheet(sheetName);

  worksheet.columns = schema.columns.map((c) => ({
    header: c.key,
    key: c.key,
    width: 18,
  }));

  if (schema.sampleRows && schema.sampleRows.length > 0) {
    for (const sample of schema.sampleRows) {
      worksheet.addRow(sample);
    }
  } else {
    const exampleRow: Record<string, unknown> = {};
    for (const col of schema.columns) {
      exampleRow[col.key] = col.exampleValue ?? "";
    }
    worksheet.addRow(exampleRow);
  }

  // Add instructions sheet
  const wsInstructions = workbook.addWorksheet("Instructions");
  wsInstructions.columns = [
    { header: "Column Name", key: "colName", width: 22 },
    { header: "Required", key: "required", width: 10 },
    { header: "Data Type", key: "dataType", width: 12 },
    { header: "Allowed Values / Format", key: "allowedValues", width: 30 },
    { header: "Description", key: "description", width: 45 },
  ];

  for (const c of schema.columns) {
    wsInstructions.addRow({
      colName: c.label,
      required: c.required ? "YES" : "NO",
      dataType: c.type || "string",
      allowedValues: c.enumValues
        ? c.enumValues.join(", ")
        : c.type === "pan"
        ? "AAAAA9999A"
        : c.type === "date"
        ? "YYYY-MM-DD"
        : "-",
      description: c.description || "",
    });
  }

  if (schema.notes && schema.notes.length > 0) {
    wsInstructions.addRow({});
    wsInstructions.addRow({ colName: "General Notes & Instructions:" });
    for (const note of schema.notes) {
      wsInstructions.addRow({ colName: note });
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

/**
 * Triggers a browser download of a template file (.csv or .xlsx).
 */
export async function downloadTemplateFile(
  schema: BatchSchemaDefinition<any>,
  format: "csv" | "xlsx"
) {
  const baseName = schema.templateFileName.replace(/\.(csv|xlsx)$/i, "");

  if (format === "csv") {
    const csvContent = generateCsvTemplate(schema);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseName}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } else {
    const xlsxBuffer = await generateXlsxTemplate(schema);
    const blob = new Blob([xlsxBuffer.buffer as ArrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseName}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
