"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

function toLabel(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

const SLICE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

// Donut (§ dashboard redesign reference "Worker Status" chart), with the
// workforce total centered — each status gets a stable color by its
// position in WORKER_STATUS_ORDER (see getWorkersByStatus), not a random
// re-shuffle per render.
export function WorkersByStatusChart({ data }: { data: { status: string; count: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: toLabel(d.status) }));
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="relative shrink-0">
        <ResponsiveContainer width={180} height={180}>
          <PieChart>
            <Pie data={rows} dataKey="count" nameKey="label" innerRadius={58} outerRadius={82} paddingAngle={2} stroke="none">
              {rows.map((row, index) => (
                <Cell key={row.status} fill={SLICE_COLORS[index % SLICE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                fontSize: 12,
                color: "var(--popover-foreground)",
              }}
              formatter={(value, name) => [value, name]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-2xl font-semibold tabular-nums">{total.toLocaleString()}</p>
          <p className="text-muted-foreground text-xs">Total Workers</p>
        </div>
      </div>

      <ul className="min-w-0 flex-1 space-y-1.5">
        {rows.map((row, index) => (
          <li key={row.status} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: SLICE_COLORS[index % SLICE_COLORS.length] }}
              />
              <span className="truncate text-foreground">{row.label}</span>
            </span>
            <span className="text-muted-foreground font-medium tabular-nums">{row.count.toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
