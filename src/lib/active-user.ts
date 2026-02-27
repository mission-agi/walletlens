import { cookies } from "next/headers";
import { prisma } from "./db";

export async function getActiveUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookieUserId = cookieStore.get("activeUserId")?.value;
  if (cookieUserId) return cookieUserId;

  // Fallback: return first user's ID (consistent with getActiveUser behavior)
  const firstUser = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return firstUser?.id || null;
}

export async function getActiveUser() {
  const userId = await getActiveUserId();
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { household: true },
    });
    if (user) return user;
  }
  // Fallback: return first user or create default
  const firstUser = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
    include: { household: true },
  });
  return firstUser;
}

export async function getOrCreateActiveUser() {
  const user = await getActiveUser();
  if (user) return user;

  // No users exist — create default household + user
  const household = await prisma.household.create({
    data: { name: "My Household" },
  });
  const newUser = await prisma.user.create({
    data: { name: "Default", householdId: household.id },
    include: { household: true },
  });
  return newUser;
}
