import { prisma } from "@/lib/db";

export async function getFilteredTransactions(params: {
  page?: number;
  category?: string;
  accountId?: string;
  search?: string;
  from?: string;
  to?: string;
  userId?: string;
}) {
  const { page = 1, category, accountId, search, from, to, userId } = params;
  const limit = 20;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (category) where.category = category;
  if (search) where.description = { contains: search };

  // Build statement filter — always scope by userId when available
  const stmtFilter: Record<string, unknown> = {};
  if (accountId) stmtFilter.accountId = accountId;
  if (userId) stmtFilter.account = { userId };
  if (Object.keys(stmtFilter).length > 0) {
    where.statement = stmtFilter;
  }

  if (from || to) {
    where.date = {};
    if (from) (where.date as Record<string, unknown>).gte = new Date(from);
    if (to) (where.date as Record<string, unknown>).lte = new Date(to);
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

  return { transactions, total, page, totalPages: Math.ceil(total / limit) };
}
