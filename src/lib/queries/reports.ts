import { prisma } from "@/lib/db";
import { roundCents } from "@/lib/utils";

function userFilter(userId?: string) {
  return userId ? { statement: { account: { userId } } } : {};
}

export async function getDetailedMonthlyReport(year: number, month: number, userId?: string) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  const prevStart = new Date(Date.UTC(year, month - 2, 1));
  const prevEnd = new Date(Date.UTC(year, month - 1, 0, 23, 59, 59, 999));

  const categories = await prisma.category.findMany();
  const categoryMap = new Map(categories.map((c) => [c.name, c]));

  // Current month by category
  const currentByCategory = await prisma.transaction.groupBy({
    by: ["category"],
    where: { type: "debit", date: { gte: start, lte: end }, ...userFilter(userId) },
    _sum: { amount: true },
    orderBy: { _sum: { amount: "desc" } },
  });

  // Previous month by category
  const prevByCategory = await prisma.transaction.groupBy({
    by: ["category"],
    where: { type: "debit", date: { gte: prevStart, lte: prevEnd }, ...userFilter(userId) },
    _sum: { amount: true },
  });

  const prevMap = new Map(prevByCategory.map((p) => [p.category, p._sum.amount || 0]));

  const categoryBreakdown = currentByCategory.map((c) => {
    const current = roundCents(c._sum.amount || 0);
    const prev = roundCents(prevMap.get(c.category) || 0);
    const change = prev > 0 ? roundCents(((current - prev) / prev) * 100) : 0;
    return {
      category: c.category,
      current,
      previous: prev,
      change,
      color: categoryMap.get(c.category)?.color || "#9ca3af",
    };
  });

  // Daily spending
  const transactions = await prisma.transaction.findMany({
    where: { type: "debit", date: { gte: start, lte: end }, ...userFilter(userId) },
    orderBy: { date: "asc" },
  });

  const dailyMap = new Map<string, number>();
  for (const tx of transactions) {
    const day = tx.date.toISOString().split("T")[0];
    dailyMap.set(day, roundCents((dailyMap.get(day) || 0) + tx.amount));
  }

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const dailySpending = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    dailySpending.push({ date: dateStr, day: d, amount: dailyMap.get(dateStr) || 0 });
  }

  // Income vs expenses
  const [income, expenses] = await Promise.all([
    prisma.transaction.aggregate({
      where: { type: "credit", date: { gte: start, lte: end }, ...userFilter(userId) },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { type: "debit", date: { gte: start, lte: end }, ...userFilter(userId) },
      _sum: { amount: true },
    }),
  ]);

  // Top transactions
  const topTransactions = await prisma.transaction.findMany({
    where: { type: "debit", date: { gte: start, lte: end }, ...userFilter(userId) },
    orderBy: { amount: "desc" },
    take: 5,
  });

  return {
    categoryBreakdown,
    dailySpending,
    income: roundCents(income._sum.amount || 0),
    expenses: roundCents(expenses._sum.amount || 0),
    topTransactions,
  };
}
