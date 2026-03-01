import type { ParsedInvestmentTransaction, ParsedInvestmentResult, InvestmentAction, FailedRow, ParseResult } from "./index";
import { PDFParse } from "pdf-parse";
import { roundCents } from "@/lib/utils";

const INVESTMENT_BANK_PATTERNS: { pattern: RegExp; bankName: string }[] = [
  { pattern: /fidelity/i, bankName: "Fidelity" },
  { pattern: /charles schwab|schwab/i, bankName: "Schwab" },
  { pattern: /vanguard/i, bankName: "Vanguard" },
  { pattern: /robinhood/i, bankName: "Robinhood" },
  { pattern: /e\*trade|etrade/i, bankName: "E*TRADE" },
  { pattern: /td ameritrade/i, bankName: "TD Ameritrade" },
  { pattern: /merrill/i, bankName: "Merrill" },
];

const ACTION_MAP: { pattern: RegExp; action: InvestmentAction }[] = [
  { pattern: /\bbuy\b|bought|purchase/i, action: "buy" },
  { pattern: /\bsell\b|sold|redemption/i, action: "sell" },
  { pattern: /dividend|div\b|reinvest/i, action: "dividend" },
  { pattern: /contribution|employer|match|contrib/i, action: "contribution" },
  { pattern: /distribution|withdrawal|rmd/i, action: "distribution" },
  { pattern: /fee|commission|charge/i, action: "fee" },
  { pattern: /interest/i, action: "interest" },
  { pattern: /transfer|journal|exchange|conversion/i, action: "transfer" },
];

function normalizeAction(text: string): InvestmentAction | null {
  for (const { pattern, action } of ACTION_MAP) {
    if (pattern.test(text)) return action;
  }
  return null;
}

function detectBank(text: string): string {
  for (const { pattern, bankName } of INVESTMENT_BANK_PATTERNS) {
    if (pattern.test(text)) return bankName;
  }
  return "Unknown Brokerage";
}

function detectAccountType(text: string): "brokerage" | "retirement_401k" | "ira" {
  if (/401\s*\(?\s*k\s*\)?|retirement/i.test(text)) return "retirement_401k";
  if (/\bira\b|roth/i.test(text)) return "ira";
  return "brokerage";
}

