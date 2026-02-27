import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod/v4";
import {
  requireAuth,
  checkRateLimit,
  verifyTransactionAccess,
  sanitizeString,
  safeError,
  auditLog,
} from "@/lib/security";
import { withLogging } from "@/lib/api-logger";

const UpdateCategorySchema = z.object({
  category: z.string().min(1).max(200),
});

export const PATCH = withLogging(async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimited = checkRateLimit(request, "transaction-update");
  if (rateLimited) return rateLimited;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const hasAccess = await verifyTransactionAccess(id, auth);
  if (!hasAccess) {
    return safeError("Transaction not found", 404);
  }

  const body = await request.json();
  const parsed = UpdateCategorySchema.safeParse(body);
  if (!parsed.success) {
    return safeError("Invalid data. A valid category is required.");
  }

  const transaction = await prisma.transaction.update({
    where: { id },
    data: { category: sanitizeString(parsed.data.category, 200) },
  });

  auditLog("transaction.update", auth.user.id, {
    transactionId: id,
    category: parsed.data.category,
  });

  return NextResponse.json(transaction);
});

export const DELETE = withLogging(async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimited = checkRateLimit(request, "transaction-delete");
  if (rateLimited) return rateLimited;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const hasAccess = await verifyTransactionAccess(id, auth);
  if (!hasAccess) {
    return safeError("Transaction not found", 404);
  }

  await prisma.transaction.delete({ where: { id } });

  auditLog("transaction.delete", auth.user.id, { transactionId: id });

  return NextResponse.json({ success: true });
});
