"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface DataItem {
  day: number;
  amount: number;
}

export function DailySpendingChart({ data }: { data: DataItem[] }) {
  if (data.every((d) => d.amount === 0)) {
    return <p className="py-8 text-center text-[13px] text-muted-foreground">No spending data</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart data={data}>
        <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6b6b6b' }} tickLine={false} axisLine={{ stroke: '#d5d5ce' }} />
        <YAxis tick={{ fontSize: 11, fill: '#6b6b6b' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
        <Tooltip
          formatter={(value) => [`$${Number(value).toFixed(2)}`, "Spending"]}
          contentStyle={{
            borderRadius: '8px',
            border: '1px solid #d5d5ce',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            fontSize: '13px',
          }}
        />
        <Area
          type="monotone"
          dataKey="amount"
          stroke="#1a6b4a"
          fill="#1a6b4a"
          fillOpacity={0.08}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
