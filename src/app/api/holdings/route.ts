import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requireAuth,
  checkRateLimit,
} from "@/lib/security";
import { withLogging } from "@/lib/api-logger";

export const GET = withLogging(async function GET(request: Request) {
  const rateLimited = checkRateLimit(request, "holdings-list");
  if (rateLimited) return rateLimited;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {
    account: {
      user: { householdId: auth.householdId },
    },
  };

  if (accountId) {
    where.accountId = accountId;
  }

  const holdings = await prisma.holding.findMany({
    where,
    include: {
      account: { select: { name: true, bankName: true, type: true } },
    },
    orderBy: { currentValue: "desc" },
  });

  const totalValue = holdings.reduce((s, h) => s + h.currentValue, 0);
  const totalCostBasis = holdings.reduce((s, h) => s + h.costBasis, 0);

  return NextResponse.json({
    holdings,
    totalValue,
    totalCostBasis,
    totalGainLoss: totalValue - totalCostBasis,
  });
});
