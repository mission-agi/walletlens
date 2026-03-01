"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Check, X, TrendingUp, AlertTriangle, Plus } from "lucide-react";

interface CategorizedTransaction {
  date: string;
  description: string;
  amount: number;
  type: "debit" | "credit";
  category: string;
  _fileIndex?: number;
}

interface InvestmentTransaction {
  date: string;
  action: string;
  symbol: string;
  description: string;
  shares: number;
  pricePerShare: number;
  amount: number;
  _fileIndex?: number;
}

interface FailedRow {
  rowIndex: number;
  rawContent: string;
  reasonCode: string;
  reasonMessage: string;
  _fileIndex?: number;
}

interface FileMeta {
  filename: string;
  bankName: string;
  accountLabel: string;
  isInvestment: boolean;
  accountType?: string;
}

interface Props {
  categories: { id: string; name: string; color: string }[];
}

const ACTION_COLORS: Record<string, string> = {
  buy: "#22c55e",
  sell: "#ef4444",
  dividend: "#8b5cf6",
  contribution: "#3b82f6",
  distribution: "#f97316",
  fee: "#6b7280",
  interest: "#06b6d4",
  transfer: "#a3a3a3",
};

const REASON_LABELS: Record<string, { label: string; color: string }> = {
  invalid_date: { label: "Unreadable date", color: "#f59e0b" },
  missing_amount_column: { label: "Amount missing", color: "#f59e0b" },
  missing_date_column: { label: "Date column missing", color: "#ef4444" },
  zero_amount_empty_description: { label: "Empty row", color: "#6b7280" },
  unparseable_row: { label: "Unreadable row", color: "#ef4444" },
  unknown_action: { label: "Unknown action", color: "#f59e0b" },
  summary_row: { label: "Summary row", color: "#6b7280" },
  pending_transaction: { label: "Pending", color: "#6b7280" },
  not_a_bank_statement: { label: "Not a statement", color: "#ef4444" },
  not_an_investment_statement: { label: "Not investment data", color: "#ef4444" },
  parser_crash: { label: "Parser error", color: "#ef4444" },
};

