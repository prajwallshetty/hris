"use client";

import { Building2, FileText, MapPin, Search, UserCog, UserSquare2, Users, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { globalSearch, type SearchResultGroup } from "@/server/actions/search";

const GROUP_ICONS: Record<string, LucideIcon> = {
  Workers: Users,
  Clients: Building2,
  Sites: MapPin,
  Coordinators: UserCog,
  Invoices: FileText,
  Employees: UserSquare2,
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SearchResultGroup[]>([]);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const handle = setTimeout(() => {
      startTransition(async () => {
        const result = await globalSearch(query);
        setGroups(result);
      });
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  function handleSelect(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <>
      <Button variant="outline" size="sm" className="text-muted-foreground gap-2" onClick={() => setOpen(true)}>
        <Search className="size-4" />
        <span className="hidden sm:inline">Search…</span>
        <kbd className="bg-muted ml-2 hidden rounded px-1.5 py-0.5 text-xs sm:inline">⌘K</kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Search workers, clients, sites, invoices, and more">
        <CommandInput placeholder="Search workers, Iqama, clients, sites, invoices…" value={query} onValueChange={setQuery} />
        <CommandList>
          {query.trim().length < 2 ? (
            <CommandEmpty>Type at least 2 characters to search.</CommandEmpty>
          ) : isPending ? (
            <CommandEmpty>Searching…</CommandEmpty>
          ) : groups.length === 0 ? (
            <CommandEmpty>No results found.</CommandEmpty>
          ) : (
            groups.map((group) => {
              const Icon = GROUP_ICONS[group.label];
              return (
                <CommandGroup key={group.label} heading={group.label}>
                  {group.items.map((item) => (
                    <CommandItem key={item.id} value={`${group.label}-${item.id}`} onSelect={() => handleSelect(item.href)}>
                      {Icon && <Icon className="text-muted-foreground size-4 shrink-0" />}
                      <div className="min-w-0">
                        <p className="truncate">{item.label}</p>
                        {item.sublabel && <p className="text-muted-foreground truncate text-xs">{item.sublabel}</p>}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
