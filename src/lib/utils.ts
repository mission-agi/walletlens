/**
 * Round a number to 2 decimal places (cents).
 * Prevents IEEE 754 floating-point drift in financial calculations.
 * Example: roundCents(0.1 + 0.2) === 0.3
 */
export function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Math.abs(amount));
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatMonth(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function getMonthRange(year: number, month: number) {
  // Use UTC to avoid timezone-dependent date boundaries.
  // Transaction dates are stored as midnight UTC (e.g., "2026-02-01" → 2026-02-01T00:00:00Z).
  // Without UTC, the range boundaries shift by the server's timezone offset,
  // causing transactions on the 1st of the month to fall outside the range.
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start, end };
}

export function getCategoryColor(category: string, categories: { name: string; color: string }[]): string {
  return categories.find((c) => c.name === category)?.color || "#9ca3af";
}
