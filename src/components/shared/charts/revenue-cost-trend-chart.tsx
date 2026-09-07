"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type RevenueCostTrendPoint = { month: string; revenue: number; workerCost: number };

function formatMoney(value: number) {
  return `SAR ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; dataKey: string; color: string }[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const revenue = payload.find((p) => p.dataKey === "revenue")?.value ?? 0;
  const workerCost = payload.find((p) => p.dataKey === "workerCost")?.value ?? 0;
  return (
    <div className="bg-popover text-popover-foreground rounded-lg border p-3 text-xs shadow-md">
      <p className="mb-1.5 font-medium">{label}</p>
      <div className="flex items-center justify-between gap-6">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: "var(--chart-1)" }} />
          Revenue
        </span>
        <span className="font-medium tabular-nums">{formatMoney(revenue)}</span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-6">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: "var(--chart-2)" }} />
          Worker Cost
        </span>
        <span className="font-medium tabular-nums">{formatMoney(workerCost)}</span>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-6 border-t pt-1.5">
        <span className="text-muted-foreground">Net</span>
        <span className="font-semibold tabular-nums">{formatMoney(revenue - workerCost)}</span>
      </div>
    </div>
  );
}

/** The dashboard's primary chart (§ redesign reference "Consolidated
 * budget") — monthly Revenue vs Worker Cost, real data only. */
export function RevenueCostTrendChart({ data }: { data: RevenueCostTrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
        <defs>
          <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.25} />
            <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="costFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.2} />
            <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="month" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
        <YAxis
          tickFormatter={(value: number) => formatMoney(value)}
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={80}
        />
        <Tooltip content={<TrendTooltip />} />
        <Area type="monotone" dataKey="revenue" name="Revenue" stroke="var(--chart-1)" strokeWidth={2} fill="url(#revenueFill)" />
        <Area type="monotone" dataKey="workerCost" name="Worker Cost" stroke="var(--chart-2)" strokeWidth={2} fill="url(#costFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
