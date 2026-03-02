import { prisma } from "@/lib/db";
import { roundCents } from "@/lib/utils";

export async function recomputeHoldings(accountId: string) {
  // Get all investment transactions for this account
  const transactions = await prisma.investmentTransaction.findMany({
    where: { statement: { accountId } },
    orderBy: { date: "asc" },
  });

  // Group by symbol
  const bySymbol = new Map<string, {
    shares: number;
    totalCost: number;
    lastPrice: number;
    description: string;
  }>();

  for (const tx of transactions) {
    const current = bySymbol.get(tx.symbol) || {
      shares: 0,
      totalCost: 0,
      lastPrice: 0,
      description: tx.description,
    };

    if (tx.action === "buy" || tx.action === "contribution") {
      current.shares += tx.shares;
      current.totalCost += tx.amount;
    } else if (tx.action === "sell" || tx.action === "distribution") {
      current.shares -= tx.shares;
      // Reduce cost basis proportionally
      if (current.shares > 0 && (current.shares + tx.shares) > 0) {
        const ratio = current.shares / (current.shares + tx.shares);
        current.totalCost *= ratio;
      } else {
        current.totalCost = 0;
      }
    }
    // Dividend reinvestments — add shares and cost
    if (tx.action === "dividend" && tx.shares > 0) {
      current.shares += tx.shares;
      current.totalCost += tx.amount;
    }
    // Interest earned — treat as income (adds to value but not shares for non-CASH symbols)
    if (tx.action === "interest" && tx.amount > 0) {
      // For cash/money market positions, interest adds shares at $1
      if (tx.symbol === "CASH" || tx.symbol === "SPAXX" || tx.symbol === "FDRXX" || tx.symbol === "VMFXX") {
        current.shares += tx.amount; // $1/share for money market
        current.totalCost += tx.amount;
      }
    }
    // Fees reduce cost basis
    if (tx.action === "fee" && tx.amount > 0) {
      current.totalCost += tx.amount; // fee increases cost basis (reduces gains)
    }

    if (tx.pricePerShare > 0) {
      current.lastPrice = tx.pricePerShare;
    }

    current.description = tx.description;
    bySymbol.set(tx.symbol, current);
  }

  // Build new holdings list
  const holdings: {
    accountId: string;
    symbol: string;
    name: string;
    shares: number;
    costBasis: number;
    currentPrice: number;
    currentValue: number;
  }[] = [];
  for (const [symbol, data] of bySymbol) {
    if (data.shares <= 0.0001) continue; // Skip sold-out positions

    const currentValue = roundCents(data.shares * data.lastPrice);
    holdings.push({
      accountId,
      symbol,
      name: data.description,
      shares: roundCents(data.shares),
      costBasis: roundCents(data.totalCost),
      currentPrice: roundCents(data.lastPrice),
      currentValue,
    });
  }

  // Atomically delete + recreate holdings in a single transaction
  await prisma.$transaction(async (tx) => {
    await tx.holding.deleteMany({ where: { accountId } });
    if (holdings.length > 0) {
      await tx.holding.createMany({ data: holdings });
    }
  });

  return holdings;
}

export async function getPortfolioSummary(userId?: string) {
  const where = userId ? { account: { userId } } : {};

  const holdings = await prisma.holding.findMany({
    where,
    include: { account: { select: { name: true, bankName: true, type: true } } },
  });

  const totalValue = roundCents(holdings.reduce((s, h) => s + h.currentValue, 0));
  const totalCostBasis = roundCents(holdings.reduce((s, h) => s + h.costBasis, 0));
  const totalGainLoss = roundCents(totalValue - totalCostBasis);
  const totalGainLossPercent = totalCostBasis > 0 ? roundCents((totalGainLoss / totalCostBasis) * 100) : 0;

  return {
    holdings,
    totalValue,
    totalCostBasis,
    totalGainLoss,
    totalGainLossPercent,
    holdingCount: holdings.length,
  };
}

export async function getAllHoldings(userId?: string) {
  const where = userId ? { account: { userId } } : {};
  return prisma.holding.findMany({
    where,
    include: { account: { select: { name: true, bankName: true } } },
    orderBy: { currentValue: "desc" },
  });
}

