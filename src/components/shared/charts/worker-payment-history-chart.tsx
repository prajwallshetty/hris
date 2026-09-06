"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type WorkerPaymentPoint = { date: string; amount: number };

function formatMoney(value: number) {
  return `SAR ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/** Compact salary/payment trend for the Worker Overview tab — real payment ledger data only. */
export function WorkerPaymentHistoryChart({ data }: { data: WorkerPaymentPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="date" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
        <YAxis
          tickFormatter={(value: number) => formatMoney(value)}
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={70}
        />
        <Tooltip
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            fontSize: 12,
            color: "var(--popover-foreground)",
          }}
          formatter={(value) => formatMoney(Number(value))}
        />
        <Line type="monotone" dataKey="amount" name="Amount Paid" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
