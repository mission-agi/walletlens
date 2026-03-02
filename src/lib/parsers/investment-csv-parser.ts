import Papa from "papaparse";
import type { ParsedInvestmentTransaction, ParsedInvestmentResult, InvestmentAction, FailedRow, ParseResult } from "./index";
import { roundCents } from "@/lib/utils";

// Header mapping per brokerage
interface HeaderMap {
  date: string;
  action: string;
  symbol: string;
  description: string;
  shares: string;
  price: string;
  amount: string;
}

const BROKERAGE_CONFIGS: {
  name: string;
  pattern: RegExp;
  headers: Partial<HeaderMap>;
}[] = [
  {
    name: "Fidelity",
    pattern: /fidelity/i,
    headers: {
      date: "run date",
      action: "action",
      symbol: "symbol",
      description: "description",
      shares: "quantity",
      price: "price ($)",
      amount: "amount ($)",
    },
  },
  {
    name: "Schwab",
    pattern: /schwab/i,
    headers: {
      date: "date",
      action: "action",
      symbol: "symbol",
      description: "description",
      shares: "quantity",
      price: "price",
      amount: "amount",
    },
  },
  {
    name: "Vanguard",
    pattern: /vanguard/i,
    headers: {
      date: "trade date",
      action: "transaction type",
      symbol: "symbol",
      description: "investment name",
      shares: "shares",
      price: "share price",
      amount: "amount",
    },
  },
  {
    name: "Robinhood",
    pattern: /robinhood/i,
    headers: {
      date: "activity date",
      action: "trans code",
      symbol: "instrument",
      description: "description",
      shares: "quantity",
      price: "price",
      amount: "amount",
    },
  },
];

// Generic header candidates for unknown brokerages
const DATE_CANDIDATES = ["date", "trade date", "run date", "activity date", "settlement date", "transaction date", "transactiondate"];
const ACTION_CANDIDATES = ["action", "transaction type", "transactiontype", "trans code", "type", "activity"];
const SYMBOL_CANDIDATES = ["symbol", "ticker", "instrument", "security"];
const DESC_CANDIDATES = ["description", "security description", "investment name", "name", "security name"];
const SHARES_CANDIDATES = ["quantity", "shares", "qty", "units"];
const PRICE_CANDIDATES = ["price", "share price", "price ($)", "unit price"];
const AMOUNT_CANDIDATES = ["amount", "amount ($)", "net amount", "total", "value", "proceeds"];

function findHeader(headers: string[], candidates: string[]): string | null {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const candidate of candidates) {
    const idx = lower.indexOf(candidate);
    if (idx !== -1) return headers[idx];
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

function normalizeAction(rawAction: string): InvestmentAction | null {
  for (const { pattern, action } of ACTION_MAP) {
    if (pattern.test(rawAction)) return action;
  }
  return null;
}

function detectAccountType(csvText: string): "brokerage" | "retirement_401k" | "ira" {
  const text = csvText.substring(0, 2000).toLowerCase();
  if (/401\s*\(?\s*k\s*\)?|retirement/i.test(text)) return "retirement_401k";
  if (/\bira\b|roth/i.test(text)) return "ira";
  return "brokerage";
}

function detectBrokerage(headers: string[], csvText: string): { bankName: string; headerMap: HeaderMap } {
  const headerStr = headers.join(" ").toLowerCase();
  const firstLines = csvText.split("\n").slice(0, 5).join(" ").toLowerCase();

  for (const config of BROKERAGE_CONFIGS) {
    if (config.pattern.test(headerStr) || config.pattern.test(firstLines)) {
      return {
        bankName: config.name,
        headerMap: resolveHeaderMap(headers, config.headers),
      };
    }
  }

  // Try to detect from header patterns
  for (const config of BROKERAGE_CONFIGS) {
    const configHeaders = Object.values(config.headers).filter(Boolean);
    const matches = configHeaders.filter((h) =>
      headers.some((hdr) => hdr.toLowerCase().trim() === h)
    );
    if (matches.length >= 3) {
      return {
        bankName: config.name,
        headerMap: resolveHeaderMap(headers, config.headers),
      };
    }
  }

  // Generic fallback
  return {
    bankName: "Unknown Brokerage",
    headerMap: resolveHeaderMap(headers, {}),
  };
}

function matchHeader(headers: string[], target: string): string {
  // Find the actual header that matches the target (case-insensitive)
  const lower = headers.map((h) => h.toLowerCase().trim());
  const idx = lower.indexOf(target.toLowerCase().trim());
  return idx !== -1 ? headers[idx] : "";
}

function resolveHeaderMap(headers: string[], overrides: Partial<HeaderMap>): HeaderMap {
  return {
    date: (overrides.date ? matchHeader(headers, overrides.date) : "") || findHeader(headers, DATE_CANDIDATES) || "",
    action: (overrides.action ? matchHeader(headers, overrides.action) : "") || findHeader(headers, ACTION_CANDIDATES) || "",
    symbol: (overrides.symbol ? matchHeader(headers, overrides.symbol) : "") || findHeader(headers, SYMBOL_CANDIDATES) || "",
    description: (overrides.description ? matchHeader(headers, overrides.description) : "") || findHeader(headers, DESC_CANDIDATES) || "",
    shares: (overrides.shares ? matchHeader(headers, overrides.shares) : "") || findHeader(headers, SHARES_CANDIDATES) || "",
    price: (overrides.price ? matchHeader(headers, overrides.price) : "") || findHeader(headers, PRICE_CANDIDATES) || "",
    amount: (overrides.amount ? matchHeader(headers, overrides.amount) : "") || findHeader(headers, AMOUNT_CANDIDATES) || "",
  };
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

export function isInvestmentCSV(csvText: string): boolean {
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    preview: 1,
    transformHeader: (h: string) => h.trim(),
  });
  const headers = (result.meta.fields || []).map((h) => h.toLowerCase().trim());

  // Check for investment-specific header combinations
  const investmentHeaders = [
    "symbol", "ticker", "instrument", "security",
    "shares", "quantity", "qty", "units",
    "action", "transaction type", "trans code",
    "trade date", "run date", "activity date",
    "share price",
  ];

  const matchCount = investmentHeaders.filter((ih) =>
    headers.some((h) => h.includes(ih))
  ).length;

  // Need at least 2 investment-specific headers
  return matchCount >= 2;
}

