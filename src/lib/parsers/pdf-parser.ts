import type { ParsedTransaction, ParsedResult, FailedRow, ParseResult } from "./index";
import { PDFParse } from "pdf-parse";
import { roundCents } from "@/lib/utils";

const BANK_PATTERNS: { pattern: RegExp; bankName: string }[] = [
  { pattern: /bank of america|bofa/i, bankName: "Bank of America" },
  { pattern: /chase/i, bankName: "Chase" },
  { pattern: /wells fargo/i, bankName: "Wells Fargo" },
  { pattern: /citibank|(?<![a-z])citi(?![a-z])/i, bankName: "Citibank" },
  { pattern: /capital one/i, bankName: "Capital One" },
  { pattern: /american express|(?<![a-z])amex(?![a-z])/i, bankName: "American Express" },
  { pattern: /discover/i, bankName: "Discover" },
  { pattern: /us bank/i, bankName: "US Bank" },
];

const CHASE_ACCOUNT_LABELS: RegExp[] = [
  /Chase Freedom Unlimited/i,
  /Chase Freedom Flex/i,
  /Chase Freedom/i,
  /Chase Sapphire Preferred/i,
  /Chase Sapphire Reserve/i,
  /Chase Sapphire/i,
  /Chase Slate/i,
  /Chase Ink/i,
];

const BOFA_ACCOUNT_LABELS: RegExp[] = [
  /Military\s*-\s*Air\s*Adv\s*Plus\s*Banking/i,
  /Advantage\s*Plus\s*Banking/i,
  /Advantage\s*SafeBalance/i,
  /Advantage\s*Relationship/i,
  /Core\s*Checking/i,
  /Savings/i,
];

function detectBank(text: string): string {
  // Use only the first ~2000 chars (header area) for bank detection
  // to avoid false positives from transaction descriptions like "CHASE CREDIT CRD"
  const headerArea = text.substring(0, 2000);
  for (const { pattern, bankName } of BANK_PATTERNS) {
    if (pattern.test(headerArea)) return bankName;
  }
  // Fallback: check full text
  for (const { pattern, bankName } of BANK_PATTERNS) {
    if (pattern.test(text)) return bankName;
  }
  return "Unknown Bank";
}

function detectLast4Digits(text: string): string | null {
  // Pattern: Account number: 0001 5837 7974 (BofA style)
  const bofaAccountPattern = /Account\s*(?:number|#|No\.?)\s*:?\s*(\d{4})\s+\d{4}\s+(\d{4})/i;
  const bofaMatch = text.match(bofaAccountPattern);
  if (bofaMatch) return bofaMatch[2];

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

function detectAccountLabel(text: string, bankName: string): string {
  let label: string;

  if (bankName === "Chase") {
    let found = false;
    for (const pattern of CHASE_ACCOUNT_LABELS) {
      const match = text.match(pattern);
      if (match) {
        label = match[0];
        found = true;
        break;
      }
    }
    if (!found) {
      label = "Chase Credit Card";
    } else {
      label = label!;
    }
  } else if (bankName === "Bank of America") {
    label = "Bank of America Account";
    for (const pattern of BOFA_ACCOUNT_LABELS) {
      const match = text.match(pattern);
      if (match) {
        label = `BofA ${match[0].trim()}`;
        break;
      }
    }
  } else {
    label = `${bankName} Account`;
    const lines = text.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 0 && trimmed.length < 60 && trimmed.toLowerCase().includes(bankName.toLowerCase())) {
        if (trimmed.length > bankName.length + 2) {
          label = trimmed;
          break;
        }
      }
    }
  }

  const last4 = detectLast4Digits(text);
  if (last4) {
    label = `${label} \u2022\u2022\u2022\u2022${last4}`;
  }

  return label;
}

