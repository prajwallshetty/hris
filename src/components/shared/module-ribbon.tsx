import Link from "next/link";

import { NAV_COLOR_CLASSES, type NavGroup } from "@/components/shared/nav-items";
import { cn } from "@/lib/utils";

/**
 * Second-level navigation: the active module's shortcuts as colorful icon
 * tiles, captioned with the module name (§ redesign reference). Scrolls
 * horizontally instead of wrapping on narrow screens, so it stays one
 * compact row from 320px phones to 1920px monitors.
 */
export function ModuleRibbon({ group, activeHref }: { group: NavGroup | undefined; activeHref: string | null }) {
  if (!group) return null;

  return (
    <div className="border-b bg-white/95 backdrop-blur">
      <div className="flex items-end gap-4 overflow-x-auto px-2 py-1.5 sm:px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex shrink-0 flex-col items-center gap-0.5">
          <div className="flex items-stretch gap-0.5">
            {group.items.map((item) => {
              const isActive = item.href === activeHref;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex w-[72px] shrink-0 flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-center transition-colors sm:w-[84px]",
                    isActive ? "bg-accent ring-primary/20 ring-1" : "hover:bg-slate-100",
                  )}
                >
                  <item.icon className={cn("size-5 sm:size-6", NAV_COLOR_CLASSES[item.color])} strokeWidth={1.9} />
                  <span
                    className={cn(
                      "line-clamp-2 text-[11px] leading-tight font-medium",
                      isActive ? "text-primary" : "text-slate-700",
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
          <span className="text-muted-foreground hidden text-[10.5px] font-medium tracking-wide sm:block">{group.label}</span>
        </div>
      </div>
    </div>
  );
}
