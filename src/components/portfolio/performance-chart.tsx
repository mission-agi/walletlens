"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface DataPoint {
  date: string;
  value: number;
  costBasis: number;
}

export function PerformanceChart({ data }: { data: DataPoint[] }) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Not enough data for performance chart
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="valueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#9ca3af" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#9ca3af" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12 }}
          tickFormatter={(v) => {
            const d = new Date(v);
            return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
          }}
        />
        <YAxis
          tick={{ fontSize: 12 }}
          tickFormatter={(v) =>
            `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)}`
          }
        />
        <Tooltip
          labelFormatter={(label: any) => {
            if (!label) return "";
            const d = new Date(label);
            return d.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            });
          }}
          formatter={(value: any, name: any) => {
            const v = typeof value === "number" ? value : 0;
            return [
              `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              name === "value" ? "Portfolio Value" : "Cost Basis",
            ];
          }}
        />
        <Area
          type="monotone"
          dataKey="costBasis"
          name="costBasis"
          stroke="#9ca3af"
          fill="url(#costGradient)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          dot={false}
        />
        <Area
          type="monotone"
          dataKey="value"
          name="value"
          stroke="#3b82f6"
          fill="url(#valueGradient)"
          strokeWidth={2}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
