import Image from "next/image";

import { cn } from "@/lib/utils";

// Source asset is a 1774x887 transparent PNG (~2:1) — every size below keeps
// that exact ratio so the logo is never stretched or distorted (§ branding).
const NATURAL_WIDTH = 1774;
const NATURAL_HEIGHT = 887;

const SIZES = {
  sidebar: 28,
  collapsed: 18,
  login: 56,
  document: 44,
} as const;

export type LogoSize = keyof typeof SIZES;

/**
 * The one reusable Expand Arabia logo component (§ branding) — every
 * surface (sidebar, login, receipts/invoices/reports) renders the same
 * transparent PNG through this component rather than re-embedding it, so
 * sizing stays consistent and proportional everywhere.
 */
export function Logo({ size = "sidebar", className }: { size?: LogoSize; className?: string }) {
  const height = SIZES[size];
  const width = Math.round((height * NATURAL_WIDTH) / NATURAL_HEIGHT);

  return (
    <Image
      src="/branding/expand-arabia-logo.png"
      alt="Expand Arabia"
      width={width}
      height={height}
      priority={size === "login"}
      className={cn("h-auto w-auto object-contain", className)}
      style={{ height, width }}
    />
  );
}
