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

export async function getAccountById(id: string, householdId?: string) {
  const account = await prisma.account.findUnique({
    where: { id },
    include: {
      user: householdId ? { select: { householdId: true } } : false,
      statements: {
        include: {
          _count: { select: { transactions: true, investmentTransactions: true } },
        },
        orderBy: { uploadDate: "desc" },
      },
    },
  });

  // If householdId is provided, verify the account belongs to that household
  if (account && householdId) {
    const accountUser = account.user as { householdId: string } | null;
    if (!accountUser || accountUser.householdId !== householdId) {
      return null; // Access denied — account belongs to different household
    }
  }

  return account;
}
