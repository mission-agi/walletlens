import { getAccounts } from "@/lib/queries/accounts";
import { getActiveUserId } from "@/lib/active-user";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { AccountCard } from "@/components/accounts/account-card";
import { AddAccountButton } from "@/components/accounts/add-account-button";
import { Building2 } from "lucide-react";

export default async function AccountsPage() {
  const userId = await getActiveUserId() || undefined;
  const accounts = await getAccounts(userId);

  return (
    <>
      <PageHeader
        title="Accounts"
        subtitle="Manage your bank accounts"
        action={<AddAccountButton />}
      />
      {accounts.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-12 w-12" />}
          title="No accounts yet"
          description="Add a bank account to start uploading statements."
          action={<AddAccountButton />}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
            />
          ))}
        </div>
      )}
    </>
  );
}
