"use client";

import { useEffect, useState } from "react";
import html2canvas from "html2canvas";
import Image from "next/image";
import { AlertTriangle, Bug, Camera, CheckCircle, Loader2, Send, Terminal } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

type ConsoleLevel = "log" | "info" | "warn" | "error";

interface ConsoleEntry {
  timestamp: string;
  level: ConsoleLevel;
  message: string;
}

interface ScreenshotCapture {
  dataUrl: string;
  capturedAt: string;
}

const MAX_BUFFERED_LOGS = 200;
const MAX_INCLUDED_LOG_LINES = 80;
const FEEDBACK_REPO = process.env.NEXT_PUBLIC_GITHUB_FEEDBACK_REPO ?? "";

declare global {
  interface Window {
    __walletlensFeedbackConsolePatched?: boolean;
    __walletlensFeedbackConsoleEntries?: ConsoleEntry[];
    __walletlensFeedbackMockScreenshotDataUrl?: string;
  }
}

function formatConsoleValue(value: unknown): string {
  if (value instanceof Error) {
    return `${value.name}: ${value.message}\n${value.stack ?? ""}`.trim();
  }

  if (typeof value === "string") {
    return value;
  }

  if (
    value &&
    typeof value === "object" &&
    "target" in value &&
    (value as { target?: { tagName?: string } }).target?.tagName
  ) {
    const target = (value as { target: { tagName: string } }).target;
    return `[Event target=${target.tagName}]`;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function ensureConsoleBuffer(): ConsoleEntry[] {
  if (!window.__walletlensFeedbackConsoleEntries) {
    window.__walletlensFeedbackConsoleEntries = [];
  }

  if (!window.__walletlensFeedbackConsolePatched) {
    window.__walletlensFeedbackConsolePatched = true;
    const levels: ConsoleLevel[] = ["log", "info", "warn", "error"];

    for (const level of levels) {
      const original = (console[level] as (...args: unknown[]) => void).bind(console);

      (console[level] as (...args: unknown[]) => void) = (...args: unknown[]) => {
        try {
          const buffer = window.__walletlensFeedbackConsoleEntries ?? [];
          const message = args.map((arg) => formatConsoleValue(arg)).join(" ");
          buffer.push({
            timestamp: new Date().toISOString(),
            level,
            message: message.trim() || "(empty console message)",
          });

          if (buffer.length > MAX_BUFFERED_LOGS) {
            buffer.splice(0, buffer.length - MAX_BUFFERED_LOGS);
          }

          window.__walletlensFeedbackConsoleEntries = buffer;
        } catch {
          // Ignore feedback log buffer errors to keep console behavior intact.
        }

        original(...args);
      };
    }
  }

  return window.__walletlensFeedbackConsoleEntries;
}

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [screenshot, setScreenshot] = useState<ScreenshotCapture | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [logPreview, setLogPreview] = useState<ConsoleEntry[]>([]);
  const [bufferedLogCount, setBufferedLogCount] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    ensureConsoleBuffer();
  }, []);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const entries = ensureConsoleBuffer();
    setBufferedLogCount(entries.length);
    setLogPreview(entries.slice(-10));
  }, [open]);

  const repoConfigured = FEEDBACK_REPO.trim().length > 0;
  const canSubmit = Boolean(description.trim()) && repoConfigured && !isSubmitting && !success;

  async function captureScreenshot() {
    setError(null);
    setIsCapturing(true);

    // For testing: allow mock screenshot data URL
    if (typeof window !== "undefined" && window.__walletlensFeedbackMockScreenshotDataUrl) {
      setScreenshot({
        dataUrl: window.__walletlensFeedbackMockScreenshotDataUrl,
        capturedAt: new Date().toISOString(),
      });
      setIsCapturing(false);
      return;
    }

    try {
      // Temporarily close the modal so it doesn't appear in the screenshot
      setOpen(false);
      await new Promise((resolve) => setTimeout(resolve, 350));

      const canvas = await html2canvas(document.body, {
        useCORS: true,
        scale: window.devicePixelRatio || 1,
        logging: false,
        ignoreElements: (element) =>
          element.hasAttribute("data-feedback-trigger"),
      });

      setScreenshot({
        dataUrl: canvas.toDataURL("image/png"),
        capturedAt: new Date().toISOString(),
      });
      setOpen(true);
    } catch (captureError) {
      const message =
        captureError instanceof Error ? captureError.message : "Failed to capture screenshot.";
      setError(message);
      setOpen(true);
    } finally {
      setIsCapturing(false);
    }
  }

  async function submitFeedback() {
    setError(null);
    setSuccess(null);

    if (!description.trim()) {
      setError("Please describe the issue.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Gather console logs
      const buffer = ensureConsoleBuffer();
      const logs = buffer.slice(-MAX_INCLUDED_LOG_LINES);
      const consoleLogs = logs
        .map((entry) => `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}`)
        .join("\n");

      // Extract base64 from data URL (strip "data:image/png;base64," prefix)
      let screenshotBase64: string | undefined;
      if (screenshot?.dataUrl) {
        const base64Match = screenshot.dataUrl.match(/^data:[^;]+;base64,(.+)$/);
        if (base64Match) {
          screenshotBase64 = base64Match[1];
        }
      }

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          screenshotBase64,
          consoleLogs: consoleLogs || undefined,
          pageUrl: window.location.href,
          userAgent: navigator.userAgent,
        }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        issueUrl?: string;
        issueNumber?: number;
        error?: string;
      };

      if (!res.ok || !data.success) {
        setError(data.error || "Failed to submit feedback. Please try again.");
        return;
      }

      setSuccess(`Feedback submitted! (Issue #${data.issueNumber})`);

      // Reset form after short delay
      setTimeout(() => {
        setDescription("");
        setScreenshot(null);
        setSuccess(null);
        setOpen(false);
      }, 2500);
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Failed to submit feedback.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        data-feedback-trigger
        onClick={async () => {
          setError(null);
          setSuccess(null);
          if (typeof window !== "undefined") {
            const entries = ensureConsoleBuffer();
            setBufferedLogCount(entries.length);
            setLogPreview(entries.slice(-10));
          }
          // Auto-capture screenshot before opening the modal
          if (!screenshot) {
            setIsCapturing(true);
            try {
              const canvas = await html2canvas(document.body, {
                useCORS: true,
                scale: window.devicePixelRatio || 1,
                logging: false,
                ignoreElements: (element) =>
                  element.hasAttribute("data-feedback-trigger"),
              });
              setScreenshot({
                dataUrl: canvas.toDataURL("image/png"),
                capturedAt: new Date().toISOString(),
              });
            } catch {
              // Silently fail — user can still manually capture
            } finally {
              setIsCapturing(false);
            }
          }
          setOpen(true);
        }}
        className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] font-medium text-[#888] hover:text-[#ccc]"
      >
        <Bug className="h-[16px] w-[16px]" />
        <span>Report Bug</span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Send Feedback">
        <div className="space-y-4">
          <div>
            <label htmlFor="feedback-description" className="mb-1.5 block text-[13px] font-medium">
              What happened?
            </label>
            <textarea
              id="feedback-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe what you were doing and what went wrong."
              className="h-28 w-full resize-y rounded-lg border border-border/70 bg-card px-3 py-2 text-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="rounded-xl border border-border/70 bg-muted/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[13px] font-medium">Screenshot</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={captureScreenshot}
                disabled={isCapturing}
              >
                <Camera className="h-3.5 w-3.5" />
                {isCapturing ? "Capturing..." : screenshot ? "Recapture" : "Capture"}
              </Button>
            </div>

            {screenshot ? (
              <Image
                src={screenshot.dataUrl}
                alt="Captured screenshot preview"
                width={960}
                height={540}
                unoptimized
                className="max-h-32 w-full rounded-md border border-border/70 object-cover"
              />
            ) : (
              <p className="text-[12px] text-muted-foreground">
                Click Capture to include a screenshot (optional).
              </p>
            )}
          </div>

          <div className="rounded-xl border border-border/70 bg-muted/40 p-3">
            <div className="mb-2 flex items-center gap-1.5">
              <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[13px] font-medium">
                Console logs ({bufferedLogCount} buffered)
              </p>
            </div>
            {logPreview.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">No client logs captured yet.</p>
            ) : (
              <pre className="max-h-28 overflow-auto rounded-md bg-black/90 p-2 text-[10px] leading-relaxed text-white">
                {logPreview
                  .map((entry) => `[${entry.level.toUpperCase()}] ${entry.message}`)
                  .join("\n")}
              </pre>
            )}
          </div>

          {!repoConfigured && (
            <div className="rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p>
                  Set <code className="font-mono">NEXT_PUBLIC_GITHUB_FEEDBACK_REPO</code> to{" "}
                  <code className="font-mono">owner/repo</code> in your env file.
                </p>
              </div>
            </div>
          )}

          {error && <p className="text-[12px] text-destructive">{error}</p>}
          {success && (
            <div className="flex items-center gap-2 text-[12px] text-primary">
              <CheckCircle className="h-3.5 w-3.5" />
              <p>{success}</p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={submitFeedback} disabled={!canSubmit}>
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              {isSubmitting ? "Submitting..." : "Submit Feedback"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
