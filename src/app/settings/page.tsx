"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Database, Eye, Send, Shield } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

interface PrivacyItem {
  id: string;
  icon: React.ReactNode;
  title: string;
  content: React.ReactNode;
}

const privacyItems: PrivacyItem[] = [
  {
    id: "local-data",
    icon: <Database className="h-4 w-4 text-primary" />,
    title: "Your Financial Data Stays on Your Device",
    content: (
      <div className="space-y-2">
        <p>
          WalletLens is a <strong>local-first application</strong>. All your financial data
          &mdash; including accounts, statements, transactions, and balances &mdash; is stored
          exclusively in a local database on your device.
        </p>
        <p>
          Your financial information is <strong>never transmitted</strong> to any external
          server, cloud service, or third party. No exceptions.
        </p>
      </div>
    ),
  },
  {
    id: "bug-reports",
    icon: <Send className="h-4 w-4 text-primary" />,
    title: "Bug Report Data Collection",
    content: (
      <div className="space-y-2">
        <p>
          When you voluntarily submit a bug report via the <strong>Report Bug</strong> button,
          the following diagnostic data is collected to help us improve WalletLens:
        </p>
        <ul className="list-inside list-disc space-y-1 pl-1">
          <li><strong>Bug description</strong> &mdash; the text you write describing the issue</li>
          <li><strong>Application logs</strong> &mdash; recent console entries relevant to the reported issue</li>
          <li><strong>Page context</strong> &mdash; which page you were on when the issue occurred</li>
          <li><strong>Device info</strong> &mdash; browser version and operating system</li>
          <li><strong>Installation identifier</strong> &mdash; a randomly generated ID (e.g. WL-A3F9B2C1) unique to your installation</li>
        </ul>
        <p>
          This diagnostic data is used <strong>solely for product improvement</strong> &mdash;
          identifying bugs, understanding error patterns, and prioritizing fixes. It is never
          used for advertising, profiling, or any other purpose.
        </p>
      </div>
    ),
  },
  {
    id: "no-pii",
    icon: <Eye className="h-4 w-4 text-primary" />,
    title: "No Personal Identification",
    content: (
      <div className="space-y-2">
        <p>
          WalletLens does not require an account, login, or any form of registration.
          None of the diagnostic data collected through bug reports contains personally
          identifiable information (PII).
        </p>
        <p>
          The installation identifier is a randomly generated value that{" "}
          <strong>cannot be linked to your identity</strong>, device, or any personal
          information. It exists only to correlate multiple bug reports from the same
          installation for debugging purposes.
        </p>
        <p>
          No cookies, fingerprinting, or tracking technologies are used.
        </p>
      </div>
    ),
  },
  {
    id: "third-party",
    icon: <Shield className="h-4 w-4 text-primary" />,
    title: "Third-Party Services",
    content: (
      <div className="space-y-2">
        <p>
          Bug report data is delivered via <strong>Google Forms</strong>, a service provided
          by Google LLC. This is the only third-party service that receives any data from
          WalletLens, and only when you choose to submit a bug report.
        </p>
        <p>
          Google&apos;s handling of this data is governed by the{" "}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:text-primary/80"
          >
            Google Privacy Policy
          </a>
          .
        </p>
        <p>
          No analytics services, advertising networks, or other third-party trackers are
          integrated into WalletLens.
        </p>
      </div>
    ),
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  function toggleItem(id: string) {
    setExpandedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

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

      <section className="mb-8">
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Privacy & Data</h2>
        <Card>
          <div className="divide-y divide-border/60">
            {privacyItems.map((item) => {
              const isOpen = expandedItems.includes(item.id);
              return (
                <div key={item.id}>
                  <button
                    type="button"
                    onClick={() => toggleItem(item.id)}
                    className="flex w-full items-center justify-between gap-3 px-1 py-3 text-left transition-colors hover:bg-muted/30 rounded-lg"
                  >
                    <div className="flex items-center gap-2.5">
                      {item.icon}
                      <span className="text-[13px] font-medium">{item.title}</span>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-7 pb-4 text-[13px] leading-relaxed text-muted-foreground">
                      {item.content}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </section>

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
