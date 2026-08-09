import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);

// RFC4180 line splitter. Callers must NOT strip quotes again afterwards —
// doubled quotes are already unescaped here, and a second pass mangles names
// that legitimately contain a quote (e.g. 5" Syringe).
export const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

export const parseCSVFile = (
  text: string,
): { headers: string[]; rows: string[][] } => {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  return {
    headers: parseCSVLine(lines[0]).map((h) => h.trim()),
    rows: lines.slice(1).map(parseCSVLine),
  };
};

// Expiry cells are hand-typed. Accept YYYY-MM-DD (what the export writes) and
// the M/D/YYYY that Excel produces; fall back to null. A junk date must never
// block the rest of the row from importing.
export const parseCSVDate = (raw: string): string | null => {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const explicit = dayjs(trimmed, ["YYYY-MM-DD", "M/D/YYYY", "D/M/YYYY"], true);
  if (explicit.isValid()) return explicit.format("YYYY-MM-DD");
  const loose = dayjs(trimmed);
  return loose.isValid() ? loose.format("YYYY-MM-DD") : null;
};

export const toCSV = (rows: Record<string, string | number>[]): string => {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [
    headers.map(escape).join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ].join("\n");
};

export const downloadCSV = (filename: string, csv: string): void => {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
