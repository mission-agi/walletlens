import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import {
  getAuthenticatedUser,
  verifyUserAccess,
  checkRateLimit,
  auditLog,
  safeError,
} from "@/lib/security";
import { withLogging } from "@/lib/api-logger";

const SetActiveSchema = z.object({
  userId: z.string().min(1),
});

export const POST = withLogging(async function POST(request: Request) {
  // Rate limit: 20 switches per minute
  const rl = checkRateLimit(request, "set-active", 20);
  if (rl) return rl;

  const body = await request.json();
  const parsed = SetActiveSchema.safeParse(body);
  if (!parsed.success) {
    return safeError("Invalid request data");
  }

  const targetUserId = parsed.data.userId;

  // Verify target user exists
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, householdId: true },
  });
  if (!targetUser) {
    return safeError("User not found", 404);
  }

  // If there's an existing auth session, verify same household
  const auth = await getAuthenticatedUser();
  if (auth) {
    const sameHousehold = await verifyUserAccess(targetUserId, auth);
    if (!sameHousehold) {
      return safeError("Access denied", 403);
    }
    auditLog("user.switch", auth.user.id, { targetUserId });
  }

  const cookieStore = await cookies();
  cookieStore.set("activeUserId", targetUserId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });

  return NextResponse.json({ success: true });
});
