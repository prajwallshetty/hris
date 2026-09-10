"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";

/** URL-param-driven month picker, matching SearchInput/SelectFilter's
 * pattern of encoding filter state in the query string. */
export function MonthFilter({ paramKey = "month" }: { paramKey?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value = searchParams.get(paramKey) ?? "";

  function handleChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) {
      params.set(paramKey, next);
    } else {
      params.delete(paramKey);
    }
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <Input
      type="month"
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      className="w-full sm:w-40"
      aria-label="Filter by month"
    />
  );
}
