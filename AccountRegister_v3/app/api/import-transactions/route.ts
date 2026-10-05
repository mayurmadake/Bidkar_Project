import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { appendActivityLog } from "@/lib/activity-log";
import { readDatabase, writeDatabase } from "@/lib/local-db";
import type { Transaction } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const requiredColumns = ["date", "amount", "company_name", "receiver", "site_name", "work"] as const;
const requiredColumnLabels = "Date, Amount, Company Name, Receiver, Site Name, Work";

type ImportColumn = (typeof requiredColumns)[number];
type ImportRecord = Partial<Record<ImportColumn, unknown>>;
type PdfParser = {
  getTable: () => Promise<{ mergedTables: string[][][] }>;
  getText: () => Promise<{ text: string }>;
  destroy: () => Promise<void>;
};
type PdfParseModule = {
  PDFParse: new (options: { data: Buffer }) => PdfParser;
};

type HeaderMatch = {
  index: number;
  key: ImportColumn;
};

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function normalizeHeader(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function columnForHeader(value: unknown): ImportColumn | null {
  const header = normalizeHeader(value);

  if (["date", "transactiondate"].includes(header)) return "date";
  if (["amount", "transactionamount", "paymentamount"].includes(header)) return "amount";
  if (["companyname", "company", "companyid"].includes(header)) return "company_name";
  if (["receiver", "vendor", "vendorname", "paidto", "payee"].includes(header)) return "receiver";
  if (["sitename", "site", "siteid", "location"].includes(header)) return "site_name";
  if (["work", "description", "details", "particulars"].includes(header)) return "work";

  return null;
}

function normalizeTextValue(value: unknown) {
  const text = String(value ?? "").trim();
  return text || "-";
}

function normalizeAmountValue(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text || text === "-") return 0;

  const amount = Number(text.replace(/[₹,\s]/g, ""));
  return Number.isFinite(amount) ? amount : 0;
}

function padDatePart(value: string) {
  return value.padStart(2, "0");
}

