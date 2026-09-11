"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Read-only link with a one-click copy — used for invite and quote share URLs. */
export function CopyField({
  value,
  label,
  hint,
  whatsappMessage,
}: {
  value: string;
  label?: string;
  hint?: string;
  /** When set, adds a WhatsApp share button prefilled with this text + the link. */
  whatsappMessage?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-1">
      {label ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#9aaba2]">
          {label}
        </p>
      ) : null}
      <div className="flex items-stretch gap-2">
        <input
          readOnly
          value={value}
          onFocus={(event) => event.currentTarget.select()}
          className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2 font-mono text-xs text-[#e8eee9]"
          aria-label={label ?? "Shareable link"}
        />
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
        {whatsappMessage ? (
          <a
            href={`https://wa.me/?text=${encodeURIComponent(
              `${whatsappMessage}\n${value}`,
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <MessageCircle className="size-3.5" />
            WhatsApp
          </a>
        ) : null}
      </div>
      {hint ? <p className="text-xs text-[#9aaba2]">{hint}</p> : null}
    </div>
  );
}
