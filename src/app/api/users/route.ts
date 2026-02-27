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

const CreateUserSchema = z.object({
  name: z.string().min(1).max(100),
  avatarColor: z.string().max(20).optional(),
});

export const GET = withLogging(async function GET(request: Request) {
  const rateLimited = checkRateLimit(request, "users-list");
  if (rateLimited) return rateLimited;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const users = await prisma.user.findMany({
    where: { householdId: auth.householdId },
    include: {
      household: true,
      _count: { select: { accounts: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(users);
});

export const POST = withLogging(async function POST(request: Request) {
  const rateLimited = checkRateLimit(request, "users-create");
  if (rateLimited) return rateLimited;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const parsed = CreateUserSchema.safeParse(body);
  if (!parsed.success) {
    return safeError("Invalid data. A name is required.");
  }

  const user = await prisma.user.create({
    data: {
      name: sanitizeString(parsed.data.name, 100),
      avatarColor: parsed.data.avatarColor || "#3b82f6",
      householdId: auth.householdId,
    },
    include: { household: true },
  });

  auditLog("user.create", auth.user.id, {
    createdUserId: user.id,
    name: user.name,
  });

  return NextResponse.json(user, { status: 201 });
});
