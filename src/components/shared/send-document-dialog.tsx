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
import { buildWhatsAppUrl } from "@/lib/whatsapp";

/**
 * Generic "Send via WhatsApp / Email" dialog for any printable document
 * (invoices, statements, receipts) — a wa.me click-to-chat link with a
 * pre-filled message plus a mailto: fallback and a copy-link action. A
 * wa.me link can only open a chat pre-filled with text; it can never
 * silently attach the document's PDF, so the message always points the
 * recipient at the document's own view/download link instead of claiming
 * a file was sent automatically.
 */
export function SendDocumentDialog({
  documentLabel,
  documentUrl,
  recipientName,
  mobileNumber,
  emailSubject,
  message,
  trigger,
}: {
  /** e.g. "Invoice INV-2026-0042" — used in dialog copy only. */
  documentLabel: string;
  /** Absolute or relative URL to the document's own view/download page. */
  documentUrl: string;
  recipientName: string;
  mobileNumber?: string;
  emailSubject: string;
  message: string;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(mobileNumber ?? "");
  const [copied, setCopied] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const absoluteUrl = documentUrl.startsWith("http") ? documentUrl : `${origin}${documentUrl}`;
  const fullMessage = `${message}\n\nView / Download:\n${absoluteUrl}`;
  const whatsappUrl = buildWhatsAppUrl(phone, fullMessage);
  const mailtoUrl = `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(fullMessage)}`;

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setCopied(true);
      toast.success("Link copied to clipboard.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger render={trigger} />
      ) : (
        <DialogTrigger
          render={
            <Button variant="outline">
              <Send className="size-4" />
              Send
            </Button>
          }
        />
      )}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="text-primary size-5" />
            Send {documentLabel}
          </DialogTitle>
          <DialogDescription>Share with {recipientName}.</DialogDescription>
        </DialogHeader>

        <FieldGroup className="my-2 space-y-4">
          <Field>
            <FieldLabel htmlFor="send-doc-phone">Mobile / WhatsApp Number</FieldLabel>
            <Input
              id="send-doc-phone"
              type="tel"
              placeholder="+966 5x xxx xxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel>Pre-formatted Message</FieldLabel>
            <Textarea rows={5} value={fullMessage} readOnly className="bg-muted/40 font-mono text-xs" />
          </Field>

          <div className="flex flex-col gap-2 pt-2">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full"
              onClick={() => toast.success("Opening WhatsApp…")}
            >
              <Button type="button" className="w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
                <MessageSquare className="size-4" />
                Send via WhatsApp
                <ExternalLink className="ml-auto size-3 opacity-70" />
              </Button>
            </a>

            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={handleCopyLink} className="gap-2">
                {copied ? <Check className="text-success size-4" /> : <Copy className="size-4" />}
                {copied ? "Copied!" : "Copy Link"}
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
