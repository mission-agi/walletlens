import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod/v4";
import {
  requireAuth,
  checkRateLimit,
  verifyUserAccess,
  sanitizeString,
  safeError,
  auditLog,
} from "@/lib/security";
import { withLogging } from "@/lib/api-logger";

const UpdateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  avatarColor: z.string().max(20).optional(),
});

export const PATCH = withLogging(async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimited = checkRateLimit(request, "user-update");
  if (rateLimited) return rateLimited;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const hasAccess = await verifyUserAccess(id, auth);
  if (!hasAccess) {
    return safeError("User not found", 404);
  }

  const body = await request.json();
  const parsed = UpdateUserSchema.safeParse(body);
  if (!parsed.success) {
    return safeError("Invalid data.");
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name) updateData.name = sanitizeString(parsed.data.name, 100);
  if (parsed.data.avatarColor) updateData.avatarColor = parsed.data.avatarColor;

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    include: { household: true },
  });

  auditLog("user.update", auth.user.id, {
    updatedUserId: id,
  });

  return NextResponse.json(user);
});

export const DELETE = withLogging(async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimited = checkRateLimit(request, "user-delete");
  if (rateLimited) return rateLimited;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const hasAccess = await verifyUserAccess(id, auth);
  if (!hasAccess) {
    return safeError("User not found", 404);
  }

  // Don't allow deleting the last user in the household
  const count = await prisma.user.count({
    where: { householdId: auth.householdId },
  });
  if (count <= 1) {
    return safeError("Cannot delete the last user in the household.");
  }

  await prisma.user.delete({ where: { id } });

  auditLog("user.delete", auth.user.id, { deletedUserId: id });

  return NextResponse.json({ success: true });
});
