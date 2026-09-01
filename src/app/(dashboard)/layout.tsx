import { Building2, Menu } from "lucide-react";
import { redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "@/auth";
import { DesktopSidebar } from "@/components/shared/desktop-sidebar";
import { GlobalSearch } from "@/components/shared/global-search";
import { NotificationsBell } from "@/components/shared/notifications-bell";
import { QuickCreateMenu } from "@/components/shared/quick-create-menu";
import { SidebarNav } from "@/components/shared/sidebar-nav";
import { UserMenu } from "@/components/shared/user-menu";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex min-h-svh">
      <DesktopSidebar role={session.user.role} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/95 sticky top-0 z-10 flex h-14 items-center justify-between gap-2 border-b px-4 backdrop-blur">
          <Sheet>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="size-5" />
                </Button>
              }
            />
            <SheetContent side="left" className="w-64 p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <div className="flex h-14 items-center gap-2 border-b px-4">
                <div className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md">
                  <Building2 className="size-4" />
                </div>
                <span className="font-semibold">Manpower HRIS</span>
              </div>
              <div className="p-3">
                <SidebarNav role={session.user.role} />
              </div>
            </SheetContent>
          </Sheet>

          <Link href="/dashboard" className="font-semibold md:hidden">
            Manpower HRIS
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <GlobalSearch />
            <QuickCreateMenu role={session.user.role} />
            <NotificationsBell />
            <UserMenu
              name={session.user.name ?? session.user.email ?? "User"}
              email={session.user.email ?? ""}
              role={session.user.role}
            />
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
