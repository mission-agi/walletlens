import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/security";
import { withLogging } from "@/lib/api-logger";

export const GET = withLogging(async function GET(request: Request) {
  const rateLimited = checkRateLimit(request, "categories-list");
  if (rateLimited) return rateLimited;

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json(categories);
});
