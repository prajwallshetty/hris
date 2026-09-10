"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePwa } from "@/components/pwa/pwa-provider";

export function InstallButton() {
  const { isInstallable, promptInstall } = usePwa();

  if (!isInstallable) {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={promptInstall}
      className="hidden sm:inline-flex items-center gap-1.5 h-8 px-2.5 text-xs font-medium text-primary border-primary/20 hover:bg-primary/5 transition-colors"
      title="Install Expand Arabia HRIS on your device"
    >
      <Download className="size-3.5" />
      <span>Install App</span>
    </Button>
  );
}
