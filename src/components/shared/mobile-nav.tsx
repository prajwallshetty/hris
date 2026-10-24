"use client";

import type { Role } from "@prisma/client";
import { Menu } from "lucide-react";
import { useState } from "react";

import { GlobalSearch } from "@/components/shared/global-search";
import { Logo } from "@/components/shared/logo";
import { SidebarNav } from "@/components/shared/sidebar-nav";
import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// Mobile/tablet's working overlay menu (§ ribbon redesign §5 — no permanent
// sidebar at this width, so this is the nav). Needs its own open state (not
// just <Sheet>'s default) so a tapped nav link can close it — otherwise the
// overlay stays open on top of the page it just navigated to.
export function MobileNav({
  role,
  userMenu,
}: {
  role: Role;
  userMenu: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {/* A plain <button>, not our <Button> wrapper, as the render target
          here: Base UI's Sheet.Trigger and Button both set their own
          `data-slot` via the same render-prop/cloneElement path, and
          nesting two such components produces a real (if harmless)
          SSR/hydration attribute mismatch every time this header renders.
          A host element has no `data-slot` of its own to collide with. */}
      <SheetTrigger
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "md:hidden")}
        render={<button type="button" aria-label="Menu" />}
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" className="flex w-64 flex-col gap-0 p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation</SheetTitle>
        </SheetHeader>
        <div className="flex h-16 items-center gap-2 border-b px-4">
          <Logo size="sidebar" />
        </div>
        <div className="border-b p-3">
          <GlobalSearch />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <SidebarNav role={role} onNavigate={() => setOpen(false)} />
        </div>
        <div className="space-y-0.5 border-t p-2">{userMenu}</div>
      </SheetContent>
    </Sheet>
  );
}
