"use client";

import type { Role } from "@prisma/client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { GlobalSearch } from "@/components/shared/global-search";
import { Logo } from "@/components/shared/logo";
import { MobileNav } from "@/components/shared/mobile-nav";
import { findActiveNav, navGroupsForRole } from "@/components/shared/nav-items";
import { ModuleRibbon } from "@/components/shared/module-ribbon";
import { QuickCreateMenu } from "@/components/shared/quick-create-menu";
import { UserMenu } from "@/components/shared/user-menu";
import { cn } from "@/lib/utils";

/**
 * The application chrome (§ redesign): a top bar with module tabs, and the
 * colorful shortcut ribbon for the active module beneath it. Both levels
 * derive the active module from the URL, so a deep link always opens with
 * the right tab and shortcut highlighted. No sidebar at any width.
 */
export function AppHeader({
  role,
  name,
  email,
  statusSlot,
}: {
  role: Role;
  name: string;
  email: string;
  /** Server-rendered PWA connection/install indicators. */
  statusSlot?: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const groups = navGroupsForRole(role);
  const active = findActiveNav(groups, pathname, searchParams);
  const activeGroupIndex = active?.groupIndex ?? 0;

  return (
    <header className="sticky top-0 z-30 shadow-[0_1px_0_rgba(15,27,45,0.06)]">
      <div className="flex h-16 items-center gap-2 border-b bg-white px-3 sm:px-4 lg:gap-3">
        <MobileNav groups={groups} activeHref={active?.href ?? null} userMenu={<UserMenu name={name} email={email} role={role} variant="drawer" />} />

        <Link href="/dashboard" className="flex shrink-0 items-center" aria-label="Expand Arabia — Dashboard">
          <Logo size="ribbon" />
        </Link>

        <nav aria-label="Modules" className="ml-2 hidden min-w-0 items-center gap-0.5 lg:flex xl:ml-4 xl:gap-1">
          {groups.map((group, index) => {
            const isActive = index === activeGroupIndex;
            return (
              <Link
                key={group.label}
                href={group.items[0].href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-2 text-[11px] font-medium whitespace-nowrap transition-colors xl:px-3 xl:text-xs",
                  isActive ? "bg-primary text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                <group.icon className="size-5" />
                {group.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex-1" />

        <div className="flex shrink-0 items-center gap-2">
          {statusSlot}
          <QuickCreateMenu role={role} />
          <div className="xl:w-56 2xl:w-72">
            <GlobalSearch />
          </div>
          <div className="hidden h-8 w-px bg-slate-200 lg:block" />
          <div className="hidden lg:block">
            <UserMenu name={name} email={email} role={role} />
          </div>
        </div>
      </div>

      <ModuleRibbon group={groups[activeGroupIndex]} activeHref={active?.href ?? null} />
    </header>
  );
}