export function parseInvestmentCSV(csvText: string): ParseResult<ParsedInvestmentTransaction> {
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
    const { headerMap } = detectBrokerage(headers, csvText);

    if (!headerMap.date) {
      return {
        successfulRows: [],
        failedRows: [{ rowIndex: -1, rawContent: "", reasonCode: "missing_date_column", reasonMessage: "No date column found in investment CSV headers" }],
      };
    }

    const transactions: ParsedInvestmentTransaction[] = [];
    const failedRows: FailedRow[] = [];

    const rows = result.data as Record<string, string>[];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rawContent = JSON.stringify(row).substring(0, 200);
      const dateStr = parseDate(row[headerMap.date]);
      if (!dateStr) {
        failedRows.push({ rowIndex: i, rawContent, reasonCode: "invalid_date", reasonMessage: "Could not parse date from row" });
        continue;
      }

      const rawAction = headerMap.action ? row[headerMap.action]?.trim() || "" : "";
      const action = normalizeAction(rawAction);
      if (action === null) {
        failedRows.push({ rowIndex: i, rawContent, reasonCode: "unknown_action", reasonMessage: `Unrecognized action: "${rawAction}"` });
        continue;
      }
      const symbol = headerMap.symbol ? (row[headerMap.symbol]?.trim() || "").toUpperCase() : "";
      const description = headerMap.description ? row[headerMap.description]?.trim() || rawAction : rawAction;
      const shares = headerMap.shares ? Math.abs(parseNumber(row[headerMap.shares])) : 0;
      const pricePerShare = headerMap.price ? Math.abs(parseNumber(row[headerMap.price])) : 0;
      const amount = headerMap.amount ? Math.abs(parseNumber(row[headerMap.amount])) : shares * pricePerShare;

      if (!symbol && !description && amount === 0) {
        failedRows.push({ rowIndex: i, rawContent, reasonCode: "zero_amount_empty_description", reasonMessage: "Row has no symbol, description, or amount" });
        continue;
      }

      transactions.push({
        date: dateStr,
        action,
        symbol: symbol || "CASH",
        description,
        shares,
        pricePerShare,
        amount,
      });
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

export function parseInvestmentCSVWithMetadata(
  csvText: string,
  fallbackFilename?: string,
): ParsedInvestmentResult {
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim(),
  });

  const headers = result.meta.fields || [];
  const { bankName } = detectBrokerage(headers, csvText);
  const accountType = detectAccountType(csvText);
  const { successfulRows: transactions, failedRows } = parseInvestmentCSV(csvText);

  let accountLabel = bankName !== "Unknown Brokerage"
    ? `${bankName} ${accountType === "retirement_401k" ? "401(k)" : accountType === "ira" ? "IRA" : "Brokerage"}`
    : fallbackFilename
      ? fallbackFilename.replace(/\.[^.]+$/, "")
      : "Investment Account";

  const last4 = detectLast4Digits(csvText);
  if (last4) {
    accountLabel = `${accountLabel} \u2022\u2022\u2022\u2022${last4}`;
  }

  return { transactions, bankName, accountLabel, accountType, failedRows };
}
