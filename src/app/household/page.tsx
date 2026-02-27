import { getActiveUser } from "@/lib/active-user";
import { getHouseholdSummary } from "@/lib/queries/dashboard";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SpendingPieChart } from "@/components/charts/spending-pie-chart";
import { formatCurrency } from "@/lib/utils";
import { Users, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function HouseholdPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const activeUser = await getActiveUser();
  if (!activeUser) {
    return (
      <>
        <PageHeader title="Household" />
        <Card className="py-12 text-center">
          <p className="text-muted-foreground">No user profile found. Use the profile switcher to create one.</p>
        </Card>
      </>
    );
  }

  const now = new Date();
  const year = params.year ? parseInt(params.year) : undefined;
  const month = params.month ? parseInt(params.month) : undefined;
  const summary = await getHouseholdSummary(activeUser.householdId, year, month);

  const hasData = summary.totalSpending > 0 || summary.totalIncome > 0 || summary.totalPortfolioValue > 0;

  return (
    <>
      <PageHeader
        title="Household"
        subtitle={`Combined view · ${now.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`}
      />

      <div className="space-y-6">
        {!hasData ? (
          <EmptyState
            icon={<Users className="h-12 w-12" />}
            title="No household data yet"
            description="Upload bank statements for household members to see combined spending and income."
            action={
              <Link href="/upload">
                <Button>Upload Statement</Button>
              </Link>
            }
          />
        ) : (
        <>
        {/* Combined totals */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <p className="text-sm text-muted-foreground">Total Spending</p>
            <p className="mt-1 text-2xl font-bold text-red-600">
              {formatCurrency(summary.totalSpending)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">This month</p>
          </Card>
          <Card>
            <p className="text-sm text-muted-foreground">Total Income</p>
            <p className="mt-1 text-2xl font-bold text-green-600">
              {formatCurrency(summary.totalIncome)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">This month</p>
          </Card>
          <Card>
            <p className="text-sm text-muted-foreground">Net</p>
            <p className={`mt-1 text-2xl font-bold ${summary.net >= 0 ? "text-green-600" : "text-red-600"}`}>
              {summary.net >= 0 ? "+" : "-"}{formatCurrency(Math.abs(summary.net))}
            </p>
          </Card>
          <Card>
            <p className="text-sm text-muted-foreground">Portfolio Value</p>
            <p className="mt-1 text-2xl font-bold">
              {formatCurrency(summary.totalPortfolioValue)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              <TrendingUp className="mr-0.5 inline h-3 w-3" />
              All members combined
            </p>
          </Card>
        </div>

        {/* Per-user cards */}
        <Card>
          <h3 className="mb-4 text-lg font-semibold">
            <Users className="mr-2 inline h-5 w-5" />
            Members ({summary.users.length})
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {summary.users.map((user) => (
              <div
                key={user.id}
                className="rounded-lg border border-border p-4"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: user.avatarColor }}
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold">{user.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {user.accountCount} account{user.accountCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <p className="text-muted-foreground">Spending</p>
                    <p className="mt-0.5 font-semibold text-red-600">
                      {formatCurrency(user.monthlySpending)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Income</p>
                    <p className="mt-0.5 font-semibold text-green-600">
                      {formatCurrency(user.monthlyIncome)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Portfolio</p>
                    <p className="mt-0.5 font-semibold">
                      {formatCurrency(user.portfolioValue)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Combined spending by category */}
        <Card>
          <h3 className="mb-4 text-lg font-semibold">Combined Spending by Category</h3>
          {summary.combinedCategories.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No spending data this month
            </p>
          ) : (
            <>
              <SpendingPieChart data={summary.combinedCategories} />
              <div className="mt-4 space-y-2">
                {summary.combinedCategories.slice(0, 8).map((cat) => {
                  const maxTotal = summary.combinedCategories[0]?.total || 1;
                  const pct = (cat.total / maxTotal) * 100;
                  return (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <Badge color={cat.color}>{cat.category}</Badge>
                        <span className="font-medium">
                          {formatCurrency(cat.total)}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted">
                        <div
                          className="h-1.5 rounded-full transition-all"
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
            </>
          )}
        </Card>
        </>
        )}
      </div>
    </>
  );
}
