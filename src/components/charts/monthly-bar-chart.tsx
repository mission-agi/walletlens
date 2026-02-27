"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface DataItem {
  month: string;
  total: number;
}

export function MonthlyBarChart({ data }: { data: DataItem[] }) {
  if (data.length === 0 || data.every((d) => d.total === 0)) {
    return <p className="py-8 text-center text-[13px] text-muted-foreground">No spending data</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} barCategoryGap="25%">
        <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e3" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: '#888' }}
          axisLine={{ stroke: '#d5d5ce' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#888' }}
          tickFormatter={(v) => `$${v.toLocaleString()}`}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value) => [`$${Number(value).toFixed(2)}`, "Spending"]}
          contentStyle={{
            borderRadius: '8px',
            border: '1px solid #d5d5ce',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            fontSize: '13px',
          }}
        />
        <Bar dataKey="total" fill="#1a6b4a" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
