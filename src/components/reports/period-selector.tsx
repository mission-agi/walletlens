"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Select } from "@/components/ui/select";
import { CalendarRange } from "lucide-react";

export function PeriodSelector({ year, month }: { year: number; month: number }) {
  const router = useRouter();

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: new Date(2024, i).toLocaleDateString("en-US", { month: "long" }),
  }));

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="flex items-center gap-2 animate-fade-in-up">
      <Select
        value={month}
        onChange={(e) => router.push(`/reports?year=${year}&month=${e.target.value}`)}
        className="w-auto"
      >
        {months.map((m) => (
          <option key={m.value} value={m.value}>{m.label}</option>
        ))}
      </Select>
      <Select
        value={year}
        onChange={(e) => router.push(`/reports?year=${e.target.value}&month=${month}`)}
        className="w-auto"
      >
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </Select>
      <span className="mx-1 h-5 w-px bg-border/60" />
      <Link
        href={`/annual?year=${year}`}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/70 bg-card px-3 text-[13px] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-muted"
      >
        <CalendarRange className="h-3.5 w-3.5" />
        Annual View
      </Link>
    </div>
  );
}
