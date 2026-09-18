import { Menu } from "lucide-react";
import { redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "@/auth";
import { DesktopSidebar } from "@/components/shared/desktop-sidebar";
import { GlobalSearch } from "@/components/shared/global-search";
import { Logo } from "@/components/shared/logo";
import { ConnectionStatus } from "@/components/pwa/connection-status";
import { InstallButton } from "@/components/pwa/install-button";
import { QuickCreateMenu } from "@/components/shared/quick-create-menu";
import { SidebarNav } from "@/components/shared/sidebar-nav";
import { UserMenu } from "@/components/shared/user-menu";
import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const name = session.user.name ?? session.user.email ?? "User";
  const email = session.user.email ?? "";
  const role = session.user.role;

  return (
    <div className="flex min-h-svh">
      <DesktopSidebar role={role} userMenu={<UserMenu name={name} email={email} role={role} />} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/95 sticky top-0 z-10 flex h-16 items-center justify-between gap-2 border-b px-4 backdrop-blur md:justify-end">
          <Sheet>
            {/* A plain <button>, not our <Button> wrapper, as the render
                target here: Base UI's Sheet.Trigger and Button both set
                their own `data-slot` via the same render-prop/cloneElement
                path, and nesting two such components produces a real (if
                harmless) SSR/hydration attribute mismatch every time this
                header renders. A host element has no `data-slot` of its
                own to collide with. */}
            <SheetTrigger
              className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "md:hidden")}
              render={<button type="button" />}
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
                <SidebarNav role={role} />
              </div>
              <div className="space-y-0.5 border-t p-2">
                <UserMenu name={name} email={email} role={role} />
              </div>
            </SheetContent>
          </Sheet>

          <Link href="/dashboard" className="md:hidden">
            <Logo size="sidebar" />
          </Link>

          <div className="flex items-center gap-2">
            <ConnectionStatus />
            <InstallButton />
            <QuickCreateMenu role={role} />
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
