import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod/v4";
import {
  requireAuth,
  verifyAccountAccess,
  checkRateLimit,
  sanitizeString,
  sanitizeSearchQuery,
  sanitizePage,
  safeError,
  auditLog,
} from "@/lib/security";
import { withLogging } from "@/lib/api-logger";

const SaveTransactionsSchema = z.object({
  accountId: z.string().max(100).optional(),
  bankName: z.string().max(200).optional(),
  accountLabel: z.string().max(200).optional(),
  accountType: z.enum(["checking", "savings", "credit", "brokerage", "retirement_401k", "ira"]).optional(),
  filename: z.string().max(500),
  transactions: z.array(
    z.object({
      date: z.string().max(50),
      description: z.string().max(1000),
      amount: z.number(),
      type: z.enum(["debit", "credit"]),
      category: z.string().max(200),
    })
  ),
});

export const POST = withLogging(async function POST(request: Request) {
  const rateLimited = checkRateLimit(request, "transactions-create", 200, 60 * 1000);
  if (rateLimited) return rateLimited;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const parsed = SaveTransactionsSchema.safeParse(body);
  if (!parsed.success) {
    return safeError("Invalid transaction data.");
  }

  const { accountId, bankName, accountLabel, accountType, filename, transactions } = parsed.data;

  // Resolve the account: use provided accountId, or look up / create by bankName
  let resolvedAccountId = accountId;

  // If accountId is provided, verify it belongs to the user's household
  if (resolvedAccountId) {
    const hasAccess = await verifyAccountAccess(resolvedAccountId, auth);
    if (!hasAccess) {
      return safeError("Access denied: account belongs to another household", 403);
    }
  }

  if (!resolvedAccountId) {
    if (!bankName) {
      return safeError("Either accountId or bankName is required.");
    }

    // Try to find an existing account by bankName within the user's household
    const existingAccount = await prisma.account.findFirst({
      where: {
        bankName: { equals: bankName },
        user: { householdId: auth.householdId },
      },
    });

    if (existingAccount) {
      resolvedAccountId = existingAccount.id;
    } else {
      // Create a new account owned by the authenticated user
      const newAccount = await prisma.account.create({
        data: {
          name: sanitizeString(accountLabel || bankName, 200),
          bankName: sanitizeString(bankName, 200),
          type: accountType || "checking",
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

    await tx.transaction.createMany({
      data: transactions.map((t) => ({
        statementId: statement.id,
        date: new Date(t.date),
        description: sanitizeString(t.description, 1000),
        originalDescription: sanitizeString(t.description, 1000),
        amount: t.amount,
        type: t.type,
        category: sanitizeString(t.category, 200),
      })),
    });

    return statement;
  });

  auditLog("transaction.create", auth.user.id, {
    statementId: result.id,
    count: transactions.length,
  });

  return NextResponse.json(result, { status: 201 });
});

export const GET = withLogging(async function GET(request: Request) {
  const rateLimited = checkRateLimit(request, "transactions-list");
  if (rateLimited) return rateLimited;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const page = sanitizePage(searchParams.get("page"));
  const limit = 20;
  const skip = (page - 1) * limit;
  const category = searchParams.get("category");
  const accountId = searchParams.get("account");
  const search = searchParams.get("search");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {
    statement: {
      account: {
        user: { householdId: auth.householdId },
      },
    },
  };

  if (category) where.category = sanitizeString(category, 200);
  if (search) where.description = { contains: sanitizeSearchQuery(search) };
  if (accountId) {
    where.statement = {
      ...where.statement,
      accountId,
    };
  }
  if (from || to) {
    where.date = {};
    if (from) {
      const fromDate = new Date(from);
      if (!isNaN(fromDate.getTime())) where.date.gte = fromDate;
    }
    if (to) {
      const toDate = new Date(to);
      if (!isNaN(toDate.getTime())) where.date.lte = toDate;
    }
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        statement: {
          include: { account: { select: { name: true, bankName: true } } },
        },
      },
      orderBy: { date: "desc" },
      skip,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  return NextResponse.json({
    transactions,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
});
