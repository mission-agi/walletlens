import { prisma } from "@/lib/db";
import { roundCents } from "@/lib/utils";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function userFilter(userId?: string) {
  return userId ? { statement: { account: { userId } } } : {};
}

export async function getMonthlyBreakdown(year: number, userId?: string) {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

  const transactions = await prisma.transaction.findMany({
    where: { date: { gte: start, lte: end }, ...userFilter(userId) },
    select: { date: true, amount: true, type: true },
  });

  const months = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    monthName: MONTH_NAMES[i],
    spending: 0,
    income: 0,
    net: 0,
  }));

  for (const tx of transactions) {
    const m = tx.date.getUTCMonth();
    if (tx.type === "debit") {
      months[m].spending += tx.amount;
    } else {
      months[m].income += tx.amount;
    }
  }

  for (const m of months) {
    m.spending = roundCents(m.spending);
    m.income = roundCents(m.income);
    m.net = roundCents(m.income - m.spending);
  }

  return months;
}

export async function getAnnualCategoryTotals(year: number, userId?: string) {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

  const categories = await prisma.category.findMany();
  const categoryMap = new Map(categories.map((c) => [c.name, c]));

  const byCategory = await prisma.transaction.groupBy({
    by: ["category"],
    where: { type: "debit", date: { gte: start, lte: end }, ...userFilter(userId) },
    _sum: { amount: true },
    orderBy: { _sum: { amount: "desc" } },
  });

  return byCategory.map((c) => ({
    category: c.category,
    total: roundCents(c._sum.amount || 0),
    color: categoryMap.get(c.category)?.color || "#9ca3af",
  }));
}

export async function getYearOverYearComparison(year: number, userId?: string) {
  const currentStart = new Date(Date.UTC(year, 0, 1));
  const currentEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
  const prevStart = new Date(Date.UTC(year - 1, 0, 1));
  const prevEnd = new Date(Date.UTC(year - 1, 11, 31, 23, 59, 59, 999));

  const [currentTx, prevTx] = await Promise.all([
    prisma.transaction.findMany({
      where: { type: "debit", date: { gte: currentStart, lte: currentEnd }, ...userFilter(userId) },
      select: { date: true, amount: true },
    }),
    prisma.transaction.findMany({
      where: { type: "debit", date: { gte: prevStart, lte: prevEnd }, ...userFilter(userId) },
      select: { date: true, amount: true },
    }),
  ]);

  const currentMonthly = Array(12).fill(0);
  const prevMonthly = Array(12).fill(0);

  for (const tx of currentTx) {
    currentMonthly[tx.date.getUTCMonth()] += tx.amount;
  }
  for (const tx of prevTx) {
    prevMonthly[tx.date.getUTCMonth()] += tx.amount;
  }

  const currentYearTotal = roundCents(currentMonthly.reduce((a: number, b: number) => a + b, 0));
  const previousYearTotal = roundCents(prevMonthly.reduce((a: number, b: number) => a + b, 0));
  const changePercent =
    previousYearTotal > 0
      ? roundCents(((currentYearTotal - previousYearTotal) / previousYearTotal) * 100)
      : 0;

  const monthByMonth = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    monthName: MONTH_NAMES[i],
    current: currentMonthly[i],
    previous: prevMonthly[i],
    change:
      prevMonthly[i] > 0
        ? ((currentMonthly[i] - prevMonthly[i]) / prevMonthly[i]) * 100
        : 0,
  }));

  return {
    currentYearTotal,
    previousYearTotal,
    changePercent,
    monthByMonth,
  };
}

export async function getAnnualProjection(year: number, userId?: string) {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

  const transactions = await prisma.transaction.findMany({
    where: { type: "debit", date: { gte: start, lte: end }, ...userFilter(userId) },
    select: { date: true, amount: true },
  });

  if (transactions.length === 0) {
    return { totalSpent: 0, monthsWithData: 0, projectedAnnual: 0 };
  }

  const monthsWithData = new Set(
    transactions.map((tx) => tx.date.getUTCMonth())
  ).size;

  const totalSpent = roundCents(transactions.reduce((sum, tx) => sum + tx.amount, 0));
  const projectedAnnual =
    monthsWithData > 0 ? roundCents((totalSpent / monthsWithData) * 12) : 0;

  return { totalSpent, monthsWithData, projectedAnnual };
}

export async function getAnnualReport(year: number, userId?: string) {
  const [monthlyBreakdown, categoryTotals, yearOverYear, projection] =
    await Promise.all([
      getMonthlyBreakdown(year, userId),
      getAnnualCategoryTotals(year, userId),
      getYearOverYearComparison(year, userId),
      getAnnualProjection(year, userId),
    ]);

  const totalSpending = roundCents(monthlyBreakdown.reduce((s, m) => s + m.spending, 0));
  const totalIncome = roundCents(monthlyBreakdown.reduce((s, m) => s + m.income, 0));

  return {
    year,
    totalSpending,
    totalIncome,
    net: roundCents(totalIncome - totalSpending),
    projectedAnnual: projection.projectedAnnual,
    monthsWithData: projection.monthsWithData,
    monthlyBreakdown,
    categoryTotals,
    yearOverYear,
  };
}
