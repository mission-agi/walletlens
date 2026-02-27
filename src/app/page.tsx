import { getDashboardStats, getMonthlySpendingByCategory, getMonthlyTotals, getRecentTransactions, getNetWorthSummary } from "@/lib/queries/dashboard";
import { prisma } from "@/lib/db";
import { getActiveUserId } from "@/lib/active-user";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { DashboardPeriodSelector, type RangeMode } from "@/components/dashboard/dashboard-period-selector";
import { SpendingPieChart } from "@/components/charts/spending-pie-chart";
import { MonthlyBarChart } from "@/components/charts/monthly-bar-chart";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { EmptyState } from "@/components/ui/empty-state";
import { LayoutDashboard, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

function computeDateRange(rangeMode: RangeMode, year: number, month: number, startDate?: string, endDate?: string): { start: Date; end: Date } | undefined {
  if (rangeMode === "ytd") {
    return {
      start: new Date(Date.UTC(year, 0, 1)),
      end: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
    };
  }
  if (rangeMode === "custom" && startDate && endDate) {
    const [sy, sm, sd] = startDate.split("-").map(Number);
    const [ey, em, ed] = endDate.split("-").map(Number);
    return {
      start: new Date(Date.UTC(sy, sm - 1, sd)),
      end: new Date(Date.UTC(ey, em - 1, ed, 23, 59, 59, 999)),
    };
  }
  // monthly — no explicit dateRange, queries use year/month defaults
  return undefined;
}

function computePeriodLabel(rangeMode: RangeMode, year: number, month: number, startDate?: string, endDate?: string): string {
  if (rangeMode === "ytd") {
    return `Year to Date — ${year}`;
  }
  if (rangeMode === "custom" && startDate && endDate) {
    const fmt = (d: string) => {
      const [y, m, day] = d.split("-").map(Number);
      return new Date(y, m - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    };
    return `${fmt(startDate)} – ${fmt(endDate)}`;
  }
  return new Date(year, month - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const now = new Date();
  const year = parseInt(params.year || String(now.getUTCFullYear()));
  const month = parseInt(params.month || String(now.getUTCMonth() + 1));
  const rangeMode = (params.range as RangeMode) || "monthly";
  const startDate = params.startDate;
  const endDate = params.endDate;
  const userId = await getActiveUserId() || undefined;

  const dateRange = computeDateRange(rangeMode, year, month, startDate, endDate);
  const periodLabel = computePeriodLabel(rangeMode, year, month, startDate, endDate);

  const [stats, categorySpending, monthlyTotals, recentTxns, categories, netWorth] = await Promise.all([
    getDashboardStats(userId, year, month, dateRange),
    getMonthlySpendingByCategory(year, month, userId, dateRange),
    getMonthlyTotals(6, userId, year, month),
    getRecentTransactions(10, userId, year, month, dateRange),
    prisma.category.findMany(),
    getNetWorthSummary(userId),
  ]);

  const hasData = recentTxns.length > 0;
  const hasPortfolio = netWorth.holdingCount > 0;

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`Overview for ${periodLabel}`} />

      <div className="mb-6">
        <DashboardPeriodSelector year={year} month={month} rangeMode={rangeMode} startDate={startDate} endDate={endDate} />
      </div>

      {!hasData && !hasPortfolio ? (
        <EmptyState
          icon={<LayoutDashboard className="h-12 w-12" />}
          title="No data yet"
          description={`No transactions found for ${periodLabel}. Upload a bank statement or try a different month.`}
          action={
            <Link href="/upload">
              <Button>Upload Statement</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-6 stagger-children">
          {/* Net Worth + Spending Stats */}
          {hasPortfolio && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger-children">
              <Card>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Portfolio Value</p>
                <p className="mt-1.5 text-2xl font-bold tabular-nums">
                  {formatCurrency(netWorth.portfolioValue)}
                </p>
                <Link href="/portfolio" className="mt-2 inline-block text-[12px] font-medium text-primary hover:underline">
                  View portfolio →
                </Link>
              </Card>
              <Card>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Portfolio Gain/Loss</p>
                <p className={`mt-1.5 text-2xl font-bold tabular-nums ${netWorth.portfolioGainLoss >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  <span className="inline-flex items-center gap-1">
                    {netWorth.portfolioGainLoss >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                    {netWorth.portfolioGainLoss >= 0 ? "+" : "-"}
                    {formatCurrency(Math.abs(netWorth.portfolioGainLoss))}
                  </span>
                </p>
              </Card>
              <Card>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{periodLabel} Spending</p>
                <p className="mt-1.5 text-2xl font-bold tabular-nums text-red-600">
                  {formatCurrency(stats.totalSpending)}
                </p>
              </Card>
              <Card>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Holdings</p>
                <p className="mt-1.5 text-2xl font-bold tabular-nums">{netWorth.holdingCount}</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  {stats.accountCount} account{stats.accountCount !== 1 ? "s" : ""}
                </p>
              </Card>
            </div>
          )}

          {!hasPortfolio && hasData && (
            <StatsCards
              totalSpending={stats.totalSpending}
              transactionCount={stats.transactionCount}
              accountCount={stats.accountCount}
              topCategory={categorySpending[0]?.category || "N/A"}
            />
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <h3 className="mb-4 text-[15px] font-semibold">Spending by Category</h3>
              <SpendingPieChart data={categorySpending} />
            </Card>
            <Card>
              <h3 className="mb-4 text-[15px] font-semibold">Monthly Spending</h3>
              <MonthlyBarChart data={monthlyTotals} />
            </Card>
          </div>

          {hasData && (
            <Card>
              <h3 className="mb-4 text-[15px] font-semibold">Recent Transactions</h3>
              <RecentTransactions transactions={recentTxns} categories={categories} />
            </Card>
          )}
        </div>
      )}
    </>
  );
}
