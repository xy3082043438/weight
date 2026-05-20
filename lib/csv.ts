import { z } from "zod";
import type { WeightEntry } from "@/lib/db";
import { maxWeightKg, minWeightKg } from "@/lib/weight-validation";

const csvEntrySchema = z.object({
  measuredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weightKg: z.coerce.number().min(minWeightKg).max(maxWeightKg),
  note: z.string().max(500).nullable(),
});

export function exportWeightEntriesToCsv(entries: WeightEntry[]) {
  const rows = [
    ["date", "weight_kg", "note"],
    ...entries.map((entry) => [
      entry.measuredAt,
      entry.weightKg.toFixed(1),
      entry.note ?? "",
    ]),
  ];

  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}

export function parseWeightCsv(csv: string) {
  const rows = parseCsvRows(csv.replace(/^\uFEFF/, ""));
  if (rows.length < 2) {
    return [];
  }

  const header = rows[0].map((cell) => normalizeHeader(cell));
  const dateIndex = header.indexOf("date");
  const weightIndex = header.indexOf("weight_kg");
  const noteIndex = header.indexOf("note");

  if (dateIndex === -1 || weightIndex === -1) {
    throw new Error("CSV 模板缺少 date 或 weight_kg 列。");
  }

  return rows
    .slice(1)
    .filter((row) => row.some((cell) => cell.trim()))
    .map((row) =>
      csvEntrySchema.parse({
        measuredAt: row[dateIndex]?.trim(),
        weightKg: row[weightIndex]?.trim(),
        note: noteIndex === -1 ? null : row[noteIndex]?.trim() || null,
      }),
    );
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase();
}

function escapeCsvCell(value: string) {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function parseCsvRows(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);

  return rows;
}
