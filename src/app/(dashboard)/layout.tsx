import { redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "@/auth";
import { GlobalSearch } from "@/components/shared/global-search";
import { Logo } from "@/components/shared/logo";
import { ConnectionStatus } from "@/components/pwa/connection-status";
import { InstallButton } from "@/components/pwa/install-button";
import { MobileNav } from "@/components/shared/mobile-nav";
import { QuickCreateMenu } from "@/components/shared/quick-create-menu";
import { TopRibbonNav } from "@/components/shared/top-ribbon-nav";
import { UserMenu } from "@/components/shared/user-menu";

// Classic ERP ribbon shell (§ ribbon redesign): no permanent sidebar — full
// screen width, a slim header, and a horizontal module ribbon underneath it
// on desktop. Mobile/tablet keep a working overlay menu (MobileNav) instead
// of the ribbon, since there's no room for icon rows at that width.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const name = session.user.name ?? session.user.email ?? "User";
  const email = session.user.email ?? "";
  const role = session.user.role;

  return (
    <div className="flex min-h-svh flex-col">
      <header className="bg-background/95 sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b px-3 backdrop-blur md:px-4">
        <MobileNav role={role} userMenu={<UserMenu name={name} email={email} role={role} />} />

        <Link href="/dashboard" className="flex shrink-0 items-center">
          <Logo size="ribbon" className="hidden md:block" />
          <Logo size="sidebar" className="md:hidden" />
        </Link>

        <div className="hidden min-w-0 max-w-sm flex-1 md:block">
          <GlobalSearch />
        </div>
        <div className="flex-1 md:hidden" />

        <div className="flex shrink-0 items-center gap-1.5">
          <div className="md:hidden">
            <GlobalSearch collapsed />
          </div>
          <ConnectionStatus />
          <InstallButton />
          <QuickCreateMenu role={role} />
          <div className="hidden md:block">
            <UserMenu name={name} email={email} role={role} />
          </div>
        </div>
      </header>

      <TopRibbonNav role={role} />

      <main className="min-w-0 flex-1 overflow-x-hidden p-4 md:p-6">{children}</main>
    </div>
  );
}
