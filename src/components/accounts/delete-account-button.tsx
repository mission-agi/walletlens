"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

export function DeleteAccountButton({ accountId, accountName }: { accountId: string; accountName: string }) {
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete "${accountName}"? This will also delete all statements and transactions.`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/accounts/${accountId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        // Use window.location to fully clear the Next.js router cache
        window.location.href = "/accounts";
      } else {
        alert("Failed to delete account. Please try again.");
        setLoading(false);
      }
    } catch {
      alert("An error occurred. Please try again.");
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      title="Delete account"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
