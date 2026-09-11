"use client";

import { useActionState } from "react";

import {
  acceptInviteAction,
  requestPasswordResetAction,
  signInAction,
  updatePasswordAction,
  type AuthFormState,
} from "@/app/actions/portal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: AuthFormState = { ok: false, message: "" };

export function SignInForm() {
  const [state, action, pending] = useActionState(signInAction, initial);
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>
      {state.message ? (
        <p className="font-mono text-xs text-red-400">{state.message}</p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Signing in…" : "Enter portal"}
      </Button>
      <p className="text-center text-xs text-[#9aaba2]">
        <a href="/forgot-password" className="underline-offset-4 hover:underline">
          Forgot password?
        </a>
      </p>
    </form>
  );
}

export function RequestPasswordResetForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, initial);
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      {state.message ? (
        <p
          className={`font-mono text-xs ${state.ok ? "text-emerald-400" : "text-red-400"}`}
        >
          {state.message}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}

export function UpdatePasswordForm() {
  const [state, action, pending] = useActionState(updatePasswordAction, initial);
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          minLength={8}
          required
          autoComplete="new-password"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm">Confirm password</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          minLength={8}
          required
          autoComplete="new-password"
        />
      </div>
      {state.message ? (
        <p className="font-mono text-xs text-red-400">{state.message}</p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Update password"}
      </Button>
    </form>
  );
}

export function AcceptInviteForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInviteAction, initial);
  return (
    <form action={action} className="space-y-4" autoComplete="off">
      <input type="hidden" name="token" value={token} />
      {/*
        Browsers love stuffing a saved password into the first text field.
        Keep name autocomplete strict and password as new-password only.
      */}
      <div className="space-y-1.5">
        <Label htmlFor="fullName">Your name</Label>
        <Input
          id="fullName"
          name="fullName"
          required
          autoComplete="name"
          autoCapitalize="words"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Set password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          minLength={8}
          required
          autoComplete="new-password"
        />
      </div>
      {state.message ? (
        <p className="font-mono text-xs text-red-400">{state.message}</p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating account…" : "Activate access"}
      </Button>
    </form>
  );
}
