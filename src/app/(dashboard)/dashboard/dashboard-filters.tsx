"use client";

import { CalendarDays, MapPin } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function DashboardFilters({
  month,
  months,
  siteId,
  sites,
}: {
  month: string;
  months: { key: string; label: string }[];
  siteId: string;
  sites: { id: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(key: string, value: string | null, fallback: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === fallback) params.delete(key);
    else params.set(key, value);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const monthItems = months.map((m) => ({ value: m.key, label: m.label }));
  const siteItems = [{ value: "ALL", label: "All Sites" }, ...sites.map((s) => ({ value: s.id, label: s.label }))];

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Select value={month} onValueChange={(v) => update("month", v, months[0]?.key ?? "")} items={monthItems}>
        <SelectTrigger className="h-11 w-full bg-white sm:w-52" aria-label="Month">
          <CalendarDays className="text-muted-foreground size-4" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {monthItems.map((m) => (
            <SelectItem key={m.value} value={m.value}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={siteId || "ALL"} onValueChange={(v) => update("site", v, "ALL")} items={siteItems}>
        <SelectTrigger className="h-11 w-full bg-white sm:w-52" aria-label="Site">
          <MapPin className="text-muted-foreground size-4" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {siteItems.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
