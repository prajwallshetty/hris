"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function SelectFilter({
  paramKey,
  placeholder,
  options,
}: {
  paramKey: string;
  placeholder: string;
  options: { label: string; value: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value = searchParams.get(paramKey) ?? "ALL";

  function handleChange(next: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!next || next === "ALL") {
      params.delete(paramKey);
    } else {
      params.set(paramKey, next);
    }
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger className="w-full sm:w-48">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ALL">All</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
