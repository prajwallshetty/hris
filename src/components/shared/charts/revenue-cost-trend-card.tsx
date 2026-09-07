"use client";

import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { RevenueCostTrendChart, type RevenueCostTrendPoint } from "./revenue-cost-trend-chart";

const RANGES = [
  { label: "6M", months: 6 },
  { label: "12M", months: 12 },
  { label: "24M", months: 24 },
] as const;

/** Card shell + range toggle around RevenueCostTrendChart — data for the
 * widest range is fetched once server-side; narrower ranges just slice the
 * same array client-side, no extra round trip. */
export function RevenueCostTrendCard({ data }: { data: RevenueCostTrendPoint[] }) {
  const [months, setMonths] = useState(12);
  const sliced = data.slice(Math.max(0, data.length - months));

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Consolidated Budget</CardTitle>
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
      </CardContent>
    </Card>
  );
}
