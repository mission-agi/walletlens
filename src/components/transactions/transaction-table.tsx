"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { formatCurrency, formatDate, getCategoryColor } from "@/lib/utils";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Trash2, Check, X, Pencil } from "lucide-react";

interface Transaction {
  id: string;
  date: Date | string;
  description: string;
  amount: number;
  type: string;
  category: string;
  statement: { account: { name: string; bankName: string } };
}

export function TransactionTable({
  transactions,
  categories,
  currentPage,
  totalPages,
}: {
  transactions: Transaction[];
  categories: { name: string; color: string }[];
  currentPage: number;
  totalPages: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [saving, setSaving] = useState(false);

  const startEdit = (tx: Transaction) => {
    setEditingId(tx.id);
    setEditCategory(tx.category);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditCategory("");
  };

  const saveCategory = async (txId: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/transactions/${txId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ category: editCategory }),
      });
      if (res.ok) {
        setEditingId(null);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/transactions/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteTarget(null);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  /** Build pagination href preserving current search params */
  const pageHref = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    return `/transactions?${params.toString()}`;
  };

  return (
    <div className="animate-fade-in-up">
      <div className="overflow-x-auto rounded-xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border/60">
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Date</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Description</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Account</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Category</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Amount</th>
              <th className="w-10 px-2 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {transactions.map((tx) => (
              <tr key={tx.id} className="group hover:bg-muted/30">
                <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{formatDate(tx.date)}</td>
                <td className="max-w-xs truncate px-4 py-2.5">{tx.description}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{tx.statement.account.name}</td>
                <td className="px-4 py-2.5">
                  {editingId === tx.id ? (
                    <div className="flex items-center gap-1.5">
                      <Select
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        className="h-7 w-36 text-[12px]"
                      >
                        {categories.map((c) => (
                          <option key={c.name} value={c.name}>{c.name}</option>
                        ))}
                      </Select>
                      <button
                        onClick={() => saveCategory(tx.id)}
                        disabled={saving || editCategory === tx.category}
                        className="rounded p-1 text-emerald-600 hover:bg-emerald-50 disabled:opacity-40"
                        title="Save"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="rounded p-1 text-muted-foreground hover:bg-muted"
                        title="Cancel"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEdit(tx)}
                      className="group/badge flex items-center gap-1.5 rounded-md px-0.5 py-0.5 -mx-0.5 hover:bg-muted/60 transition-colors"
                      title="Click to edit category"
                    >
                      <Badge color={getCategoryColor(tx.category, categories)}>
                        {tx.category}
                      </Badge>
                      <Pencil className="h-3 w-3 text-muted-foreground/0 group-hover/badge:text-muted-foreground/60 transition-colors" />
                    </button>
                  )}
                </td>
                <td className={`whitespace-nowrap px-4 py-2.5 text-right font-medium tabular-nums ${tx.type === "debit" ? "text-red-600" : "text-emerald-600"}`}>
                  {tx.type === "debit" ? "-" : "+"}{formatCurrency(tx.amount)}
                </td>
                <td className="px-2 py-2.5">
                  <button
                    onClick={() => setDeleteTarget(tx)}
                    className="rounded p-1.5 text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-destructive hover:bg-destructive/10 transition-colors"
                    title="Delete transaction"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-[13px] text-muted-foreground">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <Link href={pageHref(currentPage - 1)}>
                <Button variant="outline" size="sm">
                  <ChevronLeft className="h-3.5 w-3.5" /> Previous
                </Button>
              </Link>
            )}
            {currentPage < totalPages && (
              <Link href={pageHref(currentPage + 1)}>
                <Button variant="outline" size="sm">
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Transaction"
      >
        <p className="text-[13px] text-muted-foreground">
          Are you sure you want to delete this transaction?
        </p>
        {deleteTarget && (
          <div className="mt-3 rounded-lg bg-muted/50 p-3 text-[13px]">
            <p className="font-medium">{deleteTarget.description}</p>
            <p className="text-muted-foreground">
              {formatDate(deleteTarget.date)} &middot;{" "}
              {deleteTarget.type === "debit" ? "-" : "+"}
              {formatCurrency(deleteTarget.amount)}
            </p>
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={confirmDelete} disabled={saving}>
            {saving ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
