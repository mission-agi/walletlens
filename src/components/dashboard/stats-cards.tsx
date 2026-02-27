import { Card } from "@/components/ui/card";
import { DollarSign, Receipt, Building2, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export function StatsCards({
  totalSpending,
  transactionCount,
  accountCount,
  topCategory,
}: {
  totalSpending: number;
  transactionCount: number;
  accountCount: number;
  topCategory: string;
}) {
  const stats = [
    {
      label: "Total Spending",
      value: formatCurrency(totalSpending),
      icon: DollarSign,
      iconBg: "bg-red-50",
      iconColor: "text-red-500",
    },
    {
      label: "Transactions",
      value: transactionCount.toString(),
      icon: Receipt,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-500",
    },
    {
      label: "Accounts",
      value: accountCount.toString(),
      icon: Building2,
      iconBg: "bg-violet-50",
      iconColor: "text-violet-500",
    },
    {
      label: "Top Category",
      value: topCategory,
      icon: TrendingUp,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 stagger-children">
      {stats.map((stat) => (
        <Card key={stat.label} className="flex items-center gap-3.5 overflow-hidden p-4">
          <div className={`shrink-0 rounded-lg p-2.5 ${stat.iconBg}`}>
            <stat.icon className={`h-[18px] w-[18px] ${stat.iconColor}`} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {stat.label}
            </p>
            <p className="truncate text-lg font-semibold tracking-tight" title={stat.value}>
              {stat.value}
            </p>
          </div>
        </Card>
      ))}
    </div>
  );
}