export async function getHoldingsForAccount(accountId: string) {
  return prisma.holding.findMany({
    where: { accountId },
    orderBy: { currentValue: "desc" },
  });
}

export async function getInvestmentTransactions(params: {
  accountId?: string;
  symbol?: string;
  userId?: string;
  page?: number;
}) {
  const { accountId, symbol, userId, page = 1 } = params;
  const limit = 20;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (symbol) where.symbol = symbol;
  if (accountId) where.statement = { accountId };
  else if (userId) where.statement = { account: { userId } };

  const [transactions, total] = await Promise.all([
    prisma.investmentTransaction.findMany({
      where,
      include: {
        statement: {
          include: { account: { select: { name: true } } },
        },
      },
      orderBy: { date: "desc" },
      skip,
      take: limit,
    }),
    prisma.investmentTransaction.count({ where }),
  ]);

  return { transactions, total, page, totalPages: Math.ceil(total / limit) };
}

export async function getPortfolioPerformanceTimeline(userId?: string) {
  const where = userId
    ? { statement: { account: { userId } } }
    : {};

  const transactions = await prisma.investmentTransaction.findMany({
    where,
    orderBy: { date: "asc" },
  });

  if (transactions.length === 0) return [];

  // Walk through transactions chronologically, tracking portfolio state
  const bySymbol = new Map<string, { shares: number; totalCost: number; lastPrice: number }>();
  const timeline: { date: string; value: number; costBasis: number }[] = [];
  let lastMonth = "";

  for (const tx of transactions) {
    const current = bySymbol.get(tx.symbol) || { shares: 0, totalCost: 0, lastPrice: 0 };

    if (tx.action === "buy" || tx.action === "contribution") {
      current.shares += tx.shares;
      current.totalCost += tx.amount;
    } else if (tx.action === "sell" || tx.action === "distribution") {
      const sharesAfterSale = current.shares - tx.shares;
      if (current.shares > 0 && sharesAfterSale > 0) {
        const ratio = sharesAfterSale / current.shares;
        current.totalCost *= ratio;
      } else {
        current.totalCost = 0;
      }
      current.shares = sharesAfterSale;
    }
    if (tx.action === "dividend" && tx.shares > 0) {
      current.shares += tx.shares;
      current.totalCost += tx.amount;
    }
    if (tx.action === "interest" && tx.amount > 0) {
      if (tx.symbol === "CASH" || tx.symbol === "SPAXX" || tx.symbol === "FDRXX" || tx.symbol === "VMFXX") {
        current.shares += tx.amount;
        current.totalCost += tx.amount;
      }
    }
    if (tx.action === "fee" && tx.amount > 0) {
      current.totalCost += tx.amount;
    }
    if (tx.pricePerShare > 0) {
      current.lastPrice = tx.pricePerShare;
    }

    bySymbol.set(tx.symbol, current);

    // Record monthly snapshots
    const monthKey = tx.date.toISOString().substring(0, 7);
    if (monthKey !== lastMonth) {
      // Compute portfolio value at this point
      let totalValue = 0;
      let totalCost = 0;
      for (const data of bySymbol.values()) {
        if (data.shares > 0.0001) {
          totalValue += data.shares * data.lastPrice;
          totalCost += data.totalCost;
        }
      }

      timeline.push({
        date: `${monthKey}-01`,
        value: totalValue,
        costBasis: totalCost,
      });
      lastMonth = monthKey;
    }
  }

  // Always add current state as final point
  let totalValue = 0;
  let totalCost = 0;
  for (const data of bySymbol.values()) {
    if (data.shares > 0.0001) {
      totalValue += data.shares * data.lastPrice;
      totalCost += data.totalCost;
    }
  }
  const lastPoint = timeline[timeline.length - 1];
  if (!lastPoint || lastPoint.value !== totalValue) {
    timeline.push({
      date: new Date().toISOString().substring(0, 10),
      value: totalValue,
      costBasis: totalCost,
    });
  }

  return timeline;
}

export async function getInvestmentAccounts(userId?: string) {
  return prisma.account.findMany({
    where: {
      type: { in: ["brokerage", "retirement_401k", "ira"] },
      ...(userId ? { userId } : {}),
    },
    include: {
      _count: { select: { holdings: true, statements: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}
