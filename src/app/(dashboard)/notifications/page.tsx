import { AlertCircle, AlertTriangle, Bell, Info } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { cn } from "@/lib/utils";
import { getNotifications } from "@/server/queries/notifications";
import { getSessionUser } from "@/server/session";

const SEVERITY_ICON = { info: Info, warning: AlertTriangle, critical: AlertCircle };
const SEVERITY_CLASS = { info: "text-info", warning: "text-warning", critical: "text-destructive" };

export default async function NotificationsPage() {
  const user = await getSessionUser();
  const notifications = await getNotifications(user);

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Notifications"
        description="Live alerts computed from current data — expiring documents, pending approvals, and amounts due."
      />

      {notifications.length === 0 ? (
        <EmptyState icon={Bell} title="You're all caught up" description="No pending alerts right now." />
      ) : (
        <div className="divide-border divide-y rounded-lg border">
          {notifications.map((n) => {
            const Icon = SEVERITY_ICON[n.severity];
            return (
              <Link key={n.id} href={n.href} className="hover:bg-muted/50 flex items-start gap-3 p-4 transition-colors">
                <Icon className={cn("mt-0.5 size-5 shrink-0", SEVERITY_CLASS[n.severity])} />
                <div className="min-w-0">
                  <p className="font-medium">{n.title}</p>
                  <p className="text-muted-foreground text-sm">{n.message}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
