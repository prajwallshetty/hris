import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white/70 px-6 py-14 text-center">
      <div className="bg-accent text-primary flex size-14 items-center justify-center rounded-2xl">
        <Icon className="size-7" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-semibold text-slate-900">{title}</p>
        {description && <p className="text-muted-foreground max-w-md text-sm">{description}</p>}
      </div>
      {action}
    </div>
  );
}
