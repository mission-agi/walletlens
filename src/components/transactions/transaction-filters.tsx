"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

interface Props {
  accounts: { id: string; name: string; bankName: string }[];
  categories: { id: string; name: string }[];
  currentFilters: {
    category?: string;
    account?: string;
    search?: string;
    from?: string;
    to?: string;
  };
}

export function TransactionFilters({ accounts, categories, currentFilters }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page");
      router.push(`/transactions?${params.toString()}`);
    },
    [router, searchParams]
  );

  const clearFilters = () => router.push("/transactions");

  const exportCSV = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    window.location.href = `/api/transactions/export?${params.toString()}`;
  };

  const hasFilters = Object.values(currentFilters).some(Boolean);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] animate-fade-in-up">
      <div className="min-w-[200px] flex-1">
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Search</label>
        <Input
          placeholder="Search descriptions..."
          defaultValue={currentFilters.search || ""}
          onChange={(e) => {
            const timer = setTimeout(() => updateFilter("search", e.target.value), 500);
            return () => clearTimeout(timer);
          }}
        />
      </div>
      <div className="w-40">
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Category</label>
        <Select
          value={currentFilters.category || ""}
          onChange={(e) => updateFilter("category", e.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </Select>
      </div>
      <div className="w-40">
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Account</label>
        <Select
          value={currentFilters.account || ""}
          onChange={(e) => updateFilter("account", e.target.value)}
        >
          <option value="">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </Select>
      </div>
      <div className="w-36">
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">From</label>
        <Input
          type="date"
          value={currentFilters.from || ""}
          onChange={(e) => updateFilter("from", e.target.value)}
        />
      </div>
      <div className="w-36">
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">To</label>
        <Input
          type="date"
          value={currentFilters.to || ""}
          onChange={(e) => updateFilter("to", e.target.value)}
        />
      </div>
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="h-4 w-4" /> Clear
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={exportCSV} title="Export filtered transactions as CSV">
        <Download className="h-3.5 w-3.5" /> Export
      </Button>
    </div>
  );
}
