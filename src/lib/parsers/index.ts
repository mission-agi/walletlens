export interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: "debit" | "credit";
}

export interface ParsedResult {
  transactions: ParsedTransaction[];
  bankName: string;
  accountLabel: string;
  accountType?: string;
  failedRows?: FailedRow[];
}

// Investment types
export type InvestmentAction = "buy" | "sell" | "dividend" | "contribution" | "distribution" | "fee" | "interest" | "transfer";

export interface ParsedInvestmentTransaction {
  date: string;
  action: InvestmentAction;
  symbol: string;
  description: string;
  shares: number;
  pricePerShare: number;
  amount: number;
}

export interface ParsedInvestmentResult {
  transactions: ParsedInvestmentTransaction[];
  bankName: string;
  accountLabel: string;
  accountType: "brokerage" | "retirement_401k" | "ira";
  failedRows?: FailedRow[];
}

// Dead-letter types for parse error reporting
export type FailedRowReasonCode =
  | "invalid_date"
  | "missing_amount_column"
  | "missing_date_column"
  | "zero_amount_empty_description"
  | "unparseable_row"
  | "unknown_action"
  | "summary_row"
  | "pending_transaction"
  | "not_a_bank_statement"
  | "not_an_investment_statement"
  | "parser_crash";

export interface FailedRow {
  rowIndex: number;
  rawContent: string;
  reasonCode: FailedRowReasonCode;
  reasonMessage: string;
}

export interface ParseResult<T> {
  successfulRows: T[];
  failedRows: FailedRow[];
}
