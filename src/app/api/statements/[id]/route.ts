import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requireAuth,
  checkRateLimit,
  verifyStatementAccess,
  safeError,
  auditLog,
} from "@/lib/security";
import { withLogging } from "@/lib/api-logger";

export const GET = withLogging(async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimited = checkRateLimit(request, "statement-detail");
  if (rateLimited) return rateLimited;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const hasAccess = await verifyStatementAccess(id, auth);
  if (!hasAccess) {
    return safeError("Statement not found", 404);
  }

  const statement = await prisma.statement.findUnique({
    where: { id },
    include: {
      account: true,
      _count: { select: { transactions: true } },
    },
  });

  if (!statement) {
    return safeError("Statement not found", 404);
  }

  return NextResponse.json(statement);
});

export const DELETE = withLogging(async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimited = checkRateLimit(request, "statement-delete");
  if (rateLimited) return rateLimited;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const hasAccess = await verifyStatementAccess(id, auth);
  if (!hasAccess) {
    return safeError("Statement not found", 404);
  }

  await prisma.statement.delete({ where: { id } });

  auditLog("statement.delete", auth.user.id, { statementId: id });

  return NextResponse.json({ success: true });
});
