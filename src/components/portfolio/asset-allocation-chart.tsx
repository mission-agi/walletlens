"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface HoldingData {
  symbol: string;
  currentValue: number;
}

// Distinct colors for top holdings
const COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#14b8a6", "#6366f1",
  "#84cc16", "#e11d48", "#0ea5e9", "#a855f7", "#d946ef",
];

export function AssetAllocationChart({ holdings }: { holdings: HoldingData[] }) {
  if (holdings.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No holdings data
      </p>
    );
  }

  const totalValue = holdings.reduce((s, h) => s + h.currentValue, 0);

  // Sort by value, group smaller ones into "Other"
  const sorted = [...holdings].sort((a, b) => b.currentValue - a.currentValue);
  const top = sorted.slice(0, 10);
  const rest = sorted.slice(10);
  const restValue = rest.reduce((s, h) => s + h.currentValue, 0);

  const chartData = top.map((h) => ({
    name: h.symbol,
    value: h.currentValue,
    pct: totalValue > 0 ? (h.currentValue / totalValue) * 100 : 0,
  }));

  if (restValue > 0) {
    chartData.push({
      name: "Other",
      value: restValue,
      pct: totalValue > 0 ? (restValue / totalValue) * 100 : 0,
    });
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={110}
          paddingAngle={chartData.length > 1 ? 2 : 0}
          dataKey="value"
          nameKey="name"
          stroke="#e5e7eb"
          strokeWidth={1}
          label={(props) => {
            const pct = (props.percent || 0) * 100;
            return pct >= 5
              ? `${props.name || ""} ${pct.toFixed(0)}%`
              : "";
          }}
          labelLine={true}
        >
          {chartData.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => [
            `$${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            "Value",
          ]}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
