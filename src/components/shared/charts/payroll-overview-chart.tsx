"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });

/** Monthly worker payroll split into paid vs still-outstanding (stacked). */
export function PayrollOverviewChart({ data }: { data: { month: string; paid: number; outstanding: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -8 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke="#eef2f7" />
        <XAxis dataKey="month" tick={{ fill: "#5e6b7e", fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis
          tickFormatter={(v: number) => (v === 0 ? "0" : compact.format(v))}
          tick={{ fill: "#5e6b7e", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip
          cursor={{ fill: "rgba(22,96,214,0.05)" }}
          contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}
          formatter={(value, name) => [`SAR ${full.format(Number(value))}`, name === "paid" ? "Paid" : "Outstanding"]}
        />
        <Bar dataKey="paid" stackId="pay" fill="#1f6fe5" maxBarSize={30} isAnimationActive={false} />
        <Bar dataKey="outstanding" stackId="pay" fill="#9cc2f7" radius={[4, 4, 0, 0]} maxBarSize={30} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
