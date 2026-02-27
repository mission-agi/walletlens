import { notFound } from "next/navigation";
import { getAccountById } from "@/lib/queries/accounts";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteStatementButton } from "@/components/accounts/delete-statement-button";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const account = await getAccountById(id);
  if (!account) notFound();

  return (
    <>
      <div className="mb-4">
        <Link
          href="/accounts"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to accounts
        </Link>
      </div>
      <PageHeader
        title={account.name}
        subtitle={account.bankName}
      />
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Uploaded Statements</h2>
        {account.statements.length === 0 ? (
          <Card>
            <p className="text-sm text-muted-foreground">
              No statements uploaded yet.{" "}
              <Link href="/upload" className="text-primary hover:underline">
                Upload one now
              </Link>
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {account.statements.map((stmt) => (
              <Card key={stmt.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{stmt.filename}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Uploaded {formatDate(stmt.uploadDate)}</span>
                      <Badge>{stmt._count.transactions} transactions</Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/transactions?statementId=${stmt.id}`}>
                    <Button variant="outline" size="sm">
                      View
                    </Button>
                  </Link>
                  <DeleteStatementButton statementId={stmt.id} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
