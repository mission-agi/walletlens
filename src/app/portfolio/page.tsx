import { getActiveUserId } from "@/lib/active-user";
import {
  getPortfolioSummary,
  getInvestmentAccounts,
  getPortfolioPerformanceTimeline,
} from "@/lib/queries/portfolio";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { HoldingsTable } from "@/components/portfolio/holdings-table";
import { AssetAllocationChart } from "@/components/portfolio/asset-allocation-chart";
import { PerformanceChart } from "@/components/portfolio/performance-chart";
import Link from "next/link";
import { TrendingUp, TrendingDown, Building2, Upload } from "lucide-react";

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  brokerage: "Brokerage",
  retirement_401k: "401(k)",
  ira: "IRA",
};

export default async function PortfolioPage() {
  const userId = (await getActiveUserId()) || undefined;
  const [summary, accounts, timeline] = await Promise.all([
    getPortfolioSummary(userId),
    getInvestmentAccounts(userId),
    getPortfolioPerformanceTimeline(userId),
  ]);

  const hasData = summary.holdingCount > 0;

  return (
    <>
      <PageHeader
        title="Portfolio"
        subtitle={`${summary.holdingCount} holdings across ${accounts.length} account${accounts.length !== 1 ? "s" : ""}`}
        action={
          <Link href="/upload">
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4" /> Upload Statement
            </Button>
          </Link>
        }
      />

      {!hasData ? (
        <Card className="flex flex-col items-center py-16">
          <TrendingUp className="h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium">No Investment Data Yet</h3>
          <p className="mt-2 max-w-sm text-center text-sm text-muted-foreground">
            Upload a brokerage statement (CSV or PDF) from Fidelity, Schwab,
            Vanguard, or Robinhood to start tracking your portfolio.
          </p>
          <Link href="/upload" className="mt-4">
            <Button>Upload Statement</Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <p className="text-sm text-muted-foreground">Total Value</p>
              <p className="mt-1 text-2xl font-bold">
                {formatCurrency(summary.totalValue)}
              </p>
            </Card>
            <Card>
              <p className="text-sm text-muted-foreground">Cost Basis</p>
              <p className="mt-1 text-2xl font-bold text-muted-foreground">
                {formatCurrency(summary.totalCostBasis)}
              </p>
            </Card>
            <Card>
              <p className="text-sm text-muted-foreground">Total Gain/Loss</p>
              <p
                className={`mt-1 text-2xl font-bold ${
                  summary.totalGainLoss >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                <span className="inline-flex items-center gap-1">
                  {summary.totalGainLoss >= 0 ? (
                    <TrendingUp className="h-5 w-5" />
                  ) : (
                    <TrendingDown className="h-5 w-5" />
                  )}
                  {summary.totalGainLoss >= 0 ? "+" : "-"}
                  {formatCurrency(Math.abs(summary.totalGainLoss))}
                </span>
              </p>
              <p
                className={`mt-0.5 text-sm ${
                  summary.totalGainLoss >= 0 ? "text-green-500" : "text-red-500"
                }`}
              >
                {summary.totalGainLossPercent >= 0 ? "+" : ""}
                {summary.totalGainLossPercent.toFixed(2)}%
              </p>
            </Card>
            <Card>
              <p className="text-sm text-muted-foreground">Holdings</p>
              <p className="mt-1 text-2xl font-bold">{summary.holdingCount}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Across {accounts.length} account{accounts.length !== 1 ? "s" : ""}
              </p>
            </Card>
          </div>

          {/* Performance chart */}
          {timeline.length >= 2 && (
            <Card>
              <h3 className="mb-4 text-lg font-semibold">Portfolio Performance</h3>
              <PerformanceChart data={timeline} />
            </Card>
          )}

          {/* Asset allocation */}
          <Card>
            <h3 className="mb-4 text-lg font-semibold">Asset Allocation</h3>
            <AssetAllocationChart holdings={summary.holdings} />
          </Card>

          {/* Holdings table */}
          <Card>
            <h3 className="mb-4 text-lg font-semibold">All Holdings</h3>
            <HoldingsTable holdings={summary.holdings} showAccount />
          </Card>

          {/* Investment accounts */}
          <Card>
            <h3 className="mb-4 text-lg font-semibold">Investment Accounts</h3>
            <div className="space-y-3">
              {accounts.map((acct) => {
                const typeLabel =
                  ACCOUNT_TYPE_LABELS[acct.type] || acct.type;
                return (
                  <Link
                    key={acct.id}
                    href={`/portfolio/${acct.id}`}
                    className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <Building2 className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{acct.name}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{acct.bankName}</span>
                          <Badge>{typeLabel}</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-medium">
                        {acct._count.holdings} holding{acct._count.holdings !== 1 ? "s" : ""}
                      </p>
                      <p className="text-muted-foreground">
                        {acct._count.statements} statement{acct._count.statements !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
