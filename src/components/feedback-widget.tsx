"use client";

import { useEffect, useState } from "react";
import { Bug, CheckCircle, Loader2, Send } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

import { getDiagnosticLogs, initDiagnostics } from "@/lib/diagnostics";

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    initDiagnostics();
  }, []);

  const canSubmit = Boolean(description.trim()) && !isSubmitting && !success;

  async function submitFeedback() {
    setError(null);

    if (!description.trim()) {
      setError("Please describe the issue.");
      return;
    }

    setIsSubmitting(true);

    try {
      const consoleLogs = getDiagnosticLogs();

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          consoleLogs: consoleLogs || undefined,
          pageUrl: window.location.href,
          userAgent: navigator.userAgent,
        }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        googleFormSubmitted?: boolean;
        error?: string;
      };

      if (!res.ok || !data.success) {
        setError(data.error || "Failed to submit. Please try again.");
        return;
      }

      setSuccess(true);

      setTimeout(() => {
        setDescription("");
        setSuccess(false);
        setOpen(false);
      }, 2500);
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Failed to submit.";
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
        onClick={() => {
          setError(null);
          setSuccess(false);
          setOpen(true);
        }}
        className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] font-medium text-[#888] hover:text-[#ccc]"
      >
        <Bug className="h-[16px] w-[16px]" />
        <span>Report Bug</span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Report a Bug">
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

          {error && <p className="text-[12px] text-destructive">{error}</p>}
          {success && (
            <div className="flex items-center gap-2 text-[12px] text-primary">
              <CheckCircle className="h-3.5 w-3.5" />
              <p>Bug report submitted successfully!</p>
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
              {isSubmitting ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
