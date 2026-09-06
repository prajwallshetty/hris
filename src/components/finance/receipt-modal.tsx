"use client";

import { Download, FileText, Printer, Send } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SendReceiptDialog } from "@/components/finance/send-receipt-dialog";

export function ReceiptModal({
  paymentId,
  receiptNumber,
  recipientName,
  mobileNumber,
  amount,
  payrollPeriodName,
  trigger,
}: {
  paymentId: string;
  receiptNumber?: string | null;
  recipientName?: string;
  mobileNumber?: string;
  amount?: number;
  payrollPeriodName?: string;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const receiptUrl = `/api/payments/${paymentId}/receipt`;
  const downloadUrl = `/api/payments/${paymentId}/receipt?download=1`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ?? <Button size="xs" variant="outline"><FileText className="size-3.5 mr-1" /> Receipt</Button>} />
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <FileText className="size-5 text-primary" />
              Salary Payment Receipt {receiptNumber ? `(${receiptNumber})` : ""}
            </DialogTitle>
          </div>

          <div className="flex items-center gap-2 pr-6">
            <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="gap-1.5">
                <Printer className="size-4" />
                Print / Download PDF
              </Button>
            </a>

            {recipientName && (
              <SendReceiptDialog
                paymentId={paymentId}
                receiptNumber={receiptNumber || `RCP-${paymentId.slice(-6).toUpperCase()}`}
                recipientName={recipientName}
                mobileNumber={mobileNumber}
                amount={amount || 0}
                payrollPeriodName={payrollPeriodName || "Payroll"}
              />
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 w-full bg-muted/20 min-h-[550px] p-2 overflow-hidden">
          <iframe
            src={receiptUrl}
            title={`Receipt ${receiptNumber || paymentId}`}
            className="w-full h-full min-h-[550px] border-0 rounded bg-white shadow-sm"
          />
        </div>

        <DialogFooter className="px-6 py-3 border-t bg-background">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
