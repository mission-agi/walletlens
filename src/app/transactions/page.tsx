import { prisma } from "@/lib/db";
import { getFilteredTransactions } from "@/lib/queries/transactions";
import { getAccounts } from "@/lib/queries/accounts";
import { getActiveUser } from "@/lib/active-user";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { TransactionFilters } from "@/components/transactions/transaction-filters";
import { TransactionTable } from "@/components/transactions/transaction-table";
import { List } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const activeUser = await getActiveUser();
  const userId = activeUser?.id;
  const householdId = activeUser?.householdId;
  const page = parseInt(params.page || "1");
  const category = params.category || undefined;
  const accountId = params.account || undefined;
  const search = params.search || undefined;
  const from = params.from || undefined;
  const to = params.to || undefined;

  const [result, accounts, categories] = await Promise.all([
    getFilteredTransactions({ page, category, accountId, search, from, to, userId, householdId }),
    getAccounts(userId),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader title="Transactions" subtitle={`${result.total} total transactions`} />

      <div className="space-y-4">
        <TransactionFilters
          accounts={accounts}
          categories={categories}
          currentFilters={{ category, account: accountId, search, from, to }}
        />

        {result.transactions.length === 0 ? (
          <EmptyState
            icon={<List className="h-12 w-12" />}
            title="No transactions found"
            description={search || category ? "Try adjusting your filters." : "Upload a bank statement to see transactions."}
            action={
              !search && !category ? (
                <Link href="/upload">
                  <Button>Upload Statement</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <TransactionTable
            transactions={result.transactions}
            categories={categories}
            currentPage={result.page}
            totalPages={result.totalPages}
          />
        )}
      </div>
    </>
  );
}
