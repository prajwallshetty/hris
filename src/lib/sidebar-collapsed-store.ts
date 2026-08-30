// A tiny external store for the sidebar's collapsed state, persisted to
// localStorage. Implemented as useSyncExternalStore rather than
// useState+useEffect so reading the persisted value on mount doesn't
// require a setState call inside an effect (forbidden by this project's
// lint config — see useIsClient for the same reasoning).
const STORAGE_KEY = "hris:sidebar-collapsed";
const listeners = new Set<() => void>();

function readStoredValue(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function subscribeSidebarCollapsed(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function getSidebarCollapsedSnapshot(): boolean {
  return readStoredValue();
}

export function getSidebarCollapsedServerSnapshot(): boolean {
  return false;
}

export function setSidebarCollapsed(value: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // localStorage unavailable — collapse state just won't persist.
  }
  listeners.forEach((listener) => listener());
}
