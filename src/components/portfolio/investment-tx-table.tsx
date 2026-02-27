"use client";

import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";

interface InvestmentTransaction {
  id: string;
  date: string | Date;
  action: string;
  symbol: string;
  description: string;
  shares: number;
  pricePerShare: number;
  amount: number;
  statement?: {
    account?: { name: string } | null;
  } | null;
}

const ACTION_COLORS: Record<string, string> = {
  buy: "#22c55e",
  sell: "#ef4444",
  dividend: "#8b5cf6",
  contribution: "#3b82f6",
  distribution: "#f97316",
  fee: "#6b7280",
  interest: "#06b6d4",
  transfer: "#a3a3a3",
};

export function InvestmentTxTable({
  transactions,
  showAccount = false,
}: {
  transactions: InvestmentTransaction[];
  showAccount?: boolean;
}) {
  if (transactions.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No investment transactions found.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="pb-3 font-medium">Date</th>
            <th className="pb-3 font-medium">Action</th>
            <th className="pb-3 font-medium">Symbol</th>
            <th className="pb-3 font-medium">Description</th>
            {showAccount && <th className="pb-3 font-medium">Account</th>}
            <th className="pb-3 text-right font-medium">Shares</th>
            <th className="pb-3 text-right font-medium">Price</th>
            <th className="pb-3 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {transactions.map((tx) => (
            <tr key={tx.id} className="hover:bg-muted/50">
              <td className="whitespace-nowrap py-3">{formatDate(tx.date)}</td>
              <td className="py-3">
                <Badge color={ACTION_COLORS[tx.action] || "#a3a3a3"}>
                  {tx.action}
                </Badge>
              </td>
              <td className="py-3 font-mono font-semibold">{tx.symbol}</td>
              <td className="max-w-[200px] truncate py-3 text-muted-foreground">
                {tx.description}
              </td>
              {showAccount && (
                <td className="py-3 text-xs text-muted-foreground">
                  {tx.statement?.account?.name || "—"}
                </td>
              )}
              <td className="py-3 text-right">
                {tx.shares > 0 ? tx.shares.toFixed(4) : "—"}
              </td>
              <td className="py-3 text-right">
                {tx.pricePerShare > 0 ? formatCurrency(tx.pricePerShare) : "—"}
              </td>
              <td className="py-3 text-right font-medium">
                {formatCurrency(tx.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
