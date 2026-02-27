import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requireAuth,
  checkRateLimit,
  sanitizeString,
  sanitizeSearchQuery,
} from "@/lib/security";
import { withLogging } from "@/lib/api-logger";

export const GET = withLogging(async function GET(request: Request) {
  const rateLimited = checkRateLimit(request, "transactions-export", 10, 60 * 1000);
  if (rateLimited) return rateLimited;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
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
    where.statement = { ...where.statement, accountId };
  }
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) where.date.lte = new Date(to);
  }

  const transactions = await prisma.transaction.findMany({
    where,
    include: {
      statement: {
        include: { account: { select: { name: true, bankName: true } } },
      },
    },
    orderBy: { date: "desc" },
    take: 50000, // Safety cap
  });

  // Build CSV
  const escapeCSV = (val: string) => {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const header = "Date,Description,Account,Bank,Category,Type,Amount";
  const rows = transactions.map((tx) => {
    const date = new Date(tx.date).toISOString().split("T")[0];
    const amount = tx.type === "debit" ? `-${tx.amount}` : `${tx.amount}`;
    return [
      date,
      escapeCSV(tx.description),
      escapeCSV(tx.statement.account.name),
      escapeCSV(tx.statement.account.bankName),
      escapeCSV(tx.category),
      tx.type,
      amount,
    ].join(",");
  });

  const csv = [header, ...rows].join("\n");
  const filename = `transactions-${new Date().toISOString().split("T")[0]}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
