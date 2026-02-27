"use client";

import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

interface Holding {
  id: string;
  symbol: string;
  name: string;
  shares: number;
  costBasis: number;
  currentPrice: number;
  currentValue: number;
  account?: { name: string; bankName: string } | null;
}

export function HoldingsTable({
  holdings,
  showAccount = false,
}: {
  holdings: Holding[];
  showAccount?: boolean;
}) {
  if (holdings.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No holdings found. Upload a brokerage statement to get started.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="pb-3 font-medium">Symbol</th>
            <th className="pb-3 font-medium">Name</th>
            {showAccount && <th className="pb-3 font-medium">Account</th>}
            <th className="pb-3 text-right font-medium">Shares</th>
            <th className="pb-3 text-right font-medium">Avg Cost</th>
            <th className="pb-3 text-right font-medium">Price</th>
            <th className="pb-3 text-right font-medium">Value</th>
            <th className="pb-3 text-right font-medium">Gain/Loss</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {holdings.map((h) => {
            const gainLoss = h.currentValue - h.costBasis;
            const gainPct = h.costBasis > 0 ? (gainLoss / h.costBasis) * 100 : 0;
            const avgCost = h.shares > 0 ? h.costBasis / h.shares : 0;
            const isPositive = gainLoss >= 0;

            return (
              <tr key={h.id} className="hover:bg-muted/50">
                <td className="py-3 font-mono font-semibold">{h.symbol}</td>
                <td className="max-w-[200px] truncate py-3 text-muted-foreground">
                  {h.name}
                </td>
                {showAccount && (
                  <td className="py-3 text-xs text-muted-foreground">
                    {h.account?.name || "—"}
                  </td>
                )}
                <td className="py-3 text-right">{h.shares.toFixed(4)}</td>
                <td className="py-3 text-right">{formatCurrency(avgCost)}</td>
                <td className="py-3 text-right">{formatCurrency(h.currentPrice)}</td>
                <td className="py-3 text-right font-medium">
                  {formatCurrency(h.currentValue)}
                </td>
                <td className="py-3 text-right">
                  <span className={isPositive ? "text-green-600" : "text-red-600"}>
                    {isPositive ? "+" : "-"}{formatCurrency(Math.abs(gainLoss))}
                  </span>
                  <span
                    className={`ml-1 text-xs ${isPositive ? "text-green-500" : "text-red-500"}`}
                  >
                    ({isPositive ? "+" : ""}{gainPct.toFixed(1)}%)
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
