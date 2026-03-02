import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod/v4";
import { recomputeHoldings } from "@/lib/queries/portfolio";
import {
  requireAuth,
  checkRateLimit,
  sanitizeString,
  sanitizePage,
  safeError,
  auditLog,
} from "@/lib/security";
import { withLogging } from "@/lib/api-logger";

const SaveInvestmentTransactionsSchema = z.object({
  accountId: z.string().max(100).optional(),
  bankName: z.string().max(200).optional(),
  accountLabel: z.string().max(200).optional(),
  accountType: z.enum(["brokerage", "retirement_401k", "ira"]).default("brokerage"),
  filename: z.string().max(500),
  transactions: z.array(
    z.object({
      date: z.string().max(50),
      action: z.enum(["buy", "sell", "dividend", "contribution", "distribution", "fee", "interest", "transfer"]),
      symbol: z.string().max(20),
      description: z.string().max(1000),
      shares: z.number().min(0),
      pricePerShare: z.number().min(0),
      amount: z.number(),
    })
  ),
});

export const POST = withLogging(async function POST(request: Request) {
  const rateLimited = checkRateLimit(request, "investment-transactions-create", 200, 60 * 1000);
  if (rateLimited) return rateLimited;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const parsed = SaveInvestmentTransactionsSchema.safeParse(body);
  if (!parsed.success) {
    return safeError("Invalid investment transaction data.");
  }

  const { accountId, bankName, accountLabel, accountType, filename, transactions } = parsed.data;

  if (transactions.length === 0) {
    return safeError("At least one transaction is required.");
  }

  // Resolve account
  let resolvedAccountId = accountId;

  if (!resolvedAccountId) {
    if (!bankName) {
      return safeError("Either accountId or bankName is required.");
    }

    // Find existing investment account by bankName within the user's household
    const existingAccount = await prisma.account.findFirst({
      where: {
        bankName: { equals: bankName },
        type: { in: ["brokerage", "retirement_401k", "ira"] },
        user: { householdId: auth.householdId },
      },
    });

    if (existingAccount) {
      resolvedAccountId = existingAccount.id;
    } else {
      const newAccount = await prisma.account.create({
        data: {
          name: sanitizeString(accountLabel || bankName, 200),
          bankName: sanitizeString(bankName, 200),
          type: accountType,
          userId: auth.user.id,
        },
      });
      resolvedAccountId = newAccount.id;
    }
  }

  // Duplicate upload detection: reject if same filename already exists for this account
  const existingStatement = await prisma.statement.findFirst({
    where: {
      accountId: resolvedAccountId!,
      filename: sanitizeString(filename, 500),
    },
  });
  if (existingStatement) {
    return safeError("This file has already been uploaded to this account.", 409);
  }

  const dates = transactions.map((t) => new Date(t.date));
  const periodStart = new Date(Math.min(...dates.map((d) => d.getTime())));
  const periodEnd = new Date(Math.max(...dates.map((d) => d.getTime())));

  const result = await prisma.$transaction(async (tx) => {
    const statement = await tx.statement.create({
      data: {
        accountId: resolvedAccountId!,
        filename: sanitizeString(filename, 500),
        periodStart,
        periodEnd,
      },
    });

    await tx.investmentTransaction.createMany({
      data: transactions.map((t) => ({
        statementId: statement.id,
        date: new Date(t.date),
        action: t.action,
        symbol: sanitizeString(t.symbol, 20),
        description: sanitizeString(t.description, 1000),
        shares: t.shares,
        pricePerShare: t.pricePerShare,
        amount: t.amount,
      })),
    });

    return statement;
  });

  // Recompute holdings after saving
  await recomputeHoldings(resolvedAccountId!);

  auditLog("investment.create", auth.user.id, {
    statementId: result.id,
    count: transactions.length,
  });

  return NextResponse.json(result, { status: 201 });
});

export const GET = withLogging(async function GET(request: Request) {
  const rateLimited = checkRateLimit(request, "investment-transactions-list");
  if (rateLimited) return rateLimited;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId") || undefined;
  const symbol = searchParams.get("symbol") || undefined;
  const page = sanitizePage(searchParams.get("page"));
  const limit = 20;
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {
    statement: {
      account: {
        user: { householdId: auth.householdId },
      },
    },
  };

  if (symbol) where.symbol = sanitizeString(symbol, 20);
  if (accountId) {
    where.statement = {
      ...where.statement,
      accountId,
    };
  }

  const [transactions, total] = await Promise.all([
    prisma.investmentTransaction.findMany({
      where,
      include: {
        statement: {
          include: { account: { select: { name: true } } },
        },
      },
      orderBy: { date: "desc" },
      skip,
      take: limit,
    }),
    prisma.investmentTransaction.count({ where }),
  ]);

  return NextResponse.json({
    transactions,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
});
