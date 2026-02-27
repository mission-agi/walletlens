import { Card } from "@/components/ui/card";
import { Building2 } from "lucide-react";
import Link from "next/link";
import { DeleteAccountButton } from "./delete-account-button";

interface AccountCardProps {
  account: {
    id: string;
    name: string;
    bankName: string;
    createdAt: Date;
    _count: { statements: number };
  };
}

export function AccountCard({ account }: AccountCardProps) {
  return (
    <Card className="group">
      <div className="flex items-start justify-between">
        <Link href={`/accounts/${account.id}`} className="flex items-center gap-3 group-hover:opacity-90">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold">{account.name}</h3>
            <p className="text-[13px] text-muted-foreground">{account.bankName}</p>
          </div>
        </Link>
        <DeleteAccountButton accountId={account.id} accountName={account.name} />
      </div>
      <div className="mt-4 border-t border-border/40 pt-3 text-[12px] text-muted-foreground">
        {account._count.statements} statement{account._count.statements !== 1 ? "s" : ""} uploaded
      </div>
    </Card>
  );
}
