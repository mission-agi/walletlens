import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod/v4";
import {
  requireAuth,
  checkRateLimit,
  sanitizeString,
  safeError,
  auditLog,
} from "@/lib/security";
import { withLogging } from "@/lib/api-logger";

const CreateAccountSchema = z.object({
  name: z.string().min(1).max(200),
  bankName: z.string().min(1).max(200),
  type: z
    .enum(["checking", "savings", "credit", "brokerage", "retirement_401k", "ira"])
    .default("checking"),
});

export const GET = withLogging(async function GET(request: Request) {
  const rateLimited = checkRateLimit(request, "accounts-list");
  if (rateLimited) return rateLimited;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const accounts = await prisma.account.findMany({
    where: { user: { householdId: auth.householdId } },
    include: {
      _count: { select: { statements: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(accounts);
});

export const POST = withLogging(async function POST(request: Request) {
  const rateLimited = checkRateLimit(request, "accounts-create");
  if (rateLimited) return rateLimited;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const parsed = CreateAccountSchema.safeParse(body);
  if (!parsed.success) {
    return safeError("Invalid account data. Name and bank name are required.");
  }

  const account = await prisma.account.create({
    data: {
      name: sanitizeString(parsed.data.name, 200),
      bankName: sanitizeString(parsed.data.bankName, 200),
      type: parsed.data.type,
      userId: auth.user.id,
    },
  });

  auditLog("account.create", auth.user.id, {
    accountId: account.id,
    name: account.name,
  });

  return NextResponse.json(account, { status: 201 });
});
