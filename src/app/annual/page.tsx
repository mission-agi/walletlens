import { getAnnualReport } from "@/lib/queries/annual";
import { getActiveUserId } from "@/lib/active-user";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/utils";
import { CalendarDays, TrendingDown, TrendingUp } from "lucide-react";
import { YearComparisonChart } from "@/components/charts/year-comparison-chart";
import { AnnualYearSelector } from "@/components/annual/year-selector";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function AnnualPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const now = new Date();
  const year = parseInt(params.year || String(now.getUTCFullYear()));
  const userId = await getActiveUserId() || undefined;

  const report = await getAnnualReport(year, userId);

  const hasData = report.totalSpending > 0 || report.totalIncome > 0;

  return (
    <>
      <PageHeader title="Annual Report" subtitle={String(year)} />

      <div className="space-y-6">
        <AnnualYearSelector year={year} />

        {!hasData ? (
          <EmptyState
            icon={<CalendarDays className="h-12 w-12" />}
            title={`No data for ${year}`}
            description={`No transactions found for ${year}. Upload a bank statement or try a different year.`}
            action={
              <Link href="/upload">
                <Button>Upload Statement</Button>
              </Link>
            }
          />
        ) : (
        <>
        {/* Summary cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <p className="text-sm text-muted-foreground">Total Spent</p>
            <p className="mt-1 text-2xl font-bold text-red-600">
              {formatCurrency(report.totalSpending)}
            </p>
          </Card>
          <Card>
            <p className="text-sm text-muted-foreground">Total Income</p>
            <p className="mt-1 text-2xl font-bold text-green-600">
              {formatCurrency(report.totalIncome)}
            </p>
          </Card>
          <Card>
            <p className="text-sm text-muted-foreground">Net</p>
            <p
              className={`mt-1 text-2xl font-bold ${
                report.net >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {report.net >= 0 ? "+" : "-"}
              {formatCurrency(Math.abs(report.net))}
            </p>
          </Card>
          <Card>
            <p className="text-sm text-muted-foreground">Projected Annual</p>
            <p className="mt-1 text-2xl font-bold">
              {formatCurrency(report.projectedAnnual)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Based on {report.monthsWithData} month{report.monthsWithData !== 1 ? "s" : ""} of data
            </p>
          </Card>
        </div>

        {/* Year-over-year comparison chart */}
        <Card>
          <h3 className="mb-4 text-lg font-semibold">
            Monthly Spending: {year} vs {year - 1}
          </h3>
          <YearComparisonChart
            data={report.yearOverYear.monthByMonth}
            currentYear={year}
            previousYear={year - 1}
          />
        </Card>

        {/* Year-over-year summary */}
        {report.yearOverYear.previousYearTotal > 0 && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <p className="text-sm text-muted-foreground">{year} Total</p>
              <p className="mt-1 text-xl font-bold">
                {formatCurrency(report.yearOverYear.currentYearTotal)}
              </p>
            </Card>
            <Card>
              <p className="text-sm text-muted-foreground">{year - 1} Total</p>
              <p className="mt-1 text-xl font-bold">
                {formatCurrency(report.yearOverYear.previousYearTotal)}
              </p>
            </Card>
            <Card>
              <p className="text-sm text-muted-foreground">Year-over-Year Change</p>
              <p
                className={`mt-1 text-xl font-bold ${
                  report.yearOverYear.changePercent > 0
                    ? "text-red-600"
                    : "text-green-600"
                }`}
              >
                {report.yearOverYear.changePercent > 0 ? "+" : ""}
                {report.yearOverYear.changePercent.toFixed(1)}%
              </p>
            </Card>
          </div>
        )}

        {/* Category breakdown */}
        <Card>
          <h3 className="mb-4 text-lg font-semibold">Category Breakdown ({year})</h3>
          {report.categoryTotals.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No spending data
            </p>
          ) : (
            <div className="space-y-3">
              {report.categoryTotals.map((cat) => {
                const maxTotal = report.categoryTotals[0]?.total || 1;
                const pct = (cat.total / maxTotal) * 100;
                return (
                  <div key={cat.category} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <Badge color={cat.color}>{cat.category}</Badge>
                      <span className="font-medium">
                        {formatCurrency(cat.total)}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: cat.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Monthly comparison table */}
        <Card>
          <h3 className="mb-4 text-lg font-semibold">
            Monthly Comparison
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 font-medium">Month</th>
                  <th className="pb-2 text-right font-medium">{year}</th>
                  <th className="pb-2 text-right font-medium">{year - 1}</th>
                  <th className="pb-2 text-right font-medium">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {report.yearOverYear.monthByMonth.map((m) => (
                  <tr key={m.month}>
                    <td className="py-3 font-medium">{m.monthName}</td>
                    <td className="py-3 text-right">
                      {formatCurrency(m.current)}
                    </td>
                    <td className="py-3 text-right text-muted-foreground">
                      {formatCurrency(m.previous)}
                    </td>
                    <td className="py-3 text-right">
                      {m.previous > 0 && m.change !== 0 && (
                        <span
                          className={`inline-flex items-center gap-1 text-xs ${
                            m.change > 0 ? "text-red-500" : "text-green-500"
                          }`}
                        >
                          {m.change > 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {Math.abs(m.change).toFixed(0)}%
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        </>
        )}
      </div>
    </>
  );
}
