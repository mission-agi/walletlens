"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

export default function SettingsPage() {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClearData() {
    setClearing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/reset", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setMessage("All data cleared successfully. Redirecting...");
        // Use window.location to fully clear the Next.js router cache
        setTimeout(() => {
          window.location.href = "/";
        }, 1000);
      } else {
        setMessage("Failed to clear data. Please try again.");
      }
    } catch {
      setMessage("An error occurred. Please try again.");
    } finally {
      setClearing(false);
      setConfirmOpen(false);
    }
  }

  return (
    <div>
      <PageHeader title="Settings" />

      <section>
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-destructive">Danger Zone</h2>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[14px] font-semibold">Clear All Data</h3>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Delete all accounts, statements, and transactions. Categories will be preserved.
              </p>
            </div>
            <Button variant="danger" onClick={() => setConfirmOpen(true)}>
              Clear All Data
            </Button>
          </div>
        </Card>
      </section>

      {message && (
        <p className="mt-4 text-sm text-muted-foreground">{message}</p>
      )}

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Clear All Data"
      >
        <p className="text-[13px] text-muted-foreground">
          Are you sure? This will permanently delete all accounts, statements, and
          transactions. This cannot be undone.
        </p>
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="outline" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleClearData}
            disabled={clearing}
          >
            {clearing ? "Clearing..." : "Yes, Clear All Data"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
