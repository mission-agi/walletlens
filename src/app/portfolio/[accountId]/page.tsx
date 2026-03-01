import { notFound } from "next/navigation";
import { getAccountById } from "@/lib/queries/accounts";
import { getActiveUser } from "@/lib/active-user";
import {
  getHoldingsForAccount,
  getInvestmentTransactions,
} from "@/lib/queries/portfolio";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { HoldingsTable } from "@/components/portfolio/holdings-table";
import { InvestmentTxTable } from "@/components/portfolio/investment-tx-table";
import Link from "next/link";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  brokerage: "Brokerage",
  retirement_401k: "401(k)",
  ira: "IRA",
};

export default async function PortfolioAccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ accountId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { accountId } = await params;
  const search = await searchParams;
  const page = parseInt(search.page || "1");

  const activeUser = await getActiveUser();
  const account = await getAccountById(accountId, activeUser?.householdId);
  if (!account) notFound();

  const [holdings, txResult] = await Promise.all([
    getHoldingsForAccount(accountId),
    getInvestmentTransactions({ accountId, page }),
  ]);

  const totalValue = holdings.reduce((s, h) => s + h.currentValue, 0);
  const totalCostBasis = holdings.reduce((s, h) => s + h.costBasis, 0);
  const totalGainLoss = totalValue - totalCostBasis;
  const gainPct = totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : 0;
  const typeLabel = ACCOUNT_TYPE_LABELS[account.type] || account.type;

  return (
    <>
      <div className="mb-4">
        <Link
          href="/portfolio"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to portfolio
        </Link>
      </div>

      <PageHeader
        title={account.name}
        subtitle={`${account.bankName} · ${typeLabel}`}
      />

      <div className="space-y-6">
        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <p className="text-sm text-muted-foreground">Total Value</p>
            <p className="mt-1 text-2xl font-bold">
              {formatCurrency(totalValue)}
            </p>
          </Card>
          <Card>
            <p className="text-sm text-muted-foreground">Cost Basis</p>
            <p className="mt-1 text-2xl font-bold text-muted-foreground">
              {formatCurrency(totalCostBasis)}
            </p>
          </Card>
          <Card>
            <p className="text-sm text-muted-foreground">Gain/Loss</p>
            <p
              className={`mt-1 text-2xl font-bold ${
                totalGainLoss >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              <span className="inline-flex items-center gap-1">
                {totalGainLoss >= 0 ? (
                  <TrendingUp className="h-5 w-5" />
                ) : (
                  <TrendingDown className="h-5 w-5" />
                )}
                {totalGainLoss >= 0 ? "+" : "-"}
                {formatCurrency(Math.abs(totalGainLoss))}
              </span>
            </p>
            <p
              className={`mt-0.5 text-sm ${
                totalGainLoss >= 0 ? "text-green-500" : "text-red-500"
              }`}
            >
              {gainPct >= 0 ? "+" : ""}
              {gainPct.toFixed(2)}%
            </p>
          </Card>
          <Card>
            <p className="text-sm text-muted-foreground">Holdings</p>
            <p className="mt-1 text-2xl font-bold">{holdings.length}</p>
          </Card>
        </div>

        {/* Holdings */}
        <Card>
          <h3 className="mb-4 text-lg font-semibold">Holdings</h3>
          <HoldingsTable holdings={holdings} />
        </Card>

        {/* Transaction history */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Transaction History</h3>
            <p className="text-sm text-muted-foreground">
              {txResult.total} transaction{txResult.total !== 1 ? "s" : ""}
            </p>
          </div>
          <InvestmentTxTable transactions={txResult.transactions} />

          {/* Pagination */}
          {txResult.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              {page > 1 && (
                <Link href={`/portfolio/${accountId}?page=${page - 1}`}>
                  <Button variant="outline" size="sm">
                    Previous
                  </Button>
                </Link>
              )}
              <span className="text-sm text-muted-foreground">
                Page {page} of {txResult.totalPages}
              </span>
              {page < txResult.totalPages && (
                <Link href={`/portfolio/${accountId}?page=${page + 1}`}>
                  <Button variant="outline" size="sm">
                    Next
                  </Button>
                </Link>
              )}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
