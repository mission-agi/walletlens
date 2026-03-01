"use client";

import { useEffect, useState } from "react";
import html2canvas from "html2canvas";
import Image from "next/image";
import { AlertTriangle, Bug, Camera, ExternalLink, Terminal } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

type ConsoleLevel = "log" | "info" | "warn" | "error";

interface ConsoleEntry {
  timestamp: string;
  level: ConsoleLevel;
  message: string;
}

interface ScreenshotCapture {
  blob: Blob;
  dataUrl: string;
  filename: string;
  capturedAt: string;
}

const MAX_BUFFERED_LOGS = 200;
const MAX_INCLUDED_LOG_LINES = 80;
const MAX_ISSUE_BODY_CHARS = 7000;
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

function buildIssueTitle(description: string): string {
  const firstLine = description.trim().split("\n")[0] || "Feedback";
  const compact = firstLine.replace(/\s+/g, " ").trim();
  const truncated = compact.length > 90 ? `${compact.slice(0, 90)}...` : compact;
  return `Feedback: ${truncated}`;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}\n...[truncated]`;
}

function downloadBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  if (!response.ok) {
    throw new Error("Could not decode screenshot data URL.");
  }
  return response.blob();
}

async function copyToClipboard(blob: Blob): Promise<boolean> {
  if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
    return false;
  }

  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        [blob.type]: blob,
      }),
    ]);
    return true;
  } catch {
    return false;
  }
}

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [screenshot, setScreenshot] = useState<ScreenshotCapture | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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
  const canSubmit = Boolean(description.trim()) && repoConfigured && !isSubmitting;

  const logsLineCount = bufferedLogCount;

  async function captureScreenshot() {
    setError(null);
    setNotice(null);
    setIsCapturing(true);

    // For testing: allow mock screenshot data URL
    if (typeof window !== "undefined" && window.__walletlensFeedbackMockScreenshotDataUrl) {
      try {
        const now = new Date();
        const filename = `walletlens-feedback-${now.toISOString().replace(/[:.]/g, "-")}.png`;
        const blob = await dataUrlToBlob(window.__walletlensFeedbackMockScreenshotDataUrl);
        setScreenshot({
          blob,
          dataUrl: window.__walletlensFeedbackMockScreenshotDataUrl,
          filename,
          capturedAt: now.toISOString(),
        });
        setNotice("Screenshot captured.");
      } catch {
        setError("Failed to capture screenshot.");
      } finally {
        setIsCapturing(false);
      }
      return;
    }

    try {
      // Temporarily close the modal so it doesn't appear in the screenshot
      setOpen(false);
      // Wait for the modal close animation and DOM repaint
      await new Promise((resolve) => setTimeout(resolve, 350));

      const canvas = await html2canvas(document.body, {
        useCORS: true,
        scale: window.devicePixelRatio || 1,
        logging: false,
        ignoreElements: (element) =>
          element.hasAttribute("data-feedback-trigger"),
      });

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => {
            if (!result) {
              reject(new Error("Failed to create screenshot image."));
              return;
            }
            resolve(result);
          },
          "image/png",
          1
        );
      });

      const now = new Date();
      const filename = `walletlens-feedback-${now.toISOString().replace(/[:.]/g, "-")}.png`;
      setScreenshot({
        blob,
        dataUrl: canvas.toDataURL("image/png"),
        filename,
        capturedAt: now.toISOString(),
      });
      setNotice("Screenshot recaptured.");
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

  async function openGitHubIssue() {
    setError(null);
    setNotice(null);

    if (!repoConfigured) {
      setError("Set NEXT_PUBLIC_GITHUB_FEEDBACK_REPO (owner/repo) to enable GitHub feedback.");
      return;
    }

    if (!description.trim()) {
      setError("Add a short description before submitting feedback.");
      return;
    }

    setIsSubmitting(true);

    try {
      const issueTab = window.open("about:blank", "_blank", "noopener,noreferrer");

      const buffer = ensureConsoleBuffer();
      const logs = buffer.slice(-MAX_INCLUDED_LOG_LINES);
      const logText = logs
        .map((entry) => `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}`)
        .join("\n");

      const screenshotSection = screenshot
        ? [
            "## Screenshot",
            "A screenshot was captured locally from WalletLens.",
            "- Paste with Cmd/Ctrl + V in this issue form.",
            `- If paste is blocked, attach file: \`${screenshot.filename}\`.`,
            `- Captured at: ${screenshot.capturedAt}`,
          ]
        : ["## Screenshot", "_No screenshot was captured._"];

      const body = truncate(
        [
          "## Description",
          description.trim(),
          "",
          ...screenshotSection,
          "",
          "## Environment",
          `- URL: ${window.location.href}`,
          `- User Agent: ${navigator.userAgent}`,
          `- Timestamp: ${new Date().toISOString()}`,
          "",
          "## Console Logs (last entries)",
          "```text",
          logText || "No client console logs were captured.",
          "```",
        ].join("\n"),
        MAX_ISSUE_BODY_CHARS
      );

      const issueUrl = new URL(`https://github.com/${FEEDBACK_REPO}/issues/new`);
      issueUrl.searchParams.set("title", buildIssueTitle(description));
      issueUrl.searchParams.set("labels", "bug,feedback");
      issueUrl.searchParams.set("body", body);

      let clipboardNotice = "";
      if (screenshot) {
        const copied = await copyToClipboard(screenshot.blob);
        if (!copied) {
          downloadBlob(screenshot.blob, screenshot.filename);
          clipboardNotice = ` Screenshot downloaded as ${screenshot.filename}; attach it to the issue.`;
        } else {
          clipboardNotice = " Screenshot is in your clipboard; paste it into the issue.";
        }
      }

      if (issueTab) {
        issueTab.location.href = issueUrl.toString();
      } else {
        window.open(issueUrl.toString(), "_blank", "noopener,noreferrer");
      }

      setNotice(`GitHub issue opened.${clipboardNotice}`);
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Failed to open GitHub issue.";
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
          setNotice(null);
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
              const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob(
                  (result) => {
                    if (!result) {
                      reject(new Error("Failed to create screenshot image."));
                      return;
                    }
                    resolve(result);
                  },
                  "image/png",
                  1
                );
              });
              const now = new Date();
              const filename = `walletlens-feedback-${now.toISOString().replace(/[:.]/g, "-")}.png`;
              setScreenshot({
                blob,
                dataUrl: canvas.toDataURL("image/png"),
                filename,
                capturedAt: now.toISOString(),
              });
            } catch {
              // Silently fail — user can still manually capture
            } finally {
              setIsCapturing(false);
            }
          }
          setOpen(true);
        }}
        className="fixed bottom-20 left-4 z-[60] inline-flex items-center gap-2 rounded-full border border-border/80 bg-card px-3 py-2 text-[13px] font-medium text-foreground shadow-[0_8px_24px_rgba(0,0,0,0.16)] hover:bg-muted md:bottom-6 md:left-6"
      >
        <Bug className="h-4 w-4" />
        <span className="hidden sm:inline">Report bug</span>
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
                Console logs ({logsLineCount} buffered)
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
          {notice && <p className="text-[12px] text-primary">{notice}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={openGitHubIssue} disabled={!canSubmit}>
              <ExternalLink className="h-3.5 w-3.5" />
              {isSubmitting ? "Opening..." : "Create GitHub Issue"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
