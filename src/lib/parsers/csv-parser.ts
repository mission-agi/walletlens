import Papa from "papaparse";
import type { ParsedTransaction, ParsedResult, FailedRow, ParseResult } from "./index";
import { roundCents } from "@/lib/utils";

const DATE_HEADERS = ["date", "transaction date", "posting date", "posted date", "trans date", "trans. date"];
const DESC_HEADERS = ["description", "memo", "narrative", "details", "transaction description", "name", "payee", "merchant"];
const AMOUNT_HEADERS = ["amount", "transaction amount"];
const DEBIT_HEADERS = ["debit", "withdrawal", "withdrawals", "debit amount"];
const CREDIT_HEADERS = ["credit", "deposit", "deposits", "credit amount"];

function findHeader(headers: string[], candidates: string[]): string | null {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const candidate of candidates) {
    const idx = lower.indexOf(candidate);
    if (idx !== -1) return headers[idx];
  }
  return null;
}

function parseAmount(value: string): number {
  if (!value) return 0;
  const cleaned = value.replace(/[$,\s]/g, "").replace(/[()]/g, "-");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : roundCents(num);
}

function parseDate(value: string): string | null {
  if (!value) return null;
  const cleaned = value.trim();
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split("T")[0];
  }
  // Try MM/DD/YYYY
  const parts = cleaned.split(/[/-]/);
  if (parts.length === 3) {
    const [a, b, c] = parts;
    const year = c.length === 2 ? `20${c}` : c;
    const attempt = new Date(`${year}-${a.padStart(2, "0")}-${b.padStart(2, "0")}`);
    if (!isNaN(attempt.getTime())) {
      return attempt.toISOString().split("T")[0];
    }
  }
  return null;
}

export function parseCSV(csvText: string): ParseResult<ParsedTransaction> {
  try {
    const result = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim(),
    });

    if (!result.data || result.data.length === 0) {
      return { successfulRows: [], failedRows: [] };
    }

    const headers = result.meta.fields || [];
    const dateCol = findHeader(headers, DATE_HEADERS);
    const descCol = findHeader(headers, DESC_HEADERS);
    const amountCol = findHeader(headers, AMOUNT_HEADERS);
    const debitCol = findHeader(headers, DEBIT_HEADERS);
    const creditCol = findHeader(headers, CREDIT_HEADERS);

    if (!dateCol) {
      return {
        successfulRows: [],
        failedRows: [{ rowIndex: -1, rawContent: "", reasonCode: "missing_date_column", reasonMessage: "No date column found in CSV headers" }],
      };
    }

    const transactions: ParsedTransaction[] = [];
    const failedRows: FailedRow[] = [];

    const rows = result.data as Record<string, string>[];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rawContent = JSON.stringify(row).substring(0, 200);
      const dateStr = parseDate(row[dateCol]);
      if (!dateStr) {
        failedRows.push({ rowIndex: i, rawContent, reasonCode: "invalid_date", reasonMessage: "Could not parse date from row" });
        continue;
      }

      const description = descCol ? row[descCol]?.trim() || "" : "";

      // Skip summary/balance/pending rows
      if (/^(beginning|opening|starting|ending|closing)\s*balance/i.test(description) ||
          /^(total|subtotal|account\s*summary|statement\s*summary)/i.test(description)) {
        failedRows.push({ rowIndex: i, rawContent, reasonCode: "summary_row", reasonMessage: "Summary or balance row skipped" });
        continue;
      }
      if (/\bpending\b/i.test(description)) {
        failedRows.push({ rowIndex: i, rawContent, reasonCode: "pending_transaction", reasonMessage: "Pending transaction skipped" });
        continue;
      }

      let amount: number;
      let type: "debit" | "credit";

      if (amountCol) {
        amount = parseAmount(row[amountCol]);
        type = amount < 0 ? "debit" : "credit";
        amount = Math.abs(amount);
      } else if (debitCol || creditCol) {
        const debitAmt = debitCol ? parseAmount(row[debitCol]) : 0;
        const creditAmt = creditCol ? parseAmount(row[creditCol]) : 0;
        if (debitAmt > 0) {
          amount = debitAmt;
          type = "debit";
        } else {
          amount = creditAmt;
          type = "credit";
        }
      } else {
        failedRows.push({ rowIndex: i, rawContent, reasonCode: "missing_amount_column", reasonMessage: "No amount, debit, or credit column found" });
        continue;
      }

      if (amount === 0 && !description) {
        failedRows.push({ rowIndex: i, rawContent, reasonCode: "zero_amount_empty_description", reasonMessage: "Row has zero amount and no description" });
        continue;
      }

      transactions.push({ date: dateStr, description, amount, type });
    }

    transactions.sort((a, b) => a.date.localeCompare(b.date));
    return { successfulRows: transactions, failedRows };
  } catch (err) {
    return {
      successfulRows: [],
      failedRows: [{ rowIndex: -1, rawContent: "", reasonCode: "parser_crash", reasonMessage: err instanceof Error ? err.message : "Unknown error" }],
    };
  }
}

