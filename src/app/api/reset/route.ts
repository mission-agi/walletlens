import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requireAuth,
  checkRateLimit,
  safeError,
  auditLog,
} from "@/lib/security";
import { withLogging } from "@/lib/api-logger";

export const POST = withLogging(async function POST(request: Request) {
  const rateLimited = checkRateLimit(request, "data-reset", 5, 60 * 1000);
  if (rateLimited) return rateLimited;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    // Delete data belonging to the authenticated user's household
    // Also catch orphaned accounts (userId is null)
    const householdAccounts = await prisma.account.findMany({
      where: {
        OR: [
          { user: { householdId: auth.householdId } },
          { userId: null },
        ],
      },
      select: { id: true },
    });

    const accountIds = householdAccounts.map((a) => a.id);

    if (accountIds.length > 0) {
      // Find all statements for these accounts
      const householdStatements = await prisma.statement.findMany({
        where: { accountId: { in: accountIds } },
        select: { id: true },
      });
      const statementIds = householdStatements.map((s) => s.id);

      await prisma.$transaction([
        prisma.investmentTransaction.deleteMany({
          where: { statementId: { in: statementIds } },
        }),
        prisma.holding.deleteMany({
          where: { accountId: { in: accountIds } },
        }),
        prisma.transaction.deleteMany({
          where: { statementId: { in: statementIds } },
        }),
        prisma.statement.deleteMany({
          where: { accountId: { in: accountIds } },
        }),
        prisma.account.deleteMany({
          where: { id: { in: accountIds } },
        }),
      ]);
    }

    auditLog("data.reset", auth.user.id, {
      householdId: auth.householdId,
      accountsDeleted: accountIds.length,
    });

    return NextResponse.json({ success: true, message: "Household data cleared successfully" });
  } catch (error) {
    return safeError("Failed to reset data. Please try again.", 500, error);
  }
});
