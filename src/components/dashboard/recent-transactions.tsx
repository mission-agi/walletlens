import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, getCategoryColor } from "@/lib/utils";

interface Transaction {
  id: string;
  date: Date;
  description: string;
  amount: number;
  type: string;
  category: string;
  statement: { account: { name: string } };
}

export function RecentTransactions({
  transactions,
  categories,
}: {
  transactions: Transaction[];
  categories: { name: string; color: string }[];
}) {
  return (
    <div className="overflow-x-auto -mx-5">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-border/60 text-left">
            <th className="pb-2.5 pl-5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Date</th>
            <th className="pb-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Description</th>
            <th className="pb-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Account</th>
            <th className="pb-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Category</th>
            <th className="pb-2.5 pr-5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {transactions.map((tx) => (
            <tr key={tx.id} className="hover:bg-muted/30">
              <td className="whitespace-nowrap py-2.5 pl-5 text-muted-foreground">{formatDate(tx.date)}</td>
              <td className="max-w-xs truncate py-2.5">{tx.description}</td>
              <td className="py-2.5 text-muted-foreground">{tx.statement.account.name}</td>
              <td className="py-2.5">
                <Badge color={getCategoryColor(tx.category, categories)}>
                  {tx.category}
                </Badge>
              </td>
              <td className={`whitespace-nowrap py-2.5 pr-5 text-right font-medium tabular-nums ${tx.type === "debit" ? "text-red-600" : "text-emerald-600"}`}>
                {tx.type === "debit" ? "-" : "+"}{formatCurrency(tx.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
