/**
 * File reader — CSV/Parquet/Excel via nodejs-polars or built-in CSV parser.
 * Node-only (uses node:fs).
 */

import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { TabularData, type Row } from "../core/data.js";

export interface ReadOptions {
  /** CSV separator character. Default: auto-detect (comma, tab, semicolon, pipe). */
  separator?: string | undefined;
  /** Maximum number of rows to read. Default: all. */
  maxRows?: number | undefined;
}

/**
 * Read a file into a TabularData. Supports .csv, .tsv, .parquet, .xlsx, .xls.
 * Parquet requires `nodejs-polars` peer dependency.
 * Excel requires `nodejs-polars` peer dependency.
 */
export function readFile(path: string, options?: ReadOptions): TabularData {
  const ext = extname(path).toLowerCase();
  switch (ext) {
    case ".csv":
    case ".tsv":
      return readCsv(path, options);
    case ".parquet":
      return readParquet(path);
    case ".xlsx":
    case ".xls":
      return readExcel(path);
    default:
      // Default to CSV
      return readCsv(path, options);
  }
}

/** Parse CSV into TabularData using built-in parser (no external deps). */
export function readCsv(path: string, options?: ReadOptions): TabularData {
  const content = readFileSync(path, "utf-8");
  const rows = parseCsv(content, options?.separator);
  if (options?.maxRows && rows.length > options.maxRows) {
    return new TabularData(rows.slice(0, options.maxRows));
  }
  return new TabularData(rows);
}

function readParquet(path: string): TabularData {
  try {
    // Dynamic import — nodejs-polars is optional peer dep
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pl = require("nodejs-polars") as typeof import("nodejs-polars");
    const df = pl.readParquet(path);
    return polarsToTabular(df);
  } catch {
    throw new Error(
      "Parquet support requires nodejs-polars. Install with: npm install nodejs-polars",
    );
  }
}

function readExcel(_path: string): TabularData {
  // nodejs-polars does not expose readExcel — use a dedicated xlsx library
  throw new Error(
    "Excel support is not yet available in goldencheck-js. Convert to CSV or Parquet first.",
  );
}

/** Convert a Polars DataFrame to TabularData (Row[]). */
function polarsToTabular(df: { toRecords(): Record<string, unknown>[] }): TabularData {
  const records = df.toRecords();
  return new TabularData(records as Row[]);
}

// --- Built-in RFC 4180 CSV parser ---

function parseCsv(content: string, separator?: string): Row[] {
  const lines = splitLines(content);
  if (lines.length === 0) return [];

  const sep = separator ?? detectSeparator(lines[0]!);
  const header = parseRow(lines[0]!, sep);
  const rows: Row[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.trim() === "") continue;
    const values = parseRow(line, sep);
    const row: Record<string, string | null> = {};
    for (let j = 0; j < header.length; j++) {
      row[header[j]!] = j < values.length ? (values[j] ?? null) : null;
    }
    rows.push(row);
  }

  return rows;
}

function splitLines(content: string): string[] {
  // Handle CRLF, LF, and CR line endings
  return content.split(/\r\n|\n|\r/);
}

function detectSeparator(headerLine: string): string {
  const candidates = [",", "\t", ";", "|"];
  let best = ",";
  let bestCount = 0;
  for (const sep of candidates) {
    const count = headerLine.split(sep).length;
    if (count > bestCount) {
      bestCount = count;
      best = sep;
    }
  }
  return best;
}

function parseRow(line: string, sep: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const ch = line[i]!;

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i += 2;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
        }
      } else {
        current += ch;
        i++;
      }
    } else if (ch === '"' && current === "") {
      inQuotes = true;
      i++;
    } else if (ch === sep) {
      values.push(current);
      current = "";
      i++;
    } else {
      current += ch;
      i++;
    }
  }

  values.push(current);
  return values;
}
