"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface MonthData {
  monthName: string;
  current: number;
  previous: number;
}

export function YearComparisonChart({
  data,
  currentYear,
  previousYear,
}: {
  data: MonthData[];
  currentYear: number;
  previousYear: number;
}) {
  if (data.length === 0 || data.every((d) => d.current === 0 && d.previous === 0)) {
    return (
      <p className="py-8 text-center text-[13px] text-muted-foreground">
        No spending data for comparison
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data}>
        <XAxis dataKey="monthName" tick={{ fontSize: 11, fill: '#6b6b6b' }} tickLine={false} axisLine={{ stroke: '#d5d5ce' }} />
        <YAxis tick={{ fontSize: 11, fill: '#6b6b6b' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
        <Tooltip
          formatter={(value) => [`$${Number(value).toFixed(2)}`, "Amount"]}
          contentStyle={{
            borderRadius: '8px',
            border: '1px solid #d5d5ce',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            fontSize: '13px',
          }}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
        <Bar
          dataKey="current"
          name={String(currentYear)}
          fill="#1a6b4a"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="previous"
          name={String(previousYear)}
          fill="#d5d5ce"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
