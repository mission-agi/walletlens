"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Select } from "@/components/ui/select";
import { FileBarChart } from "lucide-react";

export type RangeMode = "monthly" | "ytd" | "custom";

interface Props {
  year: number;
  month: number;
  rangeMode: RangeMode;
  startDate?: string;
  endDate?: string;
}

export function DashboardPeriodSelector({ year, month, rangeMode, startDate, endDate }: Props) {
  const router = useRouter();

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: new Date(2024, i).toLocaleDateString("en-US", { month: "long" }),
  }));

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  function navigate(params: Record<string, string | number>) {
    const query = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      query.set(k, String(v));
    }
    router.push(`/?${query.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 animate-fade-in-up">
      <Select
        value={rangeMode}
        onChange={(e) => {
          const mode = e.target.value as RangeMode;
          if (mode === "monthly") {
            navigate({ range: "monthly", year, month });
          } else if (mode === "ytd") {
            navigate({ range: "ytd", year });
          } else {
            const now = new Date();
            const s = startDate || `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
            const e2 = endDate || now.toISOString().split("T")[0];
            navigate({ range: "custom", startDate: s, endDate: e2 });
          }
        }}
        className="w-auto"
      >
        <option value="monthly">Monthly</option>
        <option value="ytd">Year to Date</option>
        <option value="custom">Custom Range</option>
      </Select>

      {rangeMode === "monthly" && (
        <>
          <Select
            value={month}
            onChange={(e) => navigate({ range: "monthly", year, month: e.target.value })}
            className="w-auto"
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </Select>
          <Select
            value={year}
            onChange={(e) => navigate({ range: "monthly", year: e.target.value, month })}
            className="w-auto"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </Select>
        </>
      )}

      {rangeMode === "ytd" && (
        <Select
          value={year}
          onChange={(e) => navigate({ range: "ytd", year: e.target.value })}
          className="w-auto"
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </Select>
      )}

      {rangeMode === "custom" && (
        <>
          <input
            type="date"
            value={startDate || ""}
            onChange={(e) => navigate({ range: "custom", startDate: e.target.value, endDate: endDate || "" })}
            className="h-9 rounded-lg border border-border/70 bg-card px-2.5 text-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <span className="text-[12px] text-muted-foreground">to</span>
          <input
            type="date"
            value={endDate || ""}
            onChange={(e) => navigate({ range: "custom", startDate: startDate || "", endDate: e.target.value })}
            className="h-9 rounded-lg border border-border/70 bg-card px-2.5 text-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </>
      )}

      <span className="mx-1 h-5 w-px bg-border/60" />

      <Link
        href={`/reports?year=${year}&month=${month}`}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/70 bg-card px-3 text-[13px] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-muted"
      >
        <FileBarChart className="h-3.5 w-3.5" />
        Detailed Report
      </Link>
    </div>
  );
}
