import { Menu } from "lucide-react";
import { redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "@/auth";
import { DesktopSidebar } from "@/components/shared/desktop-sidebar";
import { GlobalSearch } from "@/components/shared/global-search";
import { Logo } from "@/components/shared/logo";
import { NotificationsBell } from "@/components/shared/notifications-bell";
import { QuickCreateMenu } from "@/components/shared/quick-create-menu";
import { SidebarNav } from "@/components/shared/sidebar-nav";
import { UserMenu } from "@/components/shared/user-menu";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const name = session.user.name ?? session.user.email ?? "User";
  const email = session.user.email ?? "";
  const role = session.user.role;

  return (
    <div className="flex min-h-svh">
      <DesktopSidebar role={role} notifications={<NotificationsBell />} userMenu={<UserMenu name={name} email={email} role={role} />} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/95 sticky top-0 z-10 flex h-16 items-center justify-between gap-2 border-b px-4 backdrop-blur md:justify-end">
          <Sheet>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="size-5" />
                </Button>
              }
            />
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
                <SidebarNav role={role} />
              </div>
              <div className="space-y-0.5 border-t p-2">
                <NotificationsBell />
                <UserMenu name={name} email={email} role={role} />
              </div>
            </SheetContent>
          </Sheet>

          <Link href="/dashboard" className="md:hidden">
            <Logo size="sidebar" />
          </Link>

          <QuickCreateMenu role={role} />
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
