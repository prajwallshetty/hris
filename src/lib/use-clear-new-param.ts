"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/** Strips the `?new=1` Quick Create deep-link param from the URL once the
 * dialog it opened has mounted, so the address bar doesn't stay stuck on
 * `?new=1` and a second Quick Create click (producing the same href) still
 * triggers navigation instead of being a no-op. Pass whether the dialog
 * that owns this call actually opened via that deep link. */
export function useClearNewParam(active: boolean) {
  const router = useRouter();
  const pathname = usePathname();
  const cleared = useRef(false);

  useEffect(() => {
    if (active && !cleared.current) {
      cleared.current = true;
      router.replace(pathname, { scroll: false });
    }
  }, [active, pathname, router]);
}
