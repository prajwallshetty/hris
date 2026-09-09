"use client";

import { Check, Copy, ExternalLink, Mail, MessageSquare, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function SendReceiptDialog({
  paymentId,
  receiptNumber,
  recipientName,
  mobileNumber,
  amount,
  payrollPeriodName,
  trigger,
}: {
  paymentId: string;
  receiptNumber: string;
  recipientName: string;
  mobileNumber?: string;
  amount: number;
  payrollPeriodName: string;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(mobileNumber || "");
  const [copied, setCopied] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const receiptUrl = `${origin}/api/payments/${paymentId}/receipt`;

  const messageText = `Hello ${recipientName},\n\nYour salary payment receipt (${receiptNumber}) of SAR ${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} for ${payrollPeriodName} has been processed successfully.\n\nView/Download Receipt:\n${receiptUrl}\n\nThank you,\nGrowthBridge HRIS`;

  // Format clean phone number for WhatsApp wa.me
  const cleanPhone = phone.replace(/[^0-9]/g, "");
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
  const mailtoUrl = `mailto:?subject=${encodeURIComponent(`Salary Payment Receipt - ${receiptNumber}`)}&body=${encodeURIComponent(messageText)}`;

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(receiptUrl);
      setCopied(true);
      toast.success("Receipt link copied to clipboard.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ?? <Button size="sm" variant="outline"><Send className="size-3.5 mr-1" /> Send to Worker</Button>} />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="size-5 text-primary" />
            Send Receipt to Worker
          </DialogTitle>
          <DialogDescription>
            Share receipt <strong>{receiptNumber}</strong> with {recipientName}.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className="space-y-4 my-2">
          <Field>
            <FieldLabel htmlFor="phone">Mobile / WhatsApp Number</FieldLabel>
            <Input
              id="phone"
              type="tel"
              placeholder="+966 5x xxx xxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel>Pre-formatted Message</FieldLabel>
            <Textarea rows={5} value={messageText} readOnly className="text-xs font-mono bg-muted/40" />
          </Field>

          <div className="flex flex-col gap-2 pt-2">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full"
              onClick={() => toast.success("Opening WhatsApp...")}
            >
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                <MessageSquare className="size-4" />
                Send via WhatsApp
                <ExternalLink className="size-3 ml-auto opacity-70" />
              </Button>
            </a>

            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={handleCopyLink} className="gap-2">
                {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
                {copied ? "Copied!" : "Copy Receipt Link"}
              </Button>

              <a href={mailtoUrl} className="w-full">
                <Button type="button" variant="outline" className="w-full gap-2">
                  <Mail className="size-4" />
                  Send Email
                </Button>
              </a>
            </div>
          </div>
        </FieldGroup>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
