"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

export function IncomeExpenseChart({ income, expenses }: { income: number; expenses: number }) {
  const data = [
    { name: "Income", amount: income, color: "#22c55e" },
    { name: "Expenses", amount: expenses, color: "#ef4444" },
  ];

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data}>
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b6b6b' }} tickLine={false} axisLine={{ stroke: '#d5d5ce' }} />
        <YAxis tick={{ fontSize: 11, fill: '#6b6b6b' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
        <Tooltip
          formatter={(value) => [`$${Number(value).toFixed(2)}`]}
          contentStyle={{
            borderRadius: '8px',
            border: '1px solid #d5d5ce',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            fontSize: '13px',
          }}
        />
        <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
