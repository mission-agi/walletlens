/**
 * Structured Logger for WalletLens
 *
 * Features:
 * - Log levels: debug, info, warn, error
 * - JSON-structured output for machine parsing
 * - File logging with daily rotation (logs/ directory)
 * - Console output with color coding in development
 * - Request context (method, path, duration, status)
 * - Audit trail persistence
 * - Error stack trace capture
 */

import { writeFileSync, appendFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import path from "node:path";

// ─── Types ───────────────────────────────────────────────────────────────────

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  request?: {
    method: string;
    path: string;
    status?: number;
    durationMs?: number;
    ip?: string;
    userId?: string;
  };
}

// ─── Configuration ──────────────────────────────────────────────────────────

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const isDev = process.env.NODE_ENV !== "production";
const MIN_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || (isDev ? "debug" : "info");
const LOG_DIR = path.join(process.cwd(), "logs");
const MAX_LOG_FILES = 30; // Keep 30 days of logs

// ─── Console Colors ─────────────────────────────────────────────────────────

const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  magenta: "\x1b[35m",
} as const;

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: COLORS.dim,
  info: COLORS.blue,
  warn: COLORS.yellow,
  error: COLORS.red,
};

const LEVEL_LABELS: Record<LogLevel, string> = {
  debug: "DEBUG",
  info: " INFO",
  warn: " WARN",
  error: "ERROR",
};

// ─── File Management ────────────────────────────────────────────────────────

function getLogFilePath(date: Date = new Date()): string {
  const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD
  return path.join(LOG_DIR, `walletlens-${dateStr}.log`);
}

function ensureLogDir(): void {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

function rotateOldLogs(): void {
  try {
    if (!existsSync(LOG_DIR)) return;

    const files = readdirSync(LOG_DIR)
      .filter((f) => f.startsWith("walletlens-") && f.endsWith(".log"))
      .sort();

    while (files.length > MAX_LOG_FILES) {
      const oldest = files.shift()!;
      unlinkSync(path.join(LOG_DIR, oldest));
    }
  } catch {
    // Silently ignore rotation errors
  }
}

// Run rotation on startup
let rotationDone = false;

// ─── Core Logger ────────────────────────────────────────────────────────────

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL];
}

function formatConsole(entry: LogEntry): string {
  const time = entry.timestamp.split("T")[1]?.replace("Z", "") || entry.timestamp;
  const levelColor = LEVEL_COLORS[entry.level];
  const label = LEVEL_LABELS[entry.level];

  let line = `${COLORS.dim}${time}${COLORS.reset} ${levelColor}${label}${COLORS.reset} ${COLORS.cyan}[${entry.category}]${COLORS.reset} ${entry.message}`;

  if (entry.request) {
    const { method, path: reqPath, status, durationMs } = entry.request;
    const statusColor = status && status >= 400 ? COLORS.red : COLORS.green;
    line += ` ${COLORS.magenta}${method} ${reqPath}${COLORS.reset}`;
    if (status) line += ` ${statusColor}${status}${COLORS.reset}`;
    if (durationMs !== undefined) line += ` ${COLORS.dim}${durationMs}ms${COLORS.reset}`;
  }

  if (entry.data && Object.keys(entry.data).length > 0) {
    line += ` ${COLORS.dim}${JSON.stringify(entry.data)}${COLORS.reset}`;
  }

  if (entry.error) {
    line += `\n${COLORS.red}  ${entry.error.name}: ${entry.error.message}${COLORS.reset}`;
    if (entry.error.stack) {
      const stackLines = entry.error.stack.split("\n").slice(1, 6);
      line += `\n${COLORS.dim}${stackLines.join("\n")}${COLORS.reset}`;
    }
  }

  return line;
}

function writeLog(entry: LogEntry): void {
  // Console output
  if (isDev) {
    console.log(formatConsole(entry));
  } else {
    // In production, structured JSON to stdout
    console.log(JSON.stringify(entry));
  }

  // File output (always JSON, one line per entry)
  try {
    if (!rotationDone) {
      ensureLogDir();
      rotateOldLogs();
      rotationDone = true;
    }

    const filePath = getLogFilePath();
    appendFileSync(filePath, JSON.stringify(entry) + "\n");
  } catch {
    // Don't crash the app if file logging fails
  }
}

function createEntry(
  level: LogLevel,
  category: string,
  message: string,
  data?: Record<string, unknown>,
  error?: unknown
): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
  };

  if (data && Object.keys(data).length > 0) {
    entry.data = data;
  }

  if (error) {
    if (error instanceof Error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    } else {
      entry.error = {
        name: "UnknownError",
        message: String(error),
      };
    }
  }

  return entry;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Create a scoped logger for a specific category (e.g., "api", "auth", "db").
 */
export function createLogger(category: string) {
  return {
    debug(message: string, data?: Record<string, unknown>) {
      if (shouldLog("debug")) writeLog(createEntry("debug", category, message, data));
    },

    info(message: string, data?: Record<string, unknown>) {
      if (shouldLog("info")) writeLog(createEntry("info", category, message, data));
    },

    warn(message: string, data?: Record<string, unknown>, error?: unknown) {
      if (shouldLog("warn")) writeLog(createEntry("warn", category, message, data, error));
    },

    error(message: string, error?: unknown, data?: Record<string, unknown>) {
      if (shouldLog("error")) writeLog(createEntry("error", category, message, data, error));
    },

    /**
     * Log an API request with method, path, status, and duration.
     */
    request(opts: {
      method: string;
      path: string;
      status: number;
      durationMs: number;
      ip?: string;
      userId?: string;
      data?: Record<string, unknown>;
    }) {
      if (!shouldLog("info")) return;

      const level: LogLevel = opts.status >= 500 ? "error" : opts.status >= 400 ? "warn" : "info";
      const entry = createEntry(level, category, `${opts.method} ${opts.path}`, opts.data);
      entry.request = {
        method: opts.method,
        path: opts.path,
        status: opts.status,
        durationMs: opts.durationMs,
        ip: opts.ip,
        userId: opts.userId,
      };
      writeLog(entry);
    },

    /**
     * Log an audit event (mutation tracking).
     */
    audit(action: string, userId: string, details?: Record<string, unknown>) {
      if (!shouldLog("info")) return;

      const entry = createEntry("info", "audit", action, {
        userId,
        ...details,
      });
      writeLog(entry);
    },
  };
}

// ─── Pre-built Loggers ──────────────────────────────────────────────────────

export const log = {
  api: createLogger("api"),
  auth: createLogger("auth"),
  db: createLogger("db"),
  upload: createLogger("upload"),
  audit: createLogger("audit"),
  app: createLogger("app"),
};
