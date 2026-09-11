"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  searchWorkerOptions,
  searchClientOptions,
  searchProjectOptions,
  searchSiteOptions,
  searchCoordinatorOptions,
  searchVehicleOptions,
  searchEquipmentOptions,
  searchEmployeeOptions,
  searchInvoiceOptions,
  getEntityLabel,
} from "@/server/actions/entity-search";

export type EntityType =
  | "worker"
  | "client"
  | "project"
  | "site"
  | "coordinator"
  | "vehicle"
  | "equipment"
  | "employee"
  | "invoice";

export type EntityOption = {
  id: string;
  title: string;
  subtitle?: string | null;
  badge?: string | null;
  raw?: unknown;
};

interface EntityComboboxProps {
  entityType: EntityType;
  value?: string | null;
  onChange: (value: string, selectedRecord?: unknown) => void;
  placeholder?: string;
  parentValue?: string | null;
  disabled?: boolean;
  readOnly?: boolean;
  initialOptions?: EntityOption[];
  allowClear?: boolean;
  className?: string;
  error?: string;
  required?: boolean;
  id?: string;
}

export function EntityCombobox({
  entityType,
  value,
  onChange,
  placeholder,
  parentValue,
  disabled = false,
  readOnly = false,
  initialOptions = [],
  allowClear = true,
  className,
  error,
  required = false,
  id,
}: EntityComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [options, setOptions] = React.useState<EntityOption[]>(initialOptions);
  const [fetchedLabel, setFetchedLabel] = React.useState<{ title: string; subtitle?: string } | null>(null);
  const [resolvingInitial, setResolvingInitial] = React.useState(false);

  // Default placeholder per entity type
  const defaultPlaceholder = React.useMemo(() => {
    if (placeholder) return placeholder;
    switch (entityType) {
      case "worker":
        return "Search worker by name or Iqama...";
      case "client":
        return "Search client company...";
      case "project":
        return "Search project...";
      case "site":
        return "Search site location...";
      case "coordinator":
        return "Search coordinator...";
      case "vehicle":
        return "Search vehicle plate or make...";
      case "equipment":
        return "Search equipment name or serial...";
      case "employee":
        return "Search employee...";
      case "invoice":
        return "Search invoice number...";
    }
  }, [entityType, placeholder]);

  // Derived selected label matching options in state
  const matchInOptions = React.useMemo(
    () => options.find((o) => o.id === value),
    [options, value]
  );

  const selectedLabel = React.useMemo(() => {
    if (matchInOptions) {
      return { title: matchInOptions.title, subtitle: matchInOptions.subtitle ?? undefined };
    }
    return fetchedLabel;
  }, [matchInOptions, fetchedLabel]);

  // Fetch label from server if not found in current options list
  React.useEffect(() => {
    if (!value || matchInOptions) {
      return;
    }

    let isSubscribed = true;
    setResolvingInitial(true);
    getEntityLabel(entityType, value)
      .then((res) => {
        if (isSubscribed) {
          setFetchedLabel(res ?? { title: value });
        }
      })
      .finally(() => {
        if (isSubscribed) setResolvingInitial(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [value, entityType, matchInOptions]);

  // Search function mapped by entity type
  const fetchOptions = React.useCallback(
    async (query: string) => {
      setLoading(true);
      try {
        let results: EntityOption[] = [];

        switch (entityType) {
          case "worker": {
            const list = await searchWorkerOptions(query, { coordinatorId: parentValue || undefined });
            results = list.map((w) => ({
              id: w.id,
              title: w.fullName,
              subtitle: `Iqama: ${w.iqamaNumber}`,
              badge: w.designationTitle || w.status,
              raw: w,
            }));
            break;
          }
          case "client": {
            const list = await searchClientOptions(query);
            results = list.map((c) => ({
              id: c.id,
              title: c.companyName,
              subtitle: c.contactPerson ? `Contact: ${c.contactPerson}` : undefined,
              raw: c,
            }));
            break;
          }
          case "project": {
            const list = await searchProjectOptions(query, { clientId: parentValue || undefined });
            results = list.map((p) => ({
              id: p.id,
              title: p.name,
              subtitle: p.clientName,
              raw: p,
            }));
            break;
          }
          case "site": {
            const list = await searchSiteOptions(query, {
              projectId: parentValue || undefined,
            });
            results = list.map((s) => ({
              id: s.id,
              title: s.name,
              subtitle: `${s.clientName} — ${s.projectName}`,
              badge: s.location || undefined,
              raw: s,
            }));
            break;
          }
          case "coordinator": {
            const list = await searchCoordinatorOptions(query);
            results = list.map((c) => ({
              id: c.id,
              title: c.name,
              subtitle: c.phone || c.email || undefined,
              raw: c,
            }));
            break;
          }
          case "vehicle": {
            const list = await searchVehicleOptions(query, {
              coordinatorId: parentValue || undefined,
            });
            results = list.map((v) => ({
              id: v.id,
              title: v.plateNumber,
              subtitle: `${v.make} ${v.model}`,
              badge: v.status,
              raw: v,
            }));
            break;
          }
          case "equipment": {
            const list = await searchEquipmentOptions(query, {
              coordinatorId: parentValue || undefined,
            });
            results = list.map((e) => ({
              id: e.id,
              title: e.name,
              subtitle: `S/N: ${e.serialNumber}`,
              badge: e.category || e.status,
              raw: e,
            }));
            break;
          }
          case "employee": {
            const list = await searchEmployeeOptions(query, { departmentId: parentValue || undefined });
            results = list.map((emp) => ({
              id: emp.id,
              title: emp.fullName,
              subtitle: emp.departmentName || undefined,
              badge: emp.designationTitle || undefined,
              raw: emp,
            }));
            break;
          }
          case "invoice": {
            const list = await searchInvoiceOptions(query, { clientId: parentValue || undefined });
            results = list.map((inv) => ({
              id: inv.id,
              title: inv.invoiceNumber,
              subtitle: inv.clientName,
              badge: `SAR ${inv.totalAmount.toLocaleString()}`,
              raw: inv,
            }));
            break;
          }
        }

        setOptions(results);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    },
    [entityType, parentValue]
  );

  // Debounced search trigger
  React.useEffect(() => {
    if (!open) return;

    const timer = setTimeout(() => {
      fetchOptions(search);
    }, 200);

    return () => clearTimeout(timer);
  }, [search, open, fetchOptions]);

  // Initial load when dropdown opens
  const handleOpenChange = (newOpen: boolean) => {
    if (disabled || readOnly) return;
    setOpen(newOpen);
    if (newOpen) {
      setSearch("");
      fetchOptions("");
    }
  };

  const handleSelect = (option: EntityOption) => {
    onChange(option.id, option.raw);
    setFetchedLabel({ title: option.title, subtitle: option.subtitle ?? undefined });
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("", null);
    setFetchedLabel(null);
  };

  return (
    <div className={cn("relative w-full", className)}>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              aria-required={required}
              disabled={disabled || readOnly}
              className={cn(
                "w-full justify-between font-normal text-left h-10 px-3 py-2 bg-background border-input hover:bg-accent/50 focus:ring-2 focus:ring-ring focus:ring-offset-1 rounded-lg text-sm",
                !value && "text-muted-foreground",
                error && "border-destructive focus:ring-destructive"
              )}
            >
              {resolvingInitial ? (
                <div className="flex items-center gap-2 w-full">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ) : selectedLabel && value ? (
                <div className="flex items-center justify-between w-full min-w-0 pr-1">
                  <div className="flex flex-col truncate leading-tight">
                    <span className="font-medium text-foreground truncate">{selectedLabel.title}</span>
                    {selectedLabel.subtitle && (
                      <span className="text-[11px] text-muted-foreground truncate">{selectedLabel.subtitle}</span>
                    )}
                  </div>
                  {allowClear && !disabled && !readOnly && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={handleClear}
                      onKeyDown={(e: React.KeyboardEvent) => {
                        if (e.key === "Enter" || e.key === " ") handleClear(e as unknown as React.MouseEvent);
                      }}
                      className="ml-2 p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                    >
                      <X className="size-3.5" />
                      <span className="sr-only">Clear selection</span>
                    </div>
                  )}
                </div>
              ) : (
                <span className="truncate">{defaultPlaceholder}</span>
              )}
              {(!selectedLabel || !value) && <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />}
            </Button>
          }
        />

        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 z-50 shadow-md border" align="start">
          <div className="p-2 border-b flex items-center gap-2 bg-muted/20">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              type="text"
              className="w-full text-sm bg-transparent border-none outline-none focus:outline-none placeholder:text-muted-foreground"
              placeholder={`Search ${entityType}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            {loading && <Loader2 className="size-4 animate-spin text-primary shrink-0" />}
          </div>

          <div className="max-h-60 overflow-y-auto p-1 divide-y divide-border/30">
            {loading && options.length === 0 ? (
              <div className="p-4 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : options.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                No {entityType}s found matching &quot;{search}&quot;.
              </div>
            ) : (
              options.map((opt) => {
                const isSelected = value === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelect(opt)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 rounded-md text-sm transition-colors flex items-center justify-between hover:bg-accent/80 focus:bg-accent focus:outline-none cursor-pointer",
                      isSelected && "bg-accent font-medium text-accent-foreground"
                    )}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="truncate text-foreground font-medium">{opt.title}</span>
                      {opt.subtitle && <span className="text-xs text-muted-foreground truncate">{opt.subtitle}</span>}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {opt.badge && (
                        <Badge variant="outline" className="text-[10px] uppercase font-semibold py-0 px-1.5 h-4">
                          {opt.badge}
                        </Badge>
                      )}
                      {isSelected && <Check className="size-4 text-primary" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
