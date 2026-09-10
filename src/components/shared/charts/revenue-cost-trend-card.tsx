"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { RevenueCostTrendChart, type RevenueCostTrendPoint } from "./revenue-cost-trend-chart";

const RANGES = [
  { label: "6M", months: 6 },
  { label: "12M", months: 12 },
  { label: "24M", months: 24 },
] as const;

function formatMoney(value: number) {
  return `SAR ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/** Card shell + range toggle around RevenueCostTrendChart — data for the
 * widest range is fetched once server-side; narrower ranges just slice the
 * same array client-side, no extra round trip. The hero revenue figure and
 * its comparison are both derived from that same array, never a separate
 * fabricated number. */
export function RevenueCostTrendCard({ data }: { data: RevenueCostTrendPoint[] }) {
  const [months, setMonths] = useState(12);
  const start = Math.max(0, data.length - months);
  const sliced = data.slice(start);
  const previous = data.slice(Math.max(0, start - months), start);

  const totalRevenue = sliced.reduce((sum, d) => sum + d.revenue, 0);
  const totalCost = sliced.reduce((sum, d) => sum + d.workerCost, 0);
  const previousRevenue = previous.reduce((sum, d) => sum + d.revenue, 0);
  const hasComparison = previous.length === months;
  const change = hasComparison && previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : null;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Revenue — Trailing {months} Months
          </CardTitle>
          <div className="mt-1.5 flex items-baseline gap-2.5">
            <span className="text-display font-heading text-foreground font-semibold">{formatMoney(totalRevenue)}</span>
            {change !== null && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 text-xs font-medium",
                  change >= 0 ? "text-brand" : "text-destructive",
                )}
              >
                {change >= 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                {Math.abs(change).toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {formatMoney(totalCost)} worker cost · {formatMoney(totalRevenue - totalCost)} net
          </p>
        </div>
        <div className="bg-muted flex items-center gap-0.5 rounded-md p-0.5">
          {RANGES.filter((r) => r.months <= data.length).map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => setMonths(r.months)}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                months === r.months ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {sliced.every((d) => d.revenue === 0 && d.workerCost === 0) ? (
          <p className="text-muted-foreground py-16 text-center text-sm">No billed or paid activity in this range yet.</p>
        ) : (
          <RevenueCostTrendChart data={sliced} />
        )}
        <div className="mt-2 flex items-center gap-4 text-xs">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <span className="bg-brand size-2 rounded-full" />
            Revenue
          </span>
          <span className="text-muted-foreground flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: "var(--chart-2)" }} />
            Worker Cost
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
