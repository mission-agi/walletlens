import { prisma } from "@/lib/db";
import { roundCents } from "@/lib/utils";

function userFilter(userId?: string) {
  return userId ? { statement: { account: { userId } } } : {};
}

export async function getMonthlySpendingByCategory(year: number, month: number, userId?: string, dateRange?: { start: Date; end: Date }) {
  const start = dateRange?.start ?? new Date(Date.UTC(year, month - 1, 1));
  const end = dateRange?.end ?? new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  const transactions = await prisma.transaction.groupBy({
    by: ["category"],
    where: {
      type: "debit",
      date: { gte: start, lte: end },
      ...userFilter(userId),
    },
    _sum: { amount: true },
    orderBy: { _sum: { amount: "desc" } },
  });

  const categories = await prisma.category.findMany();
  const categoryMap = new Map(categories.map((c) => [c.name, c]));

  return transactions.map((t) => ({
    category: t.category,
    total: roundCents(t._sum.amount || 0),
    color: categoryMap.get(t.category)?.color || "#9ca3af",
    icon: categoryMap.get(t.category)?.icon || "HelpCircle",
  }));
}

export async function getMonthlyTotals(months: number = 6, userId?: string, endYear?: number, endMonth?: number) {
  const now = new Date();
  const refYear = endYear ?? now.getUTCFullYear();
  const refMonth = (endMonth ?? (now.getUTCMonth() + 1)) - 1; // convert 1-based to 0-based
  const results = [];

  for (let i = months - 1; i >= 0; i--) {
    const year = refYear;
    const month = refMonth - i;
    const start = new Date(Date.UTC(year, month, 1));
    const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

    const agg = await prisma.transaction.aggregate({
      where: {
        type: "debit",
        date: { gte: start, lte: end },
        ...userFilter(userId),
      },
      _sum: { amount: true },
    });

    results.push({
      month: start.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }),
      total: roundCents(agg._sum.amount || 0),
      year: start.getUTCFullYear(),
      monthNum: start.getUTCMonth() + 1,
    });
  }

  return results;
}

export async function getRecentTransactions(limit: number = 10, userId?: string, year?: number, month?: number, dateRange?: { start: Date; end: Date }) {
  const where: Record<string, unknown> = {};
  if (userId) where.statement = { account: { userId } };
  if (dateRange) {
    where.date = { gte: dateRange.start, lte: dateRange.end };
  } else if (year && month) {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    where.date = { gte: start, lte: end };
  }

  return prisma.transaction.findMany({
    where: Object.keys(where).length > 0 ? where : undefined,
    include: {
      statement: {
        include: { account: { select: { name: true } } },
      },
    },
    orderBy: { date: "desc" },
    take: limit,
  });
}

export async function getNetWorthSummary(userId?: string) {
  const holdingWhere = userId ? { account: { userId } } : {};

  const holdings = await prisma.holding.findMany({
    where: holdingWhere,
  });

  const portfolioValue = roundCents(holdings.reduce((s, h) => s + h.currentValue, 0));
  const portfolioCostBasis = roundCents(holdings.reduce((s, h) => s + h.costBasis, 0));
  const portfolioGainLoss = roundCents(portfolioValue - portfolioCostBasis);
  const holdingCount = holdings.length;

  return {
    portfolioValue,
    portfolioCostBasis,
    portfolioGainLoss,
    holdingCount,
  };
}

export async function getHouseholdSummary(householdId: string, year?: number, month?: number) {
  const users = await prisma.user.findMany({
    where: { householdId },
    include: {
      accounts: {
        include: {
          holdings: true,
          _count: { select: { statements: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const now = new Date();
  const y = year ?? now.getUTCFullYear();
  const m = month != null ? month - 1 : now.getUTCMonth();
  const monthStart = new Date(Date.UTC(y, m, 1));
  const monthEnd = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));

  const userSummaries = await Promise.all(
    users.map(async (user) => {
      const spending = await prisma.transaction.aggregate({
        where: {
          type: "debit",
          date: { gte: monthStart, lte: monthEnd },
          statement: { account: { userId: user.id } },
        },
        _sum: { amount: true },
      });

      const income = await prisma.transaction.aggregate({
        where: {
          type: "credit",
          date: { gte: monthStart, lte: monthEnd },
          statement: { account: { userId: user.id } },
        },
        _sum: { amount: true },
      });

      const portfolioValue = user.accounts.reduce(
        (sum, acct) => sum + acct.holdings.reduce((s, h) => s + h.currentValue, 0),
        0
      );

      return {
        id: user.id,
        name: user.name,
        avatarColor: user.avatarColor,
        monthlySpending: roundCents(spending._sum.amount || 0),
        monthlyIncome: roundCents(income._sum.amount || 0),
        portfolioValue: roundCents(portfolioValue),
        accountCount: user.accounts.length,
      };
    })
  );

  const allUserIds = users.map((u) => u.id);
  const categorySpending = await prisma.transaction.groupBy({
    by: ["category"],
    where: {
      type: "debit",
      date: { gte: monthStart, lte: monthEnd },
      statement: { account: { userId: { in: allUserIds } } },
    },
    _sum: { amount: true },
    orderBy: { _sum: { amount: "desc" } },
  });

  const categories = await prisma.category.findMany();
  const categoryMap = new Map(categories.map((c) => [c.name, c]));

  const combinedCategories = categorySpending.map((t) => ({
    category: t.category,
    total: roundCents(t._sum.amount || 0),
    color: categoryMap.get(t.category)?.color || "#9ca3af",
  }));

  const totalSpending = roundCents(userSummaries.reduce((s, u) => s + u.monthlySpending, 0));
  const totalIncome = roundCents(userSummaries.reduce((s, u) => s + u.monthlyIncome, 0));
  const totalPortfolioValue = roundCents(userSummaries.reduce((s, u) => s + u.portfolioValue, 0));

  return {
    users: userSummaries,
    combinedCategories,
    totalSpending,
    totalIncome,
    totalPortfolioValue,
    net: roundCents(totalIncome - totalSpending),
  };
}

export async function getDashboardStats(userId?: string, year?: number, month?: number, dateRange?: { start: Date; end: Date }) {
  const now = new Date();
  const y = year ?? now.getUTCFullYear();
  const m = month ?? (now.getUTCMonth() + 1);
  const monthStart = dateRange?.start ?? new Date(Date.UTC(y, m - 1, 1));
  const monthEnd = dateRange?.end ?? new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));

  const accountWhere = userId ? { userId } : {};

  const [totalSpending, transactionCount, accountCount] = await Promise.all([
    prisma.transaction.aggregate({
      where: {
        type: "debit",
        date: { gte: monthStart, lte: monthEnd },
        ...userFilter(userId),
      },
      _sum: { amount: true },
    }),
    prisma.transaction.count({
      where: {
        date: { gte: monthStart, lte: monthEnd },
        ...userFilter(userId),
      },
    }),
    prisma.account.count({ where: accountWhere }),
  ]);

  return {
    totalSpending: roundCents(totalSpending._sum.amount || 0),
    transactionCount,
    accountCount,
  };
}
