"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface DataItem {
  category: string;
  total: number;
  color: string;
}

const OTHER_COLOR = "#d1d5db";

/**
 * Group categories under 5% into a single "Other" slice
 * to prevent label overlap on the pie chart.
 */
function groupSmallCategories(data: DataItem[]): DataItem[] {
  const grandTotal = data.reduce((sum, d) => sum + d.total, 0);
  if (grandTotal === 0) return data;

  const major: DataItem[] = [];
  let otherTotal = 0;

  for (const d of data) {
    if (d.total / grandTotal >= 0.05) {
      major.push(d);
    } else {
      otherTotal += d.total;
    }
  }

  if (otherTotal > 0) {
    major.push({ category: "Other", total: otherTotal, color: OTHER_COLOR });
  }

  return major;
}

export function SpendingPieChart({ data }: { data: DataItem[] }) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-[13px] text-muted-foreground">No spending data</p>;
  }

  const chartData = groupSmallCategories(data);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={65}
          outerRadius={95}
          paddingAngle={chartData.length > 1 ? 3 : 0}
          dataKey="total"
          nameKey="category"
          stroke="none"
          label={({ name, percent }) => {
            const pct = (percent ?? 0) * 100;
            if (pct < 5) return null;
            return `${name || ""} ${pct.toFixed(0)}%`;
          }}
          labelLine={true}
        >
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => [`$${Number(value).toFixed(2)}`, "Amount"]}
          contentStyle={{
            borderRadius: '8px',
            border: '1px solid #d5d5ce',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            fontSize: '13px',
          }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
