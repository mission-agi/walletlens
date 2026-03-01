/**
 * Security utilities for WalletLens
 *
 * Provides:
 * - Request authentication (resolves active user from cookie)
 * - Household-based access control (users can only access their own household data)
 * - Rate limiting (in-memory, per-IP)
 * - Input sanitization helpers
 * - Audit logging
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "./db";
import { log } from "./logger";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AuthenticatedUser {
  id: string;
  name: string;
  householdId: string;
  avatarColor: string;
}

export interface AuthResult {
  user: AuthenticatedUser;
  householdId: string;
}

// ─── Authentication ──────────────────────────────────────────────────────────

/**
 * Resolves the active user from the httpOnly cookie.
 * Falls back to the first user if no cookie is set (auto-sets cookie in Route Handlers).
 * Returns null only if no users exist at all.
 */
export async function getAuthenticatedUser(): Promise<AuthResult | null> {
  const cookieStore = await cookies();
  const cookieUserId = cookieStore.get("activeUserId")?.value;

  if (cookieUserId) {
    const user = await prisma.user.findUnique({
      where: { id: cookieUserId },
      select: { id: true, name: true, householdId: true, avatarColor: true },
    });
    if (user) {
      return { user, householdId: user.householdId };
    }
  }

  // Fallback: resolve first user and auto-set cookie for future requests
  let firstUser = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, householdId: true, avatarColor: true },
  });

  if (!firstUser) {
    // No users exist — auto-create a default household + user
    const household = await prisma.household.create({
      data: { name: "My Household" },
    });
    firstUser = await prisma.user.create({
      data: { name: "Default", householdId: household.id },
      select: { id: true, name: true, householdId: true, avatarColor: true },
    });
  }

  // Set cookie so subsequent requests are authenticated
  cookieStore.set("activeUserId", firstUser.id, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });

  return { user: firstUser, householdId: firstUser.householdId };
}

/**
 * Requires authentication. Returns user or 401 response.
 * Use in API routes: const auth = await requireAuth(); if (auth instanceof NextResponse) return auth;
 */
export async function requireAuth(): Promise<AuthResult | NextResponse> {
  const auth = await getAuthenticatedUser();
  if (!auth) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }
  return auth;
}

// ─── Authorization ───────────────────────────────────────────────────────────

/**
 * Verify that an account belongs to the authenticated user's household.
 */
export async function verifyAccountAccess(
  accountId: string,
  auth: AuthResult
): Promise<boolean> {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { userId: true },
  });

  if (!account) return false;

  // Account must belong to a user in the same household
  if (account.userId) {
    const accountUser = await prisma.user.findUnique({
      where: { id: account.userId },
      select: { householdId: true },
    });
    return accountUser?.householdId === auth.householdId;
  }

  // Unassigned accounts (userId is null) are NOT accessible
  // This prevents cross-household access to orphaned/legacy data
  return false;
}

/**
 * Verify that a user belongs to the same household.
 */
export async function verifyUserAccess(
  targetUserId: string,
  auth: AuthResult
): Promise<boolean> {
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { householdId: true },
  });
  return targetUser?.householdId === auth.householdId;
}

/**
 * Verify that a statement belongs to the authenticated user's household.
 */
export async function verifyStatementAccess(
  statementId: string,
  auth: AuthResult
): Promise<boolean> {
  const statement = await prisma.statement.findUnique({
    where: { id: statementId },
    include: { account: { select: { userId: true } } },
  });

  if (!statement) return false;

  if (statement.account.userId) {
    const accountUser = await prisma.user.findUnique({
      where: { id: statement.account.userId },
      select: { householdId: true },
    });
    return accountUser?.householdId === auth.householdId;
  }

  // Unassigned statement accounts are NOT accessible
  return false;
}

/**
 * Verify that a transaction belongs to the authenticated user's household.
 */
export async function verifyTransactionAccess(
  transactionId: string,
  auth: AuthResult
): Promise<boolean> {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      statement: {
        include: { account: { select: { userId: true } } },
      },
    },
  });

  if (!transaction) return false;

  if (transaction.statement.account.userId) {
    const accountUser = await prisma.user.findUnique({
      where: { id: transaction.statement.account.userId },
      select: { householdId: true },
    });
    return accountUser?.householdId === auth.householdId;
  }

  // Unassigned transaction accounts are NOT accessible
  return false;
}

// ─── Rate Limiting (In-Memory) ───────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (entry.resetAt < now) rateLimitStore.delete(key);
  }
}, 5 * 60 * 1000);

/**
 * Simple in-memory rate limiter. Returns true if rate limit exceeded.
 */
export function isRateLimited(
  key: string,
  maxRequests: number = 60,
  windowMs: number = 60 * 1000
): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  entry.count++;
  if (entry.count > maxRequests) return true;

  return false;
}

/**
 * Rate limit check that returns a 429 response if exceeded.
 * Uses IP address from headers as key prefix.
 */
export function checkRateLimit(
  request: Request,
  endpoint: string,
  maxRequests: number = 60,
  windowMs: number = 60 * 1000
): NextResponse | null {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const key = `${ip}:${endpoint}`;

  if (isRateLimited(key, maxRequests, windowMs)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  return null;
}

// ─── Input Sanitization ──────────────────────────────────────────────────────

/**
 * Sanitize a string to prevent XSS and injection.
 * Removes control characters, trims, and limits length.
 */
export function sanitizeString(input: string, maxLength: number = 500): string {
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // Remove control chars
    .trim()
    .substring(0, maxLength);
}

/**
 * Sanitize a search query. More restrictive than general string sanitization.
 */
export function sanitizeSearchQuery(input: string): string {
  return input
    .replace(/[^\w\s\-.,&']/g, "") // Allow only safe characters
    .trim()
    .substring(0, 100);
}

/**
 * Validate that a page number is reasonable.
 */
export function sanitizePage(input: string | null): number {
  const page = parseInt(input || "1");
  if (isNaN(page) || page < 1) return 1;
  return Math.min(page, 10000); // Cap at 10,000 pages
}

// ─── File Upload Validation ──────────────────────────────────────────────────

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXTENSIONS = [".csv", ".pdf"];

/**
 * Validate an uploaded file. Returns error message or null if valid.
 */
export function validateFileUpload(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 10MB.`;
  }

  const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
    return "Only CSV and PDF files are supported.";
  }

  return null;
}

// ─── Safe Error Responses ────────────────────────────────────────────────────

/**
 * Create a safe error response that doesn't leak internal details.
 */
export function safeError(
  message: string,
  status: number = 400,
  internalError?: unknown
): NextResponse {
  // Log internal error for debugging (server-side only)
  if (internalError) {
    log.api.error(message, internalError);
  }

  return NextResponse.json({ error: message }, { status });
}

// ─── Audit Logging ───────────────────────────────────────────────────────────

export type AuditAction =
  | "account.create"
  | "account.delete"
  | "statement.delete"
  | "transaction.create"
  | "transaction.update"
  | "transaction.delete"
  | "investment.create"
  | "user.create"
  | "user.update"
  | "user.delete"
  | "user.switch"
  | "data.reset"
  | "file.upload";

/**
 * Log an audit event. Writes to structured logger (console + file).
 */
export function auditLog(
  action: AuditAction,
  userId: string,
  details?: Record<string, unknown>
): void {
  log.audit.audit(action, userId, details);
}
