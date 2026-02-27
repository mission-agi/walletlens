import { prisma } from "@/lib/db";

export async function getUsers() {
  return prisma.user.findMany({
    include: {
      household: true,
      _count: { select: { accounts: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: { household: true },
  });
}

export async function getOrCreateDefaultHousehold() {
  let household = await prisma.household.findFirst();
  if (!household) {
    household = await prisma.household.create({
      data: { name: "My Household" },
    });
  }
  return household;
}

export async function getOrCreateDefaultUser() {
  let user = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
    include: { household: true },
  });
  if (!user) {
    const household = await getOrCreateDefaultHousehold();
    user = await prisma.user.create({
      data: { name: "Default", householdId: household.id },
      include: { household: true },
    });
  }
  return user;
}

export async function getHouseholdWithUsers(householdId: string) {
  return prisma.household.findUnique({
    where: { id: householdId },
    include: {
      users: {
        include: {
          _count: { select: { accounts: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}
