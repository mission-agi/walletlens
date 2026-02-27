"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";

export function AnnualYearSelector({ year }: { year: number }) {
  const router = useRouter();

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="flex gap-3">
      <Select
        value={year}
        onChange={(e) => router.push(`/annual?year=${e.target.value}`)}
        className="w-28"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </Select>
    </div>
  );
}
