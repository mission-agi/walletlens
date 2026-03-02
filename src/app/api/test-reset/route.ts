import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST() {
  // Only allow when ALLOW_TEST_RESET env var is explicitly set
  if (!process.env.ALLOW_TEST_RESET) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  try {
    // Clear all data in dependency order
    await prisma.investmentTransaction.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.holding.deleteMany();
    await prisma.statement.deleteMany();
    await prisma.account.deleteMany();
    await prisma.user.deleteMany();
    await prisma.household.deleteMany();
    await prisma.category.deleteMany();

    // Seed categories
    await prisma.category.createMany({
      data: [
        { name: "Groceries", keywords: JSON.stringify(["market", "grocery", "costco"]), color: "#22c55e", icon: "ShoppingCart" },
        { name: "Dining", keywords: JSON.stringify(["coffee", "restaurant"]), color: "#f97316", icon: "UtensilsCrossed" },
        { name: "Uncategorized", keywords: JSON.stringify([]), color: "#9ca3af", icon: "HelpCircle" },
        { name: "Interest & Fees", keywords: JSON.stringify(["interest", "fee", "charge"]), color: "#ef4444", icon: "AlertTriangle" },
        { name: "Credit Card Payment", keywords: JSON.stringify(["payment", "thank you"]), color: "#6366f1", icon: "CreditCard" },
      ],
    });

    // Seed households
    const householdA = await prisma.household.create({ data: { name: "Household A" } });
    const householdB = await prisma.household.create({ data: { name: "Household B" } });

    // Seed users
    const userA = await prisma.user.create({
      data: { name: "Alice", avatarColor: "#3b82f6", householdId: householdA.id },
    });
    const userB = await prisma.user.create({
      data: { name: "Bob", avatarColor: "#ef4444", householdId: householdB.id },
    });

    // Seed accounts
    const accountA = await prisma.account.create({
      data: { name: "Alice Checking", bankName: "Test Bank A", type: "checking", userId: userA.id },
    });
    const accountB = await prisma.account.create({
      data: { name: "Bob Checking", bankName: "Test Bank B", type: "checking", userId: userB.id },
    });

    return NextResponse.json({
      success: true,
      userAId: userA.id,
      userBId: userB.id,
      householdAId: householdA.id,
      householdBId: householdB.id,
      accountAId: accountA.id,
      accountBId: accountB.id,
    });
  } catch (error) {
    console.error("test-reset error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
