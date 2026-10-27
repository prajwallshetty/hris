import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ConnectionStatus } from "@/components/pwa/connection-status";
import { InstallButton } from "@/components/pwa/install-button";
import { AppHeader } from "@/components/shared/app-header";

// Application shell (§ redesign): two-level top navigation over a
// full-width light blue-grey workspace. No sidebar at any width — below
// 1024px the module tabs move into a drawer while the shortcut ribbon stays.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const name = session.user.name ?? session.user.email ?? "User";
  const email = session.user.email ?? "";
  const role = session.user.role;

  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader
        role={role}
        name={name}
        email={email}
        statusSlot={
          <>
            <ConnectionStatus />
            <InstallButton />
          </>
        }
      />
      <main className="w-full min-w-0 flex-1 overflow-x-hidden px-3 py-5 sm:px-5 lg:px-6 lg:py-6">{children}</main>
    </div>
  );
}
