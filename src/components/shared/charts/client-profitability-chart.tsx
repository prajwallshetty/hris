"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type ClientProfitabilityRow = { client: string; revenue: number; workerCost: number; profit: number };

function formatMoney(value: number) {
  return `SAR ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

// Three series per client (revenue / worker cost / profit) — the
// categorical palette in fixed order, always paired with the legend below
// since identity here can't rely on position alone.
export function ClientProfitabilityChart({ data }: { data: ClientProfitabilityRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 70)}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }} barGap={4}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="client" tick={{ fill: "var(--foreground)", fontSize: 12 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
        <YAxis
          tickFormatter={(value: number) => formatMoney(value)}
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={80}
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
          formatter={(value) => formatMoney(Number(value))}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} />
        <Bar dataKey="revenue" name="Revenue" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={36} />
        <Bar dataKey="workerCost" name="Worker Cost" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={36} />
        <Bar dataKey="profit" name="Profit" fill="var(--chart-4)" radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}
