"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface DataItem {
  category: string;
  current: number;
  previous: number;
  color: string;
}

export function CategoryComparisonChart({ data }: { data: DataItem[] }) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-[13px] text-muted-foreground">No category data</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical">
        <XAxis type="number" tick={{ fontSize: 11, fill: '#6b6b6b' }} tickLine={false} axisLine={{ stroke: '#d5d5ce' }} tickFormatter={(v) => `$${v}`} />
        <YAxis dataKey="category" type="category" tick={{ fontSize: 11, fill: '#6b6b6b' }} tickLine={false} axisLine={false} width={100} />
        <Tooltip
          formatter={(value) => [`$${Number(value).toFixed(2)}`]}
          contentStyle={{
            borderRadius: '8px',
            border: '1px solid #d5d5ce',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            fontSize: '13px',
          }}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
        <Bar dataKey="current" name="This Month" fill="#1a6b4a" radius={[0, 4, 4, 0]} />
        <Bar dataKey="previous" name="Last Month" fill="#d5d5ce" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
