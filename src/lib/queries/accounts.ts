import { prisma } from "@/lib/db";

export async function getAccounts(userId?: string) {
  return prisma.account.findMany({
    where: userId ? { userId } : undefined,
    include: {
      _count: { select: { statements: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAccountById(id: string) {
  return prisma.account.findUnique({
    where: { id },
    include: {
      statements: {
        include: {
          _count: { select: { transactions: true, investmentTransactions: true } },
        },
        orderBy: { uploadDate: "desc" },
      },
    },
  });
}
