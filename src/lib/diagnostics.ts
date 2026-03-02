"use client";

/**
 * Client-side diagnostic log collector for bug reports.
 *
 * Captures structured events in a human-readable format that clearly shows:
 * - What the user did (navigated, uploaded, saved)
 * - What the system did in response (parsed, rejected, failed)
 * - Any errors that occurred (API failures, crashes, network issues)
 *
 * Log format:
 *   [timestamp] ACTION  User uploaded file: report.csv (1.2 MB)
 *   [timestamp] OK      Parsed 142 transactions from report.csv
 *   [timestamp] WARN    3 rows skipped in report.csv (invalid_date, missing_amount)
 *   [timestamp] FAIL    Upload rejected: photo.jpg — Only CSV and PDF files are supported
 *   [timestamp] ERROR   Uncaught: TypeError: Cannot read property 'map' of undefined
 *
 * Usage:
 *   import { initDiagnostics, diag, getDiagnosticLogs } from "@/lib/diagnostics";
 *   initDiagnostics();                         // call once on app mount
 *   diag.uploadStart("invoice.csv", 24500);    // user action
 *   diag.parseResult("invoice.csv", 142, 3);   // system result
 *   const logs = getDiagnosticLogs();           // formatted string for bug report
 */

type DiagLevel = "ACTION" | "OK" | "WARN" | "FAIL" | "ERROR" | "INFO";

interface DiagEntry {
  timestamp: string;
  level: DiagLevel;
  message: string;
}

const MAX_ENTRIES = 300;
const MAX_REPORT_LINES = 120;

let entries: DiagEntry[] = [];
let initialized = false;
let lastPage = "";

function push(level: DiagLevel, message: string) {
  entries.push({
    timestamp: new Date().toISOString(),
    level,
    message: message.trim() || "(empty)",
  });
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }
}

function formatValue(value: unknown): string {
  if (value instanceof Error) {
    return `${value.name}: ${value.message}`;
  }
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

// ── Console monkey-patch (errors/warnings only) ───────

function patchConsole() {
  // Only capture warn and error from console — debug/info is noise
  const levels: Array<{ method: "warn" | "error"; diagLevel: DiagLevel }> = [
    { method: "warn", diagLevel: "WARN" },
    { method: "error", diagLevel: "ERROR" },
  ];

  for (const { method, diagLevel } of levels) {
    const original = (console[method] as (...args: unknown[]) => void).bind(console);
    (console[method] as (...args: unknown[]) => void) = (...args: unknown[]) => {
      try {
        const message = args.map(formatValue).join(" ");
        // Skip noisy framework messages
        if (!message.includes("hydrat") && !message.includes("DevTools")) {
          push(diagLevel, message);
        }
      } catch {
        // never break the app
      }
      original(...args);
    };
  }
}

// ── Global error handlers ─────────────────────────────

function patchGlobalErrors() {
  window.addEventListener("error", (event) => {
    const msg = event.error instanceof Error
      ? `${event.error.name}: ${event.error.message}`
      : event.message || "Unknown error";
    const loc = event.filename
      ? ` at ${event.filename.split("/").pop()}:${event.lineno}`
      : "";
    push("ERROR", `Uncaught: ${msg}${loc}`);
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason instanceof Error
      ? `${event.reason.name}: ${event.reason.message}`
      : formatValue(event.reason);
    push("ERROR", `Unhandled promise rejection: ${reason}`);
  });
}

// ── Fetch interceptor ─────────────────────────────────

function patchFetch() {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const req = new Request(...args);
    const url = req.url;
    const method = req.method;

    // Only intercept app API calls
    if (!url.includes("/api/")) {
      return originalFetch(...args);
    }

    const path = url.replace(/^https?:\/\/[^/]+/, "");

    try {
      const res = await originalFetch(...args);

      if (!res.ok) {
        const clone = res.clone();
        try {
          const body = await clone.json();
          const errMsg = body.error || JSON.stringify(body);
          push("FAIL", `API ${method} ${path} returned ${res.status}: ${errMsg}`);
        } catch {
          push("FAIL", `API ${method} ${path} returned ${res.status}`);
        }
      }

      return res;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      push("ERROR", `Network error on ${method} ${path}: ${msg}`);
      throw err;
    }
  };
}

// ── Click tracking ───────────────────────────────────

function trackClicks() {
  document.addEventListener("click", (event) => {
    try {
      const target = event.target as HTMLElement;
      if (!target) return;

      // Walk up to find the nearest meaningful interactive element
      const el = target.closest("button, a, [role='button'], [role='tab'], [role='menuitem'], input, select, label, [data-diag]") as HTMLElement | null;
      const src = el || target;

      const tag = src.tagName.toLowerCase();
      // Skip clicks on the document body or generic wrappers
      if (tag === "body" || tag === "html" || tag === "main") return;

      // Build a human-readable label
      const label = getClickLabel(src);
      if (!label) return;

      push("ACTION", `User clicked ${label}`);
    } catch {
      // never break the app
    }
  }, { capture: true });
}