function normalizeDateValue(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const text = normalizeTextValue(value);
  if (text === "-") return text;

  const isoMatch = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${padDatePart(isoMatch[2])}-${padDatePart(isoMatch[3])}`;
  }

  const dayMonthYearMatch = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (dayMonthYearMatch) {
    const year = dayMonthYearMatch[3].length === 2 ? `20${dayMonthYearMatch[3]}` : dayMonthYearMatch[3];
    return `${year}-${padDatePart(dayMonthYearMatch[2])}-${padDatePart(dayMonthYearMatch[1])}`;
  }

  return text;
}

function hasAnyRowValue(record: ImportRecord) {
  return requiredColumns.some((key) => String(record[key] ?? "").trim());
}

function validateRecordColumns(record: ImportRecord) {
  const missingColumns = requiredColumns.filter((column) => !(column in record));
  if (missingColumns.length) {
    throw new Error(`Import file must include these columns: ${requiredColumnLabels}.`);
  }
}

function transactionActivityDetails(entry: Pick<Transaction, "date" | "amount" | "company_name" | "receiver" | "site_name" | "work">) {
  return [
    `Date: ${entry.date}`,
    `Amount: ${Number(entry.amount || 0).toFixed(2)}`,
    entry.company_name ? `Company: ${entry.company_name}` : "",
    entry.receiver ? `Receiver: ${entry.receiver}` : "",
    entry.site_name ? `Site: ${entry.site_name}` : "",
    entry.work ? `Work: ${entry.work}` : ""
  ].filter(Boolean).join(" | ");
}

function recordToTransaction(record: ImportRecord): Transaction {
  validateRecordColumns(record);

  const companyName = normalizeTextValue(record.company_name);
  const receiver = normalizeTextValue(record.receiver);
  const siteName = normalizeTextValue(record.site_name);
  const work = normalizeTextValue(record.work);

  return {
    id: createId(),
    date: normalizeDateValue(record.date),
    amount: normalizeAmountValue(record.amount),
    company_name: companyName,
    receiver,
    site_name: siteName,
    work,
    company_id: companyName,
    vendor_id: receiver,
    site_id: siteName,
    transaction_type: "cash",
    entry_type: "debit",
    upi_transaction_id: null,
    cheque_number: null,
    cheque_date: null,
    cheque_status: null,
    description: work === "-" ? null : work,
    created_by: "file-admin",
    created_at: new Date().toISOString()
  };
}

function recordsFromWorksheet(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error("Import file does not contain a sheet.");
  }

  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "", raw: false }) as ImportRecord[];
}

function recordsFromTableRows(rows: string[][]) {
  const headerIndex = rows.findIndex((row) => requiredColumns.every((column) => row.some((cell) => columnForHeader(cell) === column)));

  if (headerIndex < 0) {
    throw new Error(`Import file must include these columns: ${requiredColumnLabels}.`);
  }

  const headerMatches = rows[headerIndex]
    .map((cell, index): HeaderMatch | null => {
      const key = columnForHeader(cell);
      return key ? { index, key } : null;
    })
    .filter((match): match is HeaderMatch => Boolean(match));

  return rows.slice(headerIndex + 1).map((row) => {
    const record: ImportRecord = {};
    headerMatches.forEach(({ index, key }) => {
      record[key] = row[index] ?? "";
    });
    return record;
  });
}

function splitDelimitedLine(line: string) {
  if (line.includes("|")) return line.split("|").map((cell) => cell.trim());
  if (line.includes("\t")) return line.split("\t").map((cell) => cell.trim());
  if (line.includes(",")) return line.split(",").map((cell) => cell.trim());
  return line.split(/\s{2,}/).map((cell) => cell.trim());
}

function recordsFromText(text: string) {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(splitDelimitedLine)
    .filter((row) => row.length > 1);

  if (!rows.length) {
    throw new Error("No table rows were found in the PDF.");
  }

  return recordsFromTableRows(rows);
}

async function recordsFromPdf(buffer: Buffer) {
  const dynamicRequire = eval("require") as (moduleName: string) => PdfParseModule;
  const { PDFParse } = dynamicRequire("pdf-parse");
  const parser = new PDFParse({ data: buffer });

  try {
    const tableResult = await parser.getTable().catch(() => null);
    const tableRows = tableResult?.mergedTables.flatMap((table) => table) || [];

    if (tableRows.length) {
      try {
        return recordsFromTableRows(tableRows);
      } catch {
        // Fall back to text parsing below when the PDF table detector cannot map the expected headers.
      }
    }

    const textResult = await parser.getText();
    return recordsFromText(textResult.text);
  } finally {
    await parser.destroy();
  }
}

async function recordsFromFile(file: File, buffer: Buffer) {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".pdf") || file.type === "application/pdf") {
    return recordsFromPdf(buffer);
  }

  if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls") || fileName.endsWith(".csv")) {
    return recordsFromWorksheet(buffer);
  }

  throw new Error("Use a PDF or Excel file for import.");
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Choose a PDF or Excel file to import." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const records = (await recordsFromFile(file, buffer)).filter(hasAnyRowValue);
    const transactions = records.map(recordToTransaction);

    if (!transactions.length) {
      return NextResponse.json({ ok: false, error: "No transactions were found in the import file." }, { status: 400 });
    }

    const database = await readDatabase();
    await writeDatabase({
      ...database,
      transactions: [...transactions, ...database.transactions]
    });

    await Promise.all(
      transactions.map((transaction) =>
        appendActivityLog({
          id: createId(),
          action: "transaction_created",
          label: "Imported transaction",
          details: transactionActivityDetails(transaction),
          transaction_id: transaction.id,
          amount: transaction.amount,
          company_name: transaction.company_name || null,
          receiver: transaction.receiver || null,
          site_name: transaction.site_name || null,
          created_by: "file-admin",
          created_at: transaction.created_at
        })
      )
    );

    return NextResponse.json({ ok: true, importedCount: transactions.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not import transactions.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
