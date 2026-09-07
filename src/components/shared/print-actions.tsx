"use client";

import { Check, Copy, Printer } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

/** Shared "Copy Link" / "Print / Save as PDF" bar for printable documents
 * (receipts, invoices) — hidden on the printed page itself via print:hidden. */
export function PrintActions() {
  const [copied, setCopied] = useState(false);

  async function handleCopyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2 print:hidden">
      <Button variant="outline" onClick={handleCopyLink}>
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copied ? "Link Copied" : "Copy Link"}
      </Button>
      <Button onClick={() => window.print()}>
        <Printer className="size-4" />
        Print / Save as PDF
      </Button>
    </div>
  );
}
