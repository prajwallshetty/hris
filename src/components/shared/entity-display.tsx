"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User, Building2, MapPin, Truck, Wrench, FileText, UserCheck, Briefcase } from "lucide-react";

export interface EntityDisplayProps {
  type:
    | "worker"
    | "client"
    | "project"
    | "site"
    | "coordinator"
    | "vehicle"
    | "equipment"
    | "employee"
    | "invoice"
    | "assignment";
  id?: string;
  title: string;
  subtitle?: string | null;
  href?: string;
  badge?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  showAvatar?: boolean;
}

export function EntityDisplay({
  type,
  title,
  subtitle,
  href,
  badge,
  size = "md",
  className,
  showAvatar = true,
}: EntityDisplayProps) {
  // Get icon based on entity type
  const getIcon = () => {
    switch (type) {
      case "worker":
        return <User className="size-3.5" />;
      case "client":
        return <Building2 className="size-3.5" />;
      case "project":
        return <Briefcase className="size-3.5" />;
      case "site":
        return <MapPin className="size-3.5" />;
      case "coordinator":
        return <UserCheck className="size-3.5" />;
      case "vehicle":
        return <Truck className="size-3.5" />;
      case "equipment":
        return <Wrench className="size-3.5" />;
      case "employee":
        return <User className="size-3.5" />;
      case "invoice":
        return <FileText className="size-3.5" />;
      default:
        return <User className="size-3.5" />;
    }
  };

  // Get initials for avatar
  const initials = title
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const content = (
    <div className={cn("inline-flex items-center gap-2.5 min-w-0 max-w-full", className)}>
      {showAvatar && (
        <Avatar
          className={cn(
            "shrink-0 bg-primary/10 text-primary border border-primary/20",
            size === "sm" && "size-6 text-[10px]",
            size === "md" && "size-8 text-xs font-semibold",
            size === "lg" && "size-10 text-sm font-bold"
          )}
        >
          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
            {initials || getIcon()}
          </AvatarFallback>
        </Avatar>
      )}
      <div className="flex flex-col min-w-0 leading-tight">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={cn(
              "font-medium text-foreground truncate",
              size === "sm" && "text-xs",
              size === "md" && "text-sm",
              size === "lg" && "text-base font-semibold"
            )}
          >
            {title}
          </span>
          {badge && (
            <Badge variant="outline" className="text-[10px] uppercase font-semibold px-1 py-0 h-4 shrink-0">
              {badge}
            </Badge>
          )}
        </div>
        {subtitle && (
          <span
            className={cn(
              "text-muted-foreground truncate",
              size === "sm" && "text-[10px]",
              size === "md" && "text-xs",
              size === "lg" && "text-xs"
            )}
          >
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="hover:underline focus:outline-none focus:ring-1 focus:ring-primary rounded">
        {content}
      </Link>
    );
  }

  return content;
}
