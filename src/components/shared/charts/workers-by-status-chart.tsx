"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

function toLabel(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

// Colour by meaning, not position: the same status is the same colour
// wherever it appears, and matches StatusBadge's tones.
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "#16a34a",
  AVAILABLE: "#1f6fe5",
  ON_LEAVE: "#f08a24",
  SUSPENDED: "#eab308",
  DEMOBILIZED: "#94a3b8",
  RESIGNED: "#64748b",
  TERMINATED: "#ef4444",
};

/** Donut with the workforce total centred, plus a counted legend. */
export function WorkersByStatusChart({ data }: { data: { status: string; count: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: toLabel(d.status), color: STATUS_COLORS[d.status] ?? "#94a3b8" }));
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div className="relative shrink-0">
        <ResponsiveContainer width={176} height={176}>
          <PieChart>
            <Pie data={rows} dataKey="count" nameKey="label" innerRadius={58} outerRadius={84} paddingAngle={1.5} stroke="none" isAnimationActive={false} startAngle={90} endAngle={-270}>
              {rows.map((row) => (
                <Cell key={row.status} fill={row.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} formatter={(value, name) => [value, name]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-[26px] leading-none font-bold tabular-nums text-slate-900">{total.toLocaleString()}</p>
          <p className="text-muted-foreground mt-1 text-xs">Total Workers</p>
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-2.5">
        {rows.map((row) => (
          <li key={row.status} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
              <span className="truncate text-slate-700">{row.label}</span>
            </span>
            <span className="font-semibold text-slate-900 tabular-nums">{row.count.toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
