"use client";

import { useActionState } from "react";
import {
  createDocumentAndNotifyAction,
  type AdminActionResult,
} from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initial: AdminActionResult = { ok: false, message: "" };

export function DocumentForm() {
  const [state, action, pending] = useActionState(
    createDocumentAndNotifyAction,
    initial,
  );

  return (
    <form
      action={action}
      className="rounded-2xl border border-forest/15 bg-card/90 p-6 dark:border-white/10"
    >
      <h2 className="font-display text-xl tracking-tight text-forest dark:text-gold">
        Generate quotation / invoice
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Creates a shareable link and sends it on WhatsApp when that event toggle
        is on.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="type">Document type</Label>
          <select
            id="type"
            name="type"
            className="border-input bg-background h-9 rounded-lg border px-3 text-sm"
            defaultValue="quotation"
            disabled={pending}
          >
            <option value="quotation">Quotation</option>
            <option value="invoice">Invoice</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="customerName">Client name</Label>
          <Input id="customerName" name="customerName" required disabled={pending} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="customerPhone">WhatsApp number</Label>
          <Input
            id="customerPhone"
            name="customerPhone"
            placeholder="9198XXXXXXXX"
            required
            disabled={pending}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="customerEmail">Email (optional)</Label>
          <Input
            id="customerEmail"
            name="customerEmail"
            type="email"
            disabled={pending}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="company">Company (optional)</Label>
          <Input id="company" name="company" disabled={pending} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            min="1"
            step="0.01"
            placeholder="14999"
            required
            disabled={pending}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="currency">Currency</Label>
          <Input
            id="currency"
            name="currency"
            defaultValue="INR"
            disabled={pending}
          />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="summary">Summary / line items</Label>
          <Textarea
            id="summary"
            name="summary"
            className="min-h-28"
            required
            disabled={pending}
            placeholder="Starter website plan · includes design, build, and launch support."
          />
        </div>
      </div>

      <Button type="submit" className="mt-5" disabled={pending}>
        {pending ? "Creating…" : "Create & send on WhatsApp"}
      </Button>

      {state.message ? (
        <div className="mt-4 space-y-1 text-sm" role="status">
          <p className={state.ok ? "text-forest dark:text-gold" : "text-destructive"}>
            {state.message}
          </p>
          {state.link ? (
            <a
              href={state.link}
              className="text-forest underline underline-offset-4 dark:text-gold"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open document link
            </a>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
