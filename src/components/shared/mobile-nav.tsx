"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Logo } from "@/components/shared/logo";
import { NAV_COLOR_CLASSES, type NavGroup } from "@/components/shared/nav-items";
import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// Below 1024px the module tabs don't fit the top bar, so every module is
// reachable from this drawer (the shortcut ribbon stays visible too). Its
// own open state lets a tapped link close it.
export function MobileNav({
  groups,
  activeHref,
  userMenu,
}: {
  groups: NavGroup[];
  activeHref: string | null;
  userMenu: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {/* A plain <button> render target: nesting Base UI's Sheet.Trigger and
          our Button would set two conflicting `data-slot`s and cause a
          hydration attribute mismatch. */}
      <SheetTrigger
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "lg:hidden")}
        render={<button type="button" aria-label="Menu" />}
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" className="flex w-[300px] max-w-[85vw] flex-col gap-0 bg-slate-50 p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation</SheetTitle>
        </SheetHeader>
        <div className="flex h-16 shrink-0 items-center border-b bg-white px-4">
          <Logo size="ribbon" />
        </div>
        <nav aria-label="Modules" className="flex-1 space-y-4 overflow-y-auto p-3">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="text-muted-foreground mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-semibold tracking-wider uppercase">
                <group.icon className="size-3.5" />
                {group.label}
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {group.items.map((item) => {
                  const isActive = item.href === activeHref;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-lg border bg-white px-1 py-2.5 text-center",
                        isActive ? "border-primary/30 bg-accent" : "border-transparent hover:border-slate-200",
                      )}
                    >
                      <item.icon className={cn("size-5", NAV_COLOR_CLASSES[item.color])} />
                      <span className={cn("text-[11px] leading-tight font-medium", isActive ? "text-primary" : "text-slate-700")}>
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t bg-white p-2">{userMenu}</div>
      </SheetContent>
    </Sheet>
  );
}
