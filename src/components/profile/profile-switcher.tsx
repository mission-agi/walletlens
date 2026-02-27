"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus } from "lucide-react";

interface User {
  id: string;
  name: string;
  avatarColor: string;
}

export function ProfileSwitcher({ activeUser }: { activeUser: User | null }) {
  const [users, setUsers] = useState<User[]>([]);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then(setUsers)
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setAdding(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function switchUser(userId: string) {
    await fetch("/api/users/set-active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    setOpen(false);
    router.refresh();
  }

  async function addUser() {
    if (!newName.trim()) return;
    const colors = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];
    const color = colors[users.length % colors.length];
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), avatarColor: color }),
    });
    if (res.ok) {
      const user = await res.json();
      setUsers((prev) => [...prev, user]);
      setNewName("");
      setAdding(false);
      await switchUser(user.id);
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-md px-2.5 py-[7px] text-[13px] hover:bg-white/[0.06]"
      >
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
          style={{ backgroundColor: activeUser?.avatarColor || "#3b82f6" }}
        >
          {activeUser?.name?.[0]?.toUpperCase() || "?"}
        </div>
        <span className="flex-1 truncate text-left font-medium text-[#ccc]">
          {activeUser?.name || "Select User"}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#555]" />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 rounded-lg border border-border bg-card shadow-xl z-50">
          <div className="py-1">
            {users.map((user) => (
              <button
                key={user.id}
                onClick={() => switchUser(user.id)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-[13px] hover:bg-muted ${
                  user.id === activeUser?.id ? "bg-muted" : ""
                }`}
              >
                <div
                  className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white"
                  style={{ backgroundColor: user.avatarColor }}
                >
                  {user.name[0]?.toUpperCase()}
                </div>
                <span className="truncate">{user.name}</span>
                {user.id === activeUser?.id && (
                  <span className="ml-auto text-[11px] text-primary font-medium">Active</span>
                )}
              </button>
            ))}
          </div>
          <div style={{ borderTop: '1px solid var(--color-border)' }}>
            {adding ? (
              <div className="flex items-center gap-1 p-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addUser()}
                  placeholder="Name..."
                  className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-[13px]"
                  autoFocus
                />
                <button
                  onClick={addUser}
                  className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground"
                >
                  Add
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAdding(true)}
                className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-muted-foreground hover:bg-muted"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Profile
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
