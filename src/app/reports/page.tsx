import { getDetailedMonthlyReport } from "@/lib/queries/reports";
import { getActiveUserId } from "@/lib/active-user";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PeriodSelector } from "@/components/reports/period-selector";
import { DailySpendingChart } from "@/components/reports/daily-spending-chart";
import { CategoryComparisonChart } from "@/components/reports/category-comparison-chart";
import { IncomeExpenseChart } from "@/components/reports/income-expense-chart";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { FileBarChart, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const now = new Date();
  const year = parseInt(params.year || String(now.getUTCFullYear()));
  const month = parseInt(params.month || String(now.getUTCMonth() + 1));
  const userId = await getActiveUserId() || undefined;

  const report = await getDetailedMonthlyReport(year, month, userId);

  const monthName = new Date(year, month - 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const hasData = report.income > 0 || report.expenses > 0;

  return (
    <>
      <PageHeader title="Reports" subtitle={monthName} />

      <div className="space-y-6">
        <PeriodSelector year={year} month={month} />

        {!hasData ? (
          <EmptyState
            icon={<FileBarChart className="h-12 w-12" />}
            title={`No data for ${monthName}`}
            description={`No transactions found for ${monthName}. Upload a bank statement or try a different month.`}
            action={
              <Link href="/upload">
                <Button>Upload Statement</Button>
              </Link>
            }
          />
        ) : (
        <>
        {/* Income vs Expenses summary */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <p className="text-sm text-muted-foreground">Income</p>
            <p className="mt-1 text-2xl font-bold text-green-600">
              {formatCurrency(report.income)}
            </p>
          </Card>
          <Card>
            <p className="text-sm text-muted-foreground">Expenses</p>
            <p className="mt-1 text-2xl font-bold text-red-600">
              {formatCurrency(report.expenses)}
            </p>
          </Card>
          <Card>
            <p className="text-sm text-muted-foreground">Net</p>
            <p className={`mt-1 text-2xl font-bold ${report.income - report.expenses >= 0 ? "text-green-600" : "text-red-600"}`}>
              {report.income - report.expenses >= 0 ? "+" : "-"}
              {formatCurrency(Math.abs(report.income - report.expenses))}
            </p>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <h3 className="mb-4 text-lg font-semibold">Daily Spending</h3>
            <DailySpendingChart data={report.dailySpending} />
          </Card>
          <Card>
            <h3 className="mb-4 text-lg font-semibold">Income vs Expenses</h3>
            <IncomeExpenseChart income={report.income} expenses={report.expenses} />
          </Card>
        </div>

        <Card>
          <h3 className="mb-4 text-lg font-semibold">Category Breakdown</h3>
          <CategoryComparisonChart data={report.categoryBreakdown} />
        </Card>

        {/* Category details table */}
        <Card>
          <h3 className="mb-4 text-lg font-semibold">Category Details</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 font-medium">Category</th>
                  <th className="pb-2 text-right font-medium">This Month</th>
                  <th className="pb-2 text-right font-medium">Last Month</th>
                  <th className="pb-2 text-right font-medium">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {report.categoryBreakdown.map((cat) => (
                  <tr key={cat.category}>
                    <td className="py-3">
                      <Badge color={cat.color}>{cat.category}</Badge>
                    </td>
                    <td className="py-3 text-right font-medium">{formatCurrency(cat.current)}</td>
                    <td className="py-3 text-right text-muted-foreground">{formatCurrency(cat.previous)}</td>
                    <td className="py-3 text-right">
                      {cat.change !== 0 && (
                        <span className={`inline-flex items-center gap-1 text-xs ${cat.change > 0 ? "text-red-500" : "text-green-500"}`}>
                          {cat.change > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {Math.abs(cat.change).toFixed(0)}%
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Top transactions */}
        <Card>
          <h3 className="mb-4 text-lg font-semibold">Largest Expenses</h3>
          <div className="space-y-3">
            {report.topTransactions.map((tx, i) => (
              <div key={tx.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-medium">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {tx.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                </div>
                <span className="font-medium text-red-600">
                  -{formatCurrency(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        </Card>
        </>
        )}
      </div>
    </>
  );
}