export function inferYear(month: number, day: number, text: string): string {
  // Try to find year from written-out dates like "January 1, 2026"
  const writtenDatePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+(\d{4})/gi;
  let writtenMatch;
  const writtenYears: string[] = [];
  while ((writtenMatch = writtenDatePattern.exec(text)) !== null) {
    writtenYears.push(writtenMatch[1]);
  }
  if (writtenYears.length > 0) {
    return writtenYears[0];
  }

  const periodPattern = /(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/g;
  let match;
  const candidates: { month: number; year: string }[] = [];
  while ((match = periodPattern.exec(text)) !== null) {
    const y = match[3].length === 2 ? `20${match[3]}` : match[3];
    candidates.push({ month: parseInt(match[1]), year: y });
  }
  if (candidates.length > 0) {
    const yearCounts = new Map<string, number>();
    for (const c of candidates) {
      yearCounts.set(c.year, (yearCounts.get(c.year) || 0) + 1);
    }
    let bestYear = candidates[0].year;
    let bestCount = 0;
    for (const [y, count] of yearCounts) {
      if (count > bestCount) {
        bestCount = count;
        bestYear = y;
      }
    }
    return bestYear;
  }
  return new Date().getFullYear().toString();
}

/**
 * Detect if the PDF is a bank statement with transactions (vs payroll, etc.)
 */
function isBankStatement(text: string): boolean {
  const statementIndicators = [
    /account\s*summary/i,
    /transaction\s*(?:history|details|activity)/i,
    /account\s*activity/i,
    /deposits?\s*and\s*(?:other\s*)?additions/i,
    /withdrawals?\s*and\s*(?:other\s*)?subtractions/i,
    /beginning\s*balance/i,
    /ending\s*balance/i,
    /previous\s*balance/i,
    /new\s*balance/i,
    /statement\s*(?:period|date|closing)/i,
    /payment[s]?\s*and\s*(?:other\s*)?credits/i,
  ];

  const nonStatementIndicators = [
    /earnings\s*statement/i,
    /pay\s*(?:date|period|stub)/i,
    /gross\s*pay/i,
    /net\s*pay/i,
    /federal\s*income\s*tax/i,
    /social\s*security\s*tax/i,
  ];

  let statementScore = 0;
  let nonStatementScore = 0;

  for (const pattern of statementIndicators) {
    if (pattern.test(text)) statementScore++;
  }
  for (const pattern of nonStatementIndicators) {
    if (pattern.test(text)) nonStatementScore++;
  }

  return statementScore > nonStatementScore;
}

/**
 * Parse transactions from PDF text, handling multi-line entries.
 *
 * Bank statements like BofA wrap descriptions across multiple lines:
 *   01/02/26  AMAZON.COM SVCS DES:PAYROLL  ID:280102...
 *   CO ID:9111111103 PPD
 *   5,419.78
 *
 * The amount may appear on a continuation line.
 */
function isCheckingOrSavingsStatement(text: string): boolean {
  return /deposits?\s*and\s*(?:other\s*)?additions/i.test(text) &&
    /withdrawals?\s*and\s*(?:other\s*)?subtractions/i.test(text);
}

function parseTransactionsFromText(text: string): ParseResult<ParsedTransaction> {
  // For checking/savings: positive = deposit (credit), negative = withdrawal (debit)
  // For credit cards: positive = charge (debit), negative = payment (credit)
  const isChecking = isCheckingOrSavingsStatement(text);
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const transactions: ParsedTransaction[] = [];
  const failedRows: FailedRow[] = [];
  const datePattern = /^(\d{1,2}[/-]\d{1,2})(?:[/-](\d{2,4}))?(?:\s|$)/;
  const amountPattern = /\$?\s?-?[\d,]+\.\d{2}/g;
  const standaloneAmountPattern = /^-?\$?[\d,]+\.\d{2}$/;
  const defaultYear = inferYear(0, 0, text);

  const skipPatterns = [
    /^page\s+\d+/i,
    /^total\s/i,
    /^subtotal\s/i,
    /^continued\s/i,
    /^date\s+description/i,
    /^date\s+of/i,
    /year-to-date/i,
    /^\d{7,}/,
    /^0{4,}/,
    /^(beginning|opening|starting|ending|closing)\s*balance/i,
    /^account\s*summary/i,
    /^statement\s*summary/i,
    /\bpending\b/i,
  ];

  // Group lines into transaction blocks
  const blocks: { dateLine: string; continuationLines: string[] }[] = [];
  let currentBlock: { dateLine: string; continuationLines: string[] } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    let skip = false;
    for (const sp of skipPatterns) {
      if (sp.test(line)) { skip = true; break; }
    }
    if (skip) {
      if (currentBlock) {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      continue;
    }

    const dateMatch = line.match(datePattern);
    if (dateMatch) {
      const dateParts = dateMatch[1].split(/[/-]/);
      if (dateParts.length === 2) {
        const mNum = parseInt(dateParts[0]);
        const dNum = parseInt(dateParts[1]);
        if (mNum >= 1 && mNum <= 12 && dNum >= 1 && dNum <= 31) {
          if (currentBlock) blocks.push(currentBlock);
          currentBlock = { dateLine: line, continuationLines: [] };
          continue;
        }
      }
    }

    if (currentBlock) {
      if (/^(deposits|withdrawals|ATM|other\s+subtractions|checks|service\s*fees|interest|balance)/i.test(line)) {
        blocks.push(currentBlock);
        currentBlock = null;
        continue;
      }
      // Only collect a few continuation lines (avoid runaway)
      if (currentBlock.continuationLines.length < 5) {
        currentBlock.continuationLines.push(line);
      }
    }
  }
  if (currentBlock) blocks.push(currentBlock);

  for (let blockIdx = 0; blockIdx < blocks.length; blockIdx++) {
    const block = blocks[blockIdx];
    const rawContent = [block.dateLine, ...block.continuationLines].join(" ").substring(0, 200);
    const dateMatch = block.dateLine.match(datePattern)!;
    const dateBase = dateMatch[1];
    const dateParts = dateBase.split(/[/-]/);
    const [m, d] = dateParts;

    let year: string;
    if (dateMatch[2]) {
      year = dateMatch[2].length === 2 ? `20${dateMatch[2]}` : dateMatch[2];
    } else {
      year = defaultYear;
    }

    const parsedDate = new Date(`${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
    if (isNaN(parsedDate.getTime())) {
      failedRows.push({ rowIndex: blockIdx, rawContent, reasonCode: "invalid_date", reasonMessage: "Could not parse date from PDF block" });
      continue;
    }

    // Look for amount: first on date line, then on continuation lines
    let amounts = block.dateLine.match(amountPattern);

    if (!amounts || amounts.length === 0) {
      for (const contLine of block.continuationLines) {
        const trimmed = contLine.replace(/[$,\s]/g, "").trim();
        if (standaloneAmountPattern.test(trimmed) || standaloneAmountPattern.test(contLine.trim())) {
          const contAmounts = contLine.match(amountPattern);
          if (contAmounts) {
            amounts = contAmounts;
            break;
          }
        }
      }
    }

    if (!amounts || amounts.length === 0) {
      failedRows.push({ rowIndex: blockIdx, rawContent, reasonCode: "unparseable_row", reasonMessage: "No amount found in PDF block" });
      continue;
    }

    const lastAmount = amounts[amounts.length - 1];
    const amountVal = parseFloat(lastAmount.replace(/[$,\s]/g, ""));
    if (isNaN(amountVal)) {
      failedRows.push({ rowIndex: blockIdx, rawContent, reasonCode: "unparseable_row", reasonMessage: "Unparseable amount in PDF block" });
      continue;
    }

    // Build description from the date line
    const fullDateStr = dateMatch[0];
    const afterDate = block.dateLine.substring(fullDateStr.length).trim();
    const amountIdx = afterDate.lastIndexOf(lastAmount);
    let description: string;
    if (amountIdx > 0) {
      description = afterDate.substring(0, amountIdx).trim();
    } else {
      description = afterDate.replace(amountPattern, "").trim();
    }

    // Clean up tab characters and extra whitespace
    description = description.replace(/\t+/g, " ").replace(/\s{2,}/g, " ").trim();

    if (!description && amountVal === 0) {
      failedRows.push({ rowIndex: blockIdx, rawContent, reasonCode: "zero_amount_empty_description", reasonMessage: "Block has zero amount and no description" });
      continue;
    }

    const type = isChecking
      ? (amountVal < 0 ? "debit" : "credit")
      : (amountVal < 0 ? "credit" : "debit");

    transactions.push({
      date: parsedDate.toISOString().split("T")[0],
      description: description || "Unknown",
      amount: roundCents(Math.abs(amountVal)),
      type,
    });
  }

  transactions.sort((a, b) => a.date.localeCompare(b.date));
  return { successfulRows: transactions, failedRows };
}

export async function parsePDF(buffer: Buffer): Promise<ParseResult<ParsedTransaction>> {
  try {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const textResult = await parser.getText();
    const text = textResult.text;
    await parser.destroy();

    if (!isBankStatement(text)) {
      return {
        successfulRows: [],
        failedRows: [{ rowIndex: -1, rawContent: "", reasonCode: "not_a_bank_statement", reasonMessage: "PDF does not appear to be a bank statement" }],
      };
    }

    return parseTransactionsFromText(text);
  } catch (err) {
    return {
      successfulRows: [],
      failedRows: [{ rowIndex: -1, rawContent: "", reasonCode: "parser_crash", reasonMessage: err instanceof Error ? err.message : "Unknown error" }],
    };
  }
}

export async function parsePDFWithMetadata(
  buffer: Buffer,
  fallbackFilename?: string,
): Promise<ParsedResult> {
  try {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const textResult = await parser.getText();
    const text = textResult.text;
    await parser.destroy();

    const bankName = detectBank(text);
    const accountLabel =
      bankName !== "Unknown Bank"
        ? detectAccountLabel(text, bankName)
        : fallbackFilename
          ? fallbackFilename.replace(/\.[^.]+$/, "")
          : "Unknown Account";

    if (!isBankStatement(text)) {
      return {
        transactions: [],
        bankName,
        accountLabel,
        failedRows: [{ rowIndex: -1, rawContent: "", reasonCode: "not_a_bank_statement", reasonMessage: "PDF does not appear to be a bank statement" }],
      };
    }

    const { successfulRows: transactions, failedRows } = parseTransactionsFromText(text);

    return { transactions, bankName, accountLabel, failedRows };
  } catch (err) {
    return {
      transactions: [],
      bankName: "Unknown Bank",
      accountLabel: fallbackFilename?.replace(/\.[^.]+$/, "") || "Unknown Account",
      failedRows: [{ rowIndex: -1, rawContent: "", reasonCode: "parser_crash", reasonMessage: err instanceof Error ? err.message : "Unknown error" }],
    };
  }
}
