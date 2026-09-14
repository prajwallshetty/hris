"use client";

import { Check, Copy, Printer } from "lucide-react";
import { useState } from "react";

import { SendReceiptDialog } from "@/components/finance/send-receipt-dialog";
import { Button } from "@/components/ui/button";

export function ReceiptActions({
  paymentId,
  receiptNumber,
  recipientName,
  mobileNumber,
  amount,
  payrollPeriodName,
}: {
  paymentId: string;
  receiptNumber: string;
  recipientName: string;
  mobileNumber?: string;
  amount: number;
  payrollPeriodName: string;
}) {
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
      <SendReceiptDialog
        paymentId={paymentId}
        receiptNumber={receiptNumber}
        recipientName={recipientName}
        mobileNumber={mobileNumber}
        amount={amount}
        payrollPeriodName={payrollPeriodName}
      />
      <Button onClick={() => window.print()}>
        <Printer className="size-4" />
        Print / Save as PDF
      </Button>
    </div>
  );
}