const CSV_BANK_PATTERNS: { pattern: RegExp; bankName: string }[] = [
  { pattern: /chase/i, bankName: "Chase" },
  { pattern: /bank of america|bofa/i, bankName: "Bank of America" },
  { pattern: /wells fargo/i, bankName: "Wells Fargo" },
  { pattern: /citibank|(?<![a-z])citi(?![a-z])/i, bankName: "Citibank" },
  { pattern: /capital one/i, bankName: "Capital One" },
  { pattern: /american express|(?<![a-z])amex(?![a-z])/i, bankName: "American Express" },
  { pattern: /discover/i, bankName: "Discover" },
  { pattern: /us bank/i, bankName: "US Bank" },
];

function detectLast4Digits(text: string): string | null {
  // Pattern: Account Number: XXXX XXXX XXXX 0803
  const accountNumPattern = /Account\s*(?:Number|#|No\.?)?\s*:?\s*(?:X{4}\s*){0,3}(\d{4})/i;
  const match1 = text.match(accountNumPattern);
  if (match1) return match1[1];

  // Pattern: ending in 0803
  const endingInPattern = /ending\s*in\s*(\d{4})/i;
  const match2 = text.match(endingInPattern);
  if (match2) return match2[1];

  // Pattern: ****0803
  const maskedPattern = /\*{4,}\s*(\d{4})/;
  const match3 = text.match(maskedPattern);
  if (match3) return match3[1];

  return null;
}

function detectBankFromCSV(csvText: string, headers: string[]): string {
  // Check headers first
  const headerStr = headers.join(" ");
  for (const { pattern, bankName } of CSV_BANK_PATTERNS) {
    if (pattern.test(headerStr)) return bankName;
  }
  // Check first few lines of content
  const firstLines = csvText.split("\n").slice(0, 5).join(" ");
  for (const { pattern, bankName } of CSV_BANK_PATTERNS) {
    if (pattern.test(firstLines)) return bankName;
  }
  return "Unknown Bank";
}

export function parseCSVWithMetadata(
  csvText: string,
  fallbackFilename?: string,
): ParsedResult {
  const { successfulRows: transactions, failedRows } = parseCSV(csvText);

  // Try to detect bank from CSV content
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim(),
  });
  const headers = result.meta.fields || [];
  const bankName = detectBankFromCSV(csvText, headers);
  let accountLabel =
    bankName !== "Unknown Bank"
      ? `${bankName} Account`
      : fallbackFilename
        ? fallbackFilename.replace(/\.[^.]+$/, "")
        : "Unknown Account";

  // Try to append last 4 digits of account number
  const last4 = detectLast4Digits(csvText);
  if (last4) {
    accountLabel = `${accountLabel} \u2022\u2022\u2022\u2022${last4}`;
  }

  return { transactions, bankName, accountLabel, failedRows };
}
