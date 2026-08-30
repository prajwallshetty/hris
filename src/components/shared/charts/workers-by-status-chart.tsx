"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function toLabel(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

// Single series (each bar is a distinct status, already distinguished by
// its label) — one restrained hue rather than a rainbow per category.
export function WorkersByStatusChart({ data }: { data: { status: string; count: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: toLabel(d.status) }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(160, rows.length * 36)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }} barCategoryGap={10}>
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis type="number" allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
        <YAxis
          type="category"
          dataKey="label"
          width={100}
          tick={{ fill: "var(--foreground)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)" }}
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            fontSize: 12,
            color: "var(--popover-foreground)",
          }}
          formatter={(value) => [value, "Workers"]}
        />
        <Bar dataKey="count" fill="var(--chart-1)" radius={[0, 4, 4, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}
