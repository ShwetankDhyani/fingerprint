"use client";

import { useActionState } from "react";
import {
  adminLoginAction,
  type AdminActionResult,
} from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: AdminActionResult = { ok: false, message: "" };

export function AdminLoginForm({ hint }: { hint?: string }) {
  const [state, action, pending] = useActionState(adminLoginAction, initial);

  return (
    <form
      action={action}
      className="rounded-2xl border border-forest/15 bg-card/90 p-6 shadow-sm dark:border-white/10"
    >
      <h1 className="font-display text-2xl tracking-tight text-forest dark:text-gold">
        Admin sign-in
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Manage WhatsApp automation triggers and send quotations / invoices.
      </p>
      {hint ? (
        <p className="mt-3 rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-xs text-forest dark:text-gold">
          {hint}
        </p>
      ) : null}
      <div className="mt-6 grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={pending}
        />
      </div>
      {state.message && !state.ok ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" className="mt-5" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