function detectLast4Digits(text: string): string | null {
  const patterns = [
    /Account\s*(?:Number|#|No\.?)?\s*:?\s*(?:X{4}\s*){0,3}(\d{4})/i,
    /ending\s*in\s*(\d{4})/i,
    /\*{4,}\s*(\d{4})/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function parseNumber(value: string): number {
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
  const parts = cleaned.split(/[/-]/);
  if (parts.length >= 2) {
    const [a, b, c] = parts;
    const year = c ? (c.length === 2 ? `20${c}` : c) : String(new Date().getFullYear());
    const attempt = new Date(`${year}-${a.padStart(2, "0")}-${b.padStart(2, "0")}`);
    if (!isNaN(attempt.getTime())) {
      return attempt.toISOString().split("T")[0];
    }
  }
  return null;
}

// Detect if a PDF is an investment statement
export async function isInvestmentPDF(buffer: Buffer): Promise<boolean> {
  try {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const textResult = await parser.getText();
    const text = textResult.text;
    await parser.destroy();

    // First, check if this is clearly a regular bank statement.
    // Bank statements mention investment keywords in transaction descriptions
    // (e.g., "VANGUARD BUY DES:INVESTMENT"), so we must exclude them first.
    const bankStatementIndicators = [
      /deposits?\s*and\s*(?:other\s*)?additions/i,
      /withdrawals?\s*and\s*(?:other\s*)?subtractions/i,
      /beginning\s*balance/i,
      /ending\s*balance/i,
      /previous\s*balance/i,
      /new\s*balance/i,
      /statement\s*(?:period|date|closing)/i,
    ];
    let bankStatementScore = 0;
    for (const pattern of bankStatementIndicators) {
      if (pattern.test(text)) bankStatementScore++;
    }
    // If 3+ bank statement indicators match, this is a bank statement, not investment
    if (bankStatementScore >= 3) return false;

    // Use only the header area (first ~2000 chars) for brokerage bank detection
    // to avoid false positives from transaction descriptions
    const headerArea = text.substring(0, 2000);

    const lower = text.toLowerCase();
    const investmentKeywords = [
      "shares", "symbol", "ticker", "quantity",
      "buy", "sell", "dividend", "brokerage",
      "portfolio", "investment", "securities",
      "trade confirmation", "account activity",
      "share price", "cost basis", "capital gain",
    ];

    const matchCount = investmentKeywords.filter((kw) => lower.includes(kw)).length;
    // Check brokerage bank patterns only in the header area
    const isBrokerage = INVESTMENT_BANK_PATTERNS.some(({ pattern }) => pattern.test(headerArea));

    return matchCount >= 3 || (isBrokerage && matchCount >= 2);
  } catch {
    return false;
  }
}

// Parse investment PDF (best-effort line-by-line extraction)
// Accepts optional pre-extracted text to avoid re-parsing the PDF
export async function parsePDFInvestmentTransactions(buffer: Buffer, preExtractedText?: string): Promise<ParseResult<ParsedInvestmentTransaction>> {
  try {
    let text: string;
    if (preExtractedText !== undefined) {
      text = preExtractedText;
    } else {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const textResult = await parser.getText();
      text = textResult.text;
      await parser.destroy();
    }

    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const transactions: ParsedInvestmentTransaction[] = [];
    const failedRows: FailedRow[] = [];

    const datePattern = /^(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)(?:\s|$)/;
    const symbolPattern = /\b([A-Z]{1,5})\b/;
    const amountPattern = /\$?\s?-?[\d,]+\.\d{2}/g;

    let dateLineIndex = 0;
    for (const line of lines) {
      const dateMatch = line.match(datePattern);
      if (!dateMatch) continue;

      const rawContent = line.substring(0, 200);
      const dateStr = parseDate(dateMatch[1]);
      if (!dateStr) {
        failedRows.push({ rowIndex: dateLineIndex, rawContent, reasonCode: "invalid_date", reasonMessage: "Could not parse date from PDF line" });
        dateLineIndex++;
        continue;
      }

      const action = normalizeAction(line);
      if (action === null) {
        failedRows.push({ rowIndex: dateLineIndex, rawContent, reasonCode: "unknown_action", reasonMessage: `Unrecognized action in PDF line` });
        dateLineIndex++;
        continue;
      }
      const symMatch = line.match(symbolPattern);
      const symbol = symMatch ? symMatch[1] : "UNKNOWN";

      const amounts: number[] = [];
      let amtMatch;
      while ((amtMatch = amountPattern.exec(line)) !== null) {
        amounts.push(Math.abs(parseNumber(amtMatch[0])));
      }

      const amount = amounts.length > 0 ? amounts[amounts.length - 1] : 0;
      const price = amounts.length >= 2 ? amounts[amounts.length - 2] : 0;
      const shares = amounts.length >= 3 ? amounts[0] : (price > 0 && amount > 0 ? amount / price : 0);

      const description = line.replace(dateMatch[0], "").trim().substring(0, 100);

      if (amount === 0 && shares === 0) {
        failedRows.push({ rowIndex: dateLineIndex, rawContent, reasonCode: "zero_amount_empty_description", reasonMessage: "Line has zero amount and zero shares" });
        dateLineIndex++;
        continue;
      }

      transactions.push({
        date: dateStr,
        action,
        symbol,
        description,
        shares,
        pricePerShare: price,
        amount,
      });
      dateLineIndex++;
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

export async function parseInvestmentPDFWithMetadata(
  buffer: Buffer,
  fallbackFilename?: string,
): Promise<ParsedInvestmentResult> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const textResult = await parser.getText();
  const text = textResult.text;
  await parser.destroy();

  const bankName = detectBank(text);
  const accountType = detectAccountType(text);
  // Pass pre-extracted text to avoid re-parsing the PDF
  const { successfulRows: transactions, failedRows } = await parsePDFInvestmentTransactions(buffer, text);

  let accountLabel = bankName !== "Unknown Brokerage"
    ? `${bankName} ${accountType === "retirement_401k" ? "401(k)" : accountType === "ira" ? "IRA" : "Brokerage"}`
    : fallbackFilename
      ? fallbackFilename.replace(/\.[^.]+$/, "")
      : "Investment Account";

  const last4 = detectLast4Digits(text);
  if (last4) {
    accountLabel = `${accountLabel} \u2022\u2022\u2022\u2022${last4}`;
  }

  return { transactions, bankName, accountLabel, accountType, failedRows };
}
