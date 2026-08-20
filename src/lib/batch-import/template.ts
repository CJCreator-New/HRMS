import * as XLSX from "xlsx";
import type { BatchSchemaDefinition } from "./types";

/**
 * Generates CSV content as a string for a given schema definition.
 */
export function generateCsvTemplate(schema: BatchSchemaDefinition): string {
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
export function generateXlsxTemplate(schema: BatchSchemaDefinition): Uint8Array {
  const wb = XLSX.utils.book_new();

  const headers = schema.columns.map((c) => c.key);
  const dataRows: (string | number | boolean)[][] = [headers];

  if (schema.sampleRows && schema.sampleRows.length > 0) {
    for (const sample of schema.sampleRows) {
      dataRows.push(headers.map((h) => sample[h] ?? ""));
    }
  } else {
    const exampleRow = schema.columns.map((c) => c.exampleValue ?? "");
    dataRows.push(exampleRow);
  }

  const ws = XLSX.utils.aoa_to_sheet(dataRows);

  // Set column widths
  ws["!cols"] = schema.columns.map((c) => ({
    wch: Math.max(c.key.length, c.label.length, 18),
  }));

  XLSX.utils.book_append_sheet(wb, ws, "Template");

  // Add Instructions sheet if schema has descriptions or notes
  const instructions: (string | number)[][] = [
    ["Column", "Label", "Required", "Type", "Allowed Values / Format", "Description"],
  ];

  for (const col of schema.columns) {
    instructions.push([
      col.key,
      col.label,
      col.required ? "Yes" : "No",
      col.type || "string",
      col.enumValues ? col.enumValues.join(", ") : (col.pattern ? col.pattern.toString() : ""),
      col.description || "",
    ]);
  }

  if (schema.notes && schema.notes.length > 0) {
    instructions.push([]);
    instructions.push(["General Notes & Instructions:"]);
    for (const note of schema.notes) {
      instructions.push([note]);
    }
  }

  const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
  wsInstructions["!cols"] = [
    { wch: 22 },
    { wch: 22 },
    { wch: 10 },
    { wch: 12 },
    { wch: 30 },
    { wch: 45 },
  ];
  XLSX.utils.book_append_sheet(wb, wsInstructions, "Instructions");

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Uint8Array(wbout);
}

/**
 * Triggers a browser download of a template file (.csv or .xlsx).
 */
export function downloadTemplateFile(
  schema: BatchSchemaDefinition,
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
    const xlsxBuffer = generateXlsxTemplate(schema);
    const blob = new Blob([xlsxBuffer as any], {
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
