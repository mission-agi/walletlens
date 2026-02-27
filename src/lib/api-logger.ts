/**
 * API Request Logger
 *
 * Wraps API route handlers to automatically log:
 * - Request method, path, IP
 * - Response status and duration
 * - Errors with stack traces
 *
 * Usage:
 *   export const GET = withLogging(async (request) => { ... });
 *   export const POST = withLogging(async (request) => { ... });
 */

import { NextResponse } from "next/server";
import { log } from "./logger";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteHandler = (request: Request, context?: any) => Promise<Response | NextResponse>;

/**
 * Wrap an API route handler with automatic request/response logging.
 */
export function withLogging<T extends RouteHandler>(handler: T): T {
  const wrapped = async (request: Request, context?: unknown) => {
    const start = Date.now();
    const url = new URL(request.url);
    const method = request.method;
    const pathname = url.pathname;
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    log.api.debug(`→ ${method} ${pathname}`, {
      query: Object.fromEntries(url.searchParams),
      ip,
    });

    try {
      const response = await handler(request, context);
      const durationMs = Date.now() - start;
      const status = response.status;

      log.api.request({
        method,
        path: pathname,
        status,
        durationMs,
        ip,
      });

      return response;
    } catch (error) {
      const durationMs = Date.now() - start;

      log.api.error(`Unhandled error in ${method} ${pathname}`, error, {
        durationMs,
        ip,
      });

      log.api.request({
        method,
        path: pathname,
        status: 500,
        durationMs,
        ip,
      });

      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };
  return wrapped as T;
}
