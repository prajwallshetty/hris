"use client";

import { AlertCircle, AlertTriangle, Bell, Info } from "lucide-react";
import Link from "next/link";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NotificationItem } from "@/server/queries/notifications";

const SEVERITY_ICON = { info: Info, warning: AlertTriangle, critical: AlertCircle };
const SEVERITY_CLASS = { info: "text-info", warning: "text-warning", critical: "text-destructive" };

export function NotificationsDropdown({ notifications }: { notifications: NotificationItem[] }) {
  const preview = notifications.slice(0, 8);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="size-4.5" />
            {notifications.length > 0 && (
              <span className="bg-destructive text-destructive-foreground absolute top-1 right-1 flex size-4 items-center justify-center rounded-full text-[10px] font-medium">
                {notifications.length > 9 ? "9+" : notifications.length}
              </span>
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {preview.length === 0 ? (
          <p className="text-muted-foreground px-2 py-4 text-center text-sm">You&apos;re all caught up.</p>
        ) : (
          preview.map((n) => {
            const Icon = SEVERITY_ICON[n.severity];
            return (
              <DropdownMenuItem key={n.id} render={<Link href={n.href} />} className="items-start gap-2 whitespace-normal">
                <Icon className={cn("mt-0.5 size-4 shrink-0", SEVERITY_CLASS[n.severity])} />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-muted-foreground text-xs">{n.message}</p>
                </div>
              </DropdownMenuItem>
            );
          })
        )}
        {notifications.length > preview.length && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/notifications" />} className="justify-center text-sm">
              View all {notifications.length} notifications
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