export function UploadForm({ categories }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [transactions, setTransactions] = useState<CategorizedTransaction[]>([]);
  const [investmentTransactions, setInvestmentTransactions] = useState<InvestmentTransaction[]>([]);
  const [failedRows, setFailedRows] = useState<FailedRow[]>([]);
  const [fileMetas, setFileMetas] = useState<FileMeta[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"ready" | "attention">("ready");
  const [manualAddIndex, setManualAddIndex] = useState<number | null>(null);
  const [manualForm, setManualForm] = useState({ date: "", description: "", amount: "", type: "debit" as "debit" | "credit", category: "" });
  const [uploadProgress, setUploadProgress] = useState<{ completed: number; total: number; failed: number } | null>(null);
  const [saveProgress, setSaveProgress] = useState<{ completed: number; total: number; failed: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const hasInvestmentFiles = fileMetas.some((m) => m.isInvestment);
  const hasBankFiles = fileMetas.some((m) => !m.isInvestment);

  function addFiles(newFiles: FileList | File[]) {
    const arr = Array.from(newFiles).filter(
      (f) => f.name.toLowerCase().endsWith(".csv") || f.name.toLowerCase().endsWith(".pdf")
    );
    setFiles((prev) => [...prev, ...arr]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleUpload() {
    if (files.length === 0) return;
    setUploading(true);
    setError("");
    setUploadProgress({ completed: 0, total: files.length, failed: 0 });

    const allTransactions: CategorizedTransaction[] = [];
    const allInvestmentTx: InvestmentTransaction[] = [];
    const allFailedRows: FailedRow[] = [];
    const metas: FileMeta[] = [];
    const errors: string[] = [];
    let completedCount = 0;
    let failedCount = 0;

    // Concurrency-limited queue: max 3 concurrent uploads
    const CONCURRENCY = 3;
    let nextIndex = 0;

    async function worker() {
      while (nextIndex < files.length) {
        const fileIndex = nextIndex++;
        const file = files[fileIndex];
        try {
          const formData = new FormData();
          formData.append("file", file);
          const res = await fetch("/api/upload", { method: "POST", body: formData });
          const data = await res.json();
          if (!res.ok) {
            errors.push(`${file.name}: ${data.error || "Failed"}`);
            failedCount++;
          } else {
            metas.push({
              filename: data.filename,
              bankName: data.bankName,
              accountLabel: data.accountLabel,
              isInvestment: data.isInvestment || false,
              accountType: data.accountType,
            });

            if (data.isInvestment) {
              for (const tx of data.investmentTransactions || []) {
                allInvestmentTx.push({ ...tx, _fileIndex: fileIndex });
              }
            } else {
              for (const tx of data.transactions || []) {
                allTransactions.push({ ...tx, _fileIndex: fileIndex });
              }
            }

            for (const fr of data.failedRows || []) {
              allFailedRows.push({ ...fr, _fileIndex: fileIndex });
            }
          }
        } catch {
          errors.push(`${file.name}: Upload failed`);
          failedCount++;
        }
        completedCount++;
        setUploadProgress({ completed: completedCount, total: files.length, failed: failedCount });
      }
    }

    try {
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, () => worker()));

      setTransactions(allTransactions);
      setInvestmentTransactions(allInvestmentTx);
      setFailedRows(allFailedRows);
      setFileMetas(metas);

      if (allFailedRows.length > 0 && (allTransactions.length > 0 || allInvestmentTx.length > 0)) {
        setActiveTab("ready");
      } else if (allFailedRows.length > 0) {
        setActiveTab("attention");
      }

      if (errors.length > 0 && metas.length === 0) {
        setError(errors.join("\n"));
      } else if (errors.length > 0) {
        setError(`Some files skipped: ${errors.map((e) => e.split(":")[0]).join(", ")}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  function updateCategory(index: number, category: string) {
    setTransactions((prev) =>
      prev.map((t, i) => (i === index ? { ...t, category } : t))
    );
  }

  function updateFileMeta(index: number, field: keyof FileMeta, value: string) {
    setFileMetas((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    );
  }

  function handleManualAdd(failedIndex: number) {
    const fr = failedRows[failedIndex];
    // Try to pre-fill from rawContent if possible
    let prefillDate = "";
    let prefillDesc = "";
    let prefillAmount = "";
    try {
      const parsed = JSON.parse(fr.rawContent);
      if (typeof parsed === "object" && parsed !== null) {
        const vals = Object.values(parsed) as string[];
        if (vals[0]) prefillDate = vals[0];
        if (vals[1]) prefillDesc = vals[1];
        if (vals[2]) prefillAmount = String(vals[2]).replace(/[$,\s()-]/g, "");
      }
    } catch {
      // rawContent is not JSON (PDF), show as description hint
      prefillDesc = fr.rawContent.substring(0, 80);
    }
    setManualAddIndex(failedIndex);
    setManualForm({
      date: prefillDate,
      description: prefillDesc,
      amount: prefillAmount,
      type: "debit",
      category: categories[0]?.name || "Other",
    });
  }

  function submitManualAdd() {
    if (manualAddIndex === null) return;
    const amt = parseFloat(manualForm.amount);
    if (!manualForm.date || isNaN(amt)) return;

    // Add to transactions
    const newTx: CategorizedTransaction = {
      date: manualForm.date,
      description: manualForm.description,
      amount: Math.abs(amt),
      type: manualForm.type,
      category: manualForm.category,
      _fileIndex: failedRows[manualAddIndex]._fileIndex,
    };
    setTransactions((prev) => [...prev, newTx]);

    // Remove from failed rows
    setFailedRows((prev) => prev.filter((_, i) => i !== manualAddIndex));
    setManualAddIndex(null);
  }

  function dismissFailedRow(index: number) {
    setFailedRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    const saveErrors: string[] = [];
    let completedCount = 0;
    let failedCount = 0;
    const totalFiles = fileMetas.length;
    setSaveProgress({ completed: 0, total: totalFiles, failed: 0 });

    const BATCH_SIZE = 500;

    try {
      // Sequential save — one file at a time to avoid SQLite write lock contention
      for (let fileIndex = 0; fileIndex < fileMetas.length; fileIndex++) {
        const meta = fileMetas[fileIndex];

        try {
          if (meta.isInvestment) {
            const fileTxns = investmentTransactions
              .filter((t) => t._fileIndex === fileIndex)
              .map(({ _fileIndex, ...tx }) => tx);

            if (fileTxns.length === 0) {
              completedCount++;
              setSaveProgress({ completed: completedCount, total: totalFiles, failed: failedCount });
              continue;
            }

            // Chunk large transaction sets into batches
            for (let i = 0; i < fileTxns.length; i += BATCH_SIZE) {
              const batch = fileTxns.slice(i, i + BATCH_SIZE);
              const res = await fetch("/api/investment-transactions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  bankName: meta.bankName,
                  accountLabel: meta.accountLabel,
                  accountType: meta.accountType || "brokerage",
                  filename: meta.filename,

                  transactions: batch,
                }),
              });

              if (!res.ok) {
                throw new Error(`Failed to save ${meta.filename}`);
              }
            }
          } else {
            const fileTxns = transactions
              .filter((t) => t._fileIndex === fileIndex)
              .map(({ _fileIndex, ...tx }) => tx);

            if (fileTxns.length === 0) {
              completedCount++;
              setSaveProgress({ completed: completedCount, total: totalFiles, failed: failedCount });
              continue;
            }

            // Chunk large transaction sets into batches
            for (let i = 0; i < fileTxns.length; i += BATCH_SIZE) {
              const batch = fileTxns.slice(i, i + BATCH_SIZE);
              const res = await fetch("/api/transactions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  bankName: meta.bankName,
                  accountLabel: meta.accountLabel,
                  filename: meta.filename,

                  transactions: batch,
                }),
              });

              if (!res.ok) {
                throw new Error(`Failed to save ${meta.filename}`);
              }
            }
          }
        } catch (err) {
          saveErrors.push(err instanceof Error ? err.message : `Failed to save ${meta.filename}`);
          failedCount++;
        }

        completedCount++;
        setSaveProgress({ completed: completedCount, total: totalFiles, failed: failedCount });
      }

      if (saveErrors.length > 0 && saveErrors.length === totalFiles) {
        setError(saveErrors.join("\n"));
      } else if (saveErrors.length > 0) {
        setError(`Some files failed: ${saveErrors.join(", ")}`);
        setSaved(true);
        const redirectTo = hasInvestmentFiles && !hasBankFiles ? "/portfolio" : "/";
        setTimeout(() => router.push(redirectTo), 2000);
      } else {
        setSaved(true);
        const redirectTo = hasInvestmentFiles && !hasBankFiles ? "/portfolio" : "/";
        setTimeout(() => router.push(redirectTo), 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
      setSaveProgress(null);
    }
  }

  // Success state
  if (saved) {
    const totalTxCount = transactions.length + investmentTransactions.length;
    const skippedCount = failedRows.length;
    return (
      <Card className="flex flex-col items-center py-16 animate-fade-in-up">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
          <Check className="h-7 w-7 text-emerald-600" />
        </div>
        <h3 className="mt-4 text-[15px] font-semibold">
          {hasInvestmentFiles ? "Data Imported" : "Transactions Imported"}
        </h3>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Imported {totalTxCount}{skippedCount > 0 ? ` \u00b7 Skipped ${skippedCount}` : ""} from {fileMetas.length} file{fileMetas.length > 1 ? "s" : ""}. Redirecting...
        </p>
      </Card>
    );
  }

  // Preview state
  const hasParsedData = transactions.length > 0 || investmentTransactions.length > 0 || failedRows.length > 0;
  if (hasParsedData) {
    const totalDebit = transactions.filter((t) => t.type === "debit").reduce((s, t) => s + t.amount, 0);
    const totalCredit = transactions.filter((t) => t.type === "credit").reduce((s, t) => s + t.amount, 0);
    const totalInvestmentAmount = investmentTransactions.reduce((s, t) => s + t.amount, 0);
    const totalCount = transactions.length + investmentTransactions.length;

    return (
      <div className="space-y-4 animate-fade-in-up">
        {/* Summary card */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-semibold">
                Preview: {fileMetas.length} file{fileMetas.length > 1 ? "s" : ""}
              </h3>
              <p className="text-[13px] text-muted-foreground">
                {totalCount} {hasInvestmentFiles && hasBankFiles ? "items" : hasInvestmentFiles ? "investment transactions" : "transactions"} ready
                {failedRows.length > 0 && (
                  <span className="text-amber-600"> &middot; {failedRows.length} need{failedRows.length === 1 ? "s" : ""} attention</span>
                )}
              </p>
            </div>
            <div className="flex gap-4 text-[13px] tabular-nums">
              {hasBankFiles && (
                <>
                  <span className="text-red-600 font-medium">Debits: ${totalDebit.toFixed(2)}</span>
                  <span className="text-emerald-600 font-medium">Credits: ${totalCredit.toFixed(2)}</span>
                </>
              )}
              {hasInvestmentFiles && (
                <span className="text-primary font-medium">
                  <TrendingUp className="mr-1 inline h-3.5 w-3.5" />
                  Investment Total: ${totalInvestmentAmount.toFixed(2)}
                </span>
              )}
            </div>
          </div>
        </Card>

        {/* Account info per file */}
        {fileMetas.map((meta, i) => (
          <Card key={i}>
            <div className="mb-3 flex items-center gap-2">
              <h4 className="text-sm font-semibold">{meta.filename}</h4>
              {meta.isInvestment && (
                <Badge color="#8b5cf6">Investment</Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {meta.isInvestment ? "Brokerage" : "Bank Name"}
                </label>
                <input
                  type="text"
                  value={meta.bankName}
                  onChange={(e) => updateFileMeta(i, "bankName", e.target.value)}
                  className="h-9 w-full rounded-lg border border-border/70 bg-card px-3 text-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Account Label
                </label>
                <input
                  type="text"
                  value={meta.accountLabel}
                  onChange={(e) => updateFileMeta(i, "accountLabel", e.target.value)}
                  className="h-9 w-full rounded-lg border border-border/70 bg-card px-3 text-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              {meta.isInvestment && (
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Account Type
                  </label>
                  <select
                    value={meta.accountType || "brokerage"}
                    onChange={(e) => updateFileMeta(i, "accountType", e.target.value)}
                    className="h-9 w-full rounded-lg border border-border/70 bg-card px-3 text-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  >
                    <option value="brokerage">Brokerage</option>
                    <option value="retirement_401k">401(k)</option>
                    <option value="ira">IRA</option>
                  </select>
                </div>
              )}
            </div>
          </Card>
        ))}

        {/* Tabs: Ready to Import / Needs Attention */}
        {failedRows.length > 0 && (
          <div className="flex gap-1 rounded-lg border border-border/60 bg-muted/30 p-1" role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === "ready"}
              onClick={() => setActiveTab("ready")}
              className={`flex-1 rounded-md px-4 py-2 text-[13px] font-medium transition-colors ${
                activeTab === "ready"
                  ? "bg-card text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Ready to Import ({totalCount})
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "attention"}
              onClick={() => setActiveTab("attention")}
              className={`flex-1 rounded-md px-4 py-2 text-[13px] font-medium transition-colors ${
                activeTab === "attention"
                  ? "bg-card text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5 text-amber-500" />
              Needs Attention ({failedRows.length})
            </button>
          </div>
        )}

        {/* Ready to Import tab content */}
        {(activeTab === "ready" || failedRows.length === 0) && (
          <>
            {/* Investment transactions table */}
            {investmentTransactions.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-border/60">
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Date</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Action</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Symbol</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Description</th>
                      {fileMetas.length > 1 && (
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Source</th>
                      )}
                      <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Shares</th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Price</th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {investmentTransactions.map((tx, i) => (
                      <tr key={i} className="hover:bg-muted/30">
                        <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{tx.date}</td>
                        <td className="px-4 py-2.5">
                          <Badge color={ACTION_COLORS[tx.action] || "#a3a3a3"}>
                            {tx.action}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[12px] font-medium">
                          {tx.symbol}
                        </td>
                        <td className="max-w-xs truncate px-4 py-2.5 text-muted-foreground">
                          {tx.description}
                        </td>
                        {fileMetas.length > 1 && (
                          <td className="whitespace-nowrap px-4 py-2.5 text-[11px] text-muted-foreground">
                            {fileMetas[tx._fileIndex ?? 0]?.filename}
                          </td>
                        )}
                        <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
                          {tx.shares > 0 ? tx.shares.toFixed(4) : "-"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
                          {tx.pricePerShare > 0 ? `$${tx.pricePerShare.toFixed(2)}` : "-"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right font-medium tabular-nums">
                          ${tx.amount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Bank transactions table */}
            {transactions.length > 0 && (
              <>
                {hasInvestmentFiles && (
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    Bank Transactions
                  </h3>
                )}
                <div className="overflow-x-auto rounded-xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-border/60">
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Date</th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Description</th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Source</th>
                        <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Amount</th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Category</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {transactions.map((tx, i) => (
                        <tr key={i} className="hover:bg-muted/30">
                          <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{tx.date}</td>
                          <td className="max-w-xs truncate px-4 py-2.5">{tx.description}</td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-[11px] text-muted-foreground">
                            {fileMetas[tx._fileIndex ?? 0]?.filename}
                          </td>
                          <td className={`whitespace-nowrap px-4 py-2.5 text-right font-medium tabular-nums ${tx.type === "debit" ? "text-red-600" : "text-emerald-600"}`}>
                            {tx.type === "debit" ? "-" : "+"}${tx.amount.toFixed(2)}
                          </td>
                          <td className="px-4 py-2.5">
                            <select
                              value={tx.category}
                              onChange={(e) => updateCategory(i, e.target.value)}
                              className="h-7 rounded-md border border-border/70 bg-card px-2 text-[11px] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:ring-2 focus:ring-primary/30"
                            >
                              {categories.map((c) => (
                                <option key={c.id} value={c.name}>{c.name}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {totalCount === 0 && failedRows.length > 0 && (
              <Card className="flex flex-col items-center py-10">
                <AlertTriangle className="h-8 w-8 text-amber-500" />
                <p className="mt-3 text-[14px] font-semibold">No transactions could be parsed</p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Check the Needs Attention tab to manually add transactions
                </p>
              </Card>
            )}
          </>
        )}

        {/* Needs Attention tab content */}
        {activeTab === "attention" && failedRows.length > 0 && (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Row</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Raw Content</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Reason</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Source</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {failedRows.map((fr, i) => (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground tabular-nums">
                        {fr.rowIndex >= 0 ? `#${fr.rowIndex + 1}` : "-"}
                      </td>
                      <td className="max-w-xs px-4 py-2.5">
                        <code className="block max-w-[320px] truncate rounded bg-muted/50 px-2 py-1 font-mono text-[11px]">
                          {fr.rawContent || "(empty)"}
                        </code>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge color={REASON_LABELS[fr.reasonCode]?.color || "#6b7280"}>
                          {REASON_LABELS[fr.reasonCode]?.label || fr.reasonCode}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-[11px] text-muted-foreground">
                        {fileMetas[fr._fileIndex ?? 0]?.filename}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleManualAdd(i)}
                            className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
                            title="Add this transaction manually"
                          >
                            <Plus className="h-3 w-3" />
                            Add
                          </button>
                          <button
                            onClick={() => dismissFailedRow(i)}
                            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                            title="Dismiss this row"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Manual add form (inline) */}
            {manualAddIndex !== null && (
              <Card className="border-primary/30 bg-primary/[0.02]">
                <div className="mb-3 flex items-center gap-2">
                  <Plus className="h-4 w-4 text-primary" />
                  <h4 className="text-[13px] font-semibold">Manually Add Transaction</h4>
                  <span className="text-[11px] text-muted-foreground">
                    from row {failedRows[manualAddIndex]?.rowIndex >= 0 ? `#${failedRows[manualAddIndex].rowIndex + 1}` : ""}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Date</label>
                    <input
                      type="date"
                      value={manualForm.date}
                      onChange={(e) => setManualForm((f) => ({ ...f, date: e.target.value }))}
                      className="h-9 w-full rounded-lg border border-border/70 bg-card px-3 text-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Description</label>
                    <input
                      type="text"
                      value={manualForm.description}
                      onChange={(e) => setManualForm((f) => ({ ...f, description: e.target.value }))}
                      className="h-9 w-full rounded-lg border border-border/70 bg-card px-3 text-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      value={manualForm.amount}
                      onChange={(e) => setManualForm((f) => ({ ...f, amount: e.target.value }))}
                      className="h-9 w-full rounded-lg border border-border/70 bg-card px-3 text-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Type</label>
                    <select
                      value={manualForm.type}
                      onChange={(e) => setManualForm((f) => ({ ...f, type: e.target.value as "debit" | "credit" }))}
                      className="h-9 w-full rounded-lg border border-border/70 bg-card px-3 text-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    >
                      <option value="debit">Debit</option>
                      <option value="credit">Credit</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Category</label>
                    <select
                      value={manualForm.category}
                      onChange={(e) => setManualForm((f) => ({ ...f, category: e.target.value }))}
                      className="h-9 w-full rounded-lg border border-border/70 bg-card px-3 text-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setManualAddIndex(null)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={submitManualAdd} disabled={!manualForm.date || !manualForm.amount}>
                    Add Transaction
                  </Button>
                </div>
              </Card>
            )}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {saveProgress && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[12px] text-muted-foreground">
              <span>Saving to database...</span>
              <span className="tabular-nums">{saveProgress.completed}/{saveProgress.total} files{saveProgress.failed > 0 ? ` (${saveProgress.failed} failed)` : ""}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted/50">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${(saveProgress.completed / saveProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => {
            setTransactions([]);
            setInvestmentTransactions([]);
            setFailedRows([]);
            setFiles([]);
            setFileMetas([]);
            setActiveTab("ready");
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || totalCount === 0}>
            {saving ? "Saving..." : `Import ${totalCount} ${hasInvestmentFiles && !hasBankFiles ? "Investment Transactions" : "Transactions"}`}
          </Button>
        </div>
      </div>
    );
  }

  // Upload state
  return (
    <Card className="space-y-6 animate-fade-in-up">
      <div>
        <p className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Statement Files</p>
        <div
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            addFiles(e.dataTransfer.files);
          }}
          className="relative flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-border/60 bg-muted/20 py-14 hover:border-primary/50 hover:bg-primary/[0.03]"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.pdf"
            multiple
            className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          {files.length > 0 ? (
            <>
              <div className="pointer-events-none flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <p className="pointer-events-none mt-3 text-[14px] font-semibold">{files.length} file{files.length > 1 ? "s" : ""} selected</p>
              <p className="pointer-events-none mt-0.5 text-[13px] text-muted-foreground">
                {(files.reduce((s, f) => s + f.size, 0) / 1024).toFixed(1)} KB total
              </p>
            </>
          ) : (
            <>
              <div className="pointer-events-none flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Upload className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="pointer-events-none mt-3 text-[14px] font-semibold">Drop files here or click to browse</p>
              <p className="pointer-events-none mt-0.5 text-[13px] text-muted-foreground">
                Bank statements and brokerage CSVs/PDFs
              </p>
            </>
          )}
        </div>
      </div>
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1 text-[12px] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
            >
              <FileText className="h-3 w-3 text-muted-foreground" />
              {f.name}
              <button
                onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      {error && (
        <p className="text-[13px] text-destructive">{error}</p>
      )}
      {uploadProgress && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[12px] text-muted-foreground">
            <span>Parsing files...</span>
            <span className="tabular-nums">{uploadProgress.completed}/{uploadProgress.total}{uploadProgress.failed > 0 ? ` (${uploadProgress.failed} failed)` : ""}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted/50">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${(uploadProgress.completed / uploadProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}
      <div className="flex justify-end">
        <Button onClick={handleUpload} disabled={files.length === 0 || uploading}>
          {uploading ? "Parsing..." : `Upload & Parse${files.length > 1 ? ` (${files.length} files)` : ""}`}
        </Button>
      </div>
    </Card>
  );
}
