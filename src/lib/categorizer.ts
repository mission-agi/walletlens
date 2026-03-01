import { prisma } from "@/lib/db";
import type { ParsedTransaction } from "@/lib/parsers";

export interface CategorizedTransaction extends ParsedTransaction {
  category: string;
}

// Special pattern rules checked before keyword matching.
// These use regex for complex patterns that simple keyword matching can't handle.
// Order matters — first match wins.
const SPECIAL_RULES: { pattern: RegExp; category: string }[] = [
  // Interest & Fees
  { pattern: /interest\s*charge|finance\s*charge|annual\s*fee|late\s*fee|over\s*limit|minimum\s*interest/i, category: "Interest & Fees" },

  // Credit Card Payments (including bank-style descriptions)
  { pattern: /automatic\s*payment|autopay|payment.*thank\s*you|online\s*payment|bill\s*pay|payment\s*from\s*chk|payment\s*from\s*sav/i, category: "Credit Card Payment" },
  { pattern: /credit\s*(?:card|crd)\s*(?:des:?\s*)?(?:epay|payment|bill|pymt)/i, category: "Credit Card Payment" },
  { pattern: /applecard\s*gsbank|apple\s*card\s*payment/i, category: "Credit Card Payment" },
  { pattern: /capital\s*one\s*des:?\s*crcardpmt/i, category: "Credit Card Payment" },
  { pattern: /credit\s*card\s*bill\s*payment/i, category: "Credit Card Payment" },
  { pattern: /target\s*card\s*srvc\s*des:?\s*payment/i, category: "Credit Card Payment" },

  // Income (payroll & direct deposits — must be before Shopping to catch AMAZON PAYROLL)
  { pattern: /des:?\s*payroll|direct\s*dep|des:?\s*salary/i, category: "Income" },

  // Utilities (common abbreviations in bank statements)
  { pattern: /pgande|pg&e|pge\b|pacific\s*gas/i, category: "Utilities" },
  { pattern: /comcast|xfinity/i, category: "Utilities" },
  { pattern: /t-mobile\s*des:?\s*pcs/i, category: "Utilities" },

  // Transfers & investments
  { pattern: /\batm\b.*withdr|\batm\b.*deposit|bkofamerica\s*atm/i, category: "Transfer" },
  { pattern: /robinhood\s*des:?\s*(debits|funds)/i, category: "Transfer" },
  { pattern: /vanguard\s*(?:buy|sell)\s*des:?\s*investment/i, category: "Transfer" },
  { pattern: /wealthfront|ally\s*bank\s*des:?\s*p2p/i, category: "Transfer" },
  { pattern: /acorns\s*(?:invest|round|early|later)/i, category: "Transfer" },
];

export async function categorizeTransactions(
  transactions: ParsedTransaction[],
  cachedCategories?: { id: string; name: string; keywords: string }[],
): Promise<CategorizedTransaction[]> {
  const categories = cachedCategories || await prisma.category.findMany();

  const rules = categories
    .filter((c) => c.name !== "Uncategorized")
    .map((c) => ({
      name: c.name,
      keywords: JSON.parse(c.keywords) as string[],
    }));

  return transactions.map((tx) => {
    const desc = tx.description.toLowerCase();
    let matched = "Uncategorized";

    // 1. Check special pattern rules first
    for (const rule of SPECIAL_RULES) {
      if (rule.pattern.test(desc)) {
        matched = rule.category;
        return { ...tx, category: matched };
      }
    }

    // 2. Standard keyword substring matching
    for (const rule of rules) {
      if (rule.keywords.some((kw) => desc.includes(kw.toLowerCase()))) {
        matched = rule.name;
        break;
      }
    }

    // 3. If still uncategorized, try word-level matching
    if (matched === "Uncategorized") {
      const words = desc.split(/[\s*\/\\,.\-_]+/).filter((w) => w.length >= 3);
      for (const rule of rules) {
        if (rule.keywords.some((kw) => words.some((word) => word === kw.toLowerCase()))) {
          matched = rule.name;
          break;
        }
      }
    }

    return { ...tx, category: matched };
  });
}
