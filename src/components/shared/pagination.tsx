"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export function Pagination({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function hrefForPage(target: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(target));
    return `${pathname}?${params.toString()}`;
  }

  if (total === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between px-2 py-3">
      <p className="text-muted-foreground text-sm">
        Showing <span className="font-medium">{start}</span>–
        <span className="font-medium">{end}</span> of{" "}
        <span className="font-medium">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          render={
            <Link href={hrefForPage(Math.max(1, page - 1))} aria-disabled={page <= 1}>
              <ChevronLeft className="size-4" />
              Previous
            </Link>
          }
        />
        <span className="text-muted-foreground text-sm">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          render={
            <Link href={hrefForPage(Math.min(totalPages, page + 1))} aria-disabled={page >= totalPages}>
              Next
              <ChevronRight className="size-4" />
            </Link>
          }
        />
      </div>
    </div>
  );
}