function getClickLabel(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();

  // Custom diagnostic label (highest priority)
  const diagLabel = el.getAttribute("data-diag");
  if (diagLabel) return diagLabel;

  // Get visible text (truncated)
  const text = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 50);

  // Buttons
  if (tag === "button" || el.getAttribute("role") === "button") {
    const ariaLabel = el.getAttribute("aria-label");
    return `button: "${ariaLabel || text || "(icon)"}"`;
  }

  // Links
  if (tag === "a") {
    const href = el.getAttribute("href") || "";
    const linkText = text || href;
    return `link: "${linkText.slice(0, 60)}"`;
  }

  // Tabs
  if (el.getAttribute("role") === "tab") {
    return `tab: "${text}"`;
  }

  // Form inputs
  if (tag === "input") {
    const type = (el as HTMLInputElement).type || "text";
    const name = el.getAttribute("name") || el.getAttribute("aria-label") || "";
    if (type === "file") return `file input: "${name}"`;
    if (type === "checkbox") return `checkbox: "${name || text}"`;
    if (type === "radio") return `radio: "${name || text}"`;
    return `input[${type}]: "${name}"`;
  }

  // Select dropdowns
  if (tag === "select") {
    const name = el.getAttribute("name") || el.getAttribute("aria-label") || "";
    return `dropdown: "${name}"`;
  }

  // Labels
  if (tag === "label") {
    return `label: "${text.slice(0, 40)}"`;
  }

  // Menu items
  if (el.getAttribute("role") === "menuitem") {
    return `menu item: "${text}"`;
  }

  // Fallback: tag + text
  if (text) return `${tag}: "${text.slice(0, 40)}"`;
  return "";
}

// ── Page navigation tracking ──────────────────────────

function trackNavigation() {
  lastPage = window.location.pathname;
  push("ACTION", `User opened page: ${lastPage}`);

  // Track SPA navigation via popstate + MutationObserver on URL changes
  const checkNav = () => {
    const current = window.location.pathname;
    if (current !== lastPage) {
      lastPage = current;
      push("ACTION", `User navigated to: ${current}`);
    }
  };

  window.addEventListener("popstate", checkNav);

  // Poll for Next.js client-side navigation (pushState doesn't fire popstate)
  setInterval(checkNav, 1000);
}

// ── Structured app event helpers ──────────────────────

export const diag = {
  /** User selected file(s) for upload */
  uploadStart(filename: string, sizeBytes: number) {
    const size = sizeBytes < 1024 * 1024
      ? `${(sizeBytes / 1024).toFixed(0)} KB`
      : `${(sizeBytes / 1024 / 1024).toFixed(2)} MB`;
    push("ACTION", `User uploaded file: ${filename} (${size})`);
  },

  /** Upload API responded */
  uploadResult(filename: string, ok: boolean, error?: string) {
    if (ok) {
      push("OK", `Server accepted: ${filename}`);
    } else {
      push("FAIL", `Upload rejected: ${filename} — ${error || "Unknown error"}`);
    }
  },

  /** Parse results from the upload API */
  parseResult(filename: string, parsed: number, failed: number, failedReasons?: string[]) {
    if (failed === 0) {
      push("OK", `Parsed ${parsed} transactions from ${filename}`);
    } else {
      const reasons = failedReasons?.length
        ? ` (${failedReasons.join(", ")})`
        : "";
      push("WARN", `${failed} rows skipped in ${filename}${reasons}, ${parsed} parsed OK`);
    }
  },

  /** Save results */
  saveResult(filename: string, ok: boolean, txCount?: number, error?: string) {
    if (ok) {
      push("OK", `Saved ${txCount ?? 0} transactions from ${filename}`);
    } else {
      push("FAIL", `Save failed: ${filename} — ${error || "Unknown error"}`);
    }
  },

  /** Duplicate file detected (409) */
  duplicateFile(filename: string) {
    push("WARN", `Duplicate file: ${filename} was already uploaded to this account`);
  },

  /** File type not supported */
  fileRejected(filename: string, reason: string) {
    push("FAIL", `File rejected: ${filename} — ${reason}`);
  },

  /** User action on a transaction (edit category, delete, etc.) */
  transactionAction(action: string, detail?: string) {
    push("ACTION", `User ${action}${detail ? `: ${detail}` : ""}`);
  },

  /** Account action */
  accountAction(action: string, detail?: string) {
    push("ACTION", `User ${action}${detail ? `: ${detail}` : ""}`);
  },

  /** Generic info event */
  info(message: string) {
    push("INFO", message);
  },
};

// ── Public API ────────────────────────────────────────

/** Initialize diagnostics. Call once on app mount. */
export function initDiagnostics() {
  if (typeof window === "undefined" || initialized) return;
  initialized = true;
  patchConsole();
  patchGlobalErrors();
  patchFetch();
  trackNavigation();
  trackClicks();
}

/**
 * Get formatted diagnostic logs for inclusion in a bug report.
 *
 * Output example:
 *   [2026-03-01T09:15:00Z] ACTION  User opened page: /upload
 *   [2026-03-01T09:15:05Z] ACTION  User uploaded file: statement.csv (45 KB)
 *   [2026-03-01T09:15:06Z] OK      Server accepted: statement.csv
 *   [2026-03-01T09:15:06Z] OK      Parsed 87 transactions from statement.csv
 *   [2026-03-01T09:15:10Z] ACTION  User uploaded file: photo.jpg (2.1 MB)
 *   [2026-03-01T09:15:10Z] FAIL    File rejected: photo.jpg — Only CSV and PDF files are supported
 */
export function getDiagnosticLogs(): string {
  const recent = entries.slice(-MAX_REPORT_LINES);
  return recent
    .map((e) => `[${e.timestamp}] ${e.level.padEnd(6)} ${e.message}`)
    .join("\n");
}
