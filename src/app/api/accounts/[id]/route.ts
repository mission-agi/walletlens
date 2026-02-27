import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requireAuth,
  checkRateLimit,
  verifyAccountAccess,
  safeError,
  auditLog,
} from "@/lib/security";
import { withLogging } from "@/lib/api-logger";

export const GET = withLogging(async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimited = checkRateLimit(request, "account-detail");
  if (rateLimited) return rateLimited;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const hasAccess = await verifyAccountAccess(id, auth);
  if (!hasAccess) {
    return safeError("Account not found", 404);
  }

  const account = await prisma.account.findUnique({
    where: { id },
    include: {
      statements: {
        include: { _count: { select: { transactions: true } } },
        orderBy: { uploadDate: "desc" },
      },
    },
  });

  if (!account) {
    return safeError("Account not found", 404);
  }

  return NextResponse.json(account);
});

export const DELETE = withLogging(async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimited = checkRateLimit(request, "account-delete");
  if (rateLimited) return rateLimited;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const hasAccess = await verifyAccountAccess(id, auth);
  if (!hasAccess) {
    return safeError("Account not found", 404);
  }

  // Explicitly delete all child records before removing the account
  const accountStatements = await prisma.statement.findMany({
    where: { accountId: id },
    select: { id: true },
  });
  const statementIds = accountStatements.map((s) => s.id);

  await prisma.$transaction([
    prisma.investmentTransaction.deleteMany({
      where: { statementId: { in: statementIds } },
    }),
    prisma.transaction.deleteMany({
      where: { statementId: { in: statementIds } },
    }),
    prisma.holding.deleteMany({ where: { accountId: id } }),
    prisma.statement.deleteMany({ where: { accountId: id } }),
    prisma.account.delete({ where: { id } }),
  ]);

  auditLog("account.delete", auth.user.id, { accountId: id });

  return NextResponse.json({ success: true });
});
