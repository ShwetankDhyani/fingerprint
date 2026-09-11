"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { createOrganizationAction } from "@/app/actions/portal";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/** Add-client flow lives behind a button — list stays the main stage. */
export function CreateOrganizationSheet() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className={cn(buttonVariants(), "gap-1.5")}
        aria-label="Add client"
      >
        <Plus className="size-4" aria-hidden />
        Add client
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex w-full flex-col border-[#24302b] bg-[#0e1613] p-0 text-[#e8eee9] sm:max-w-md"
      >
        <SheetHeader className="border-b border-[#24302b]">
          <SheetTitle className="font-[family-name:var(--font-syne)] text-[#e8eee9]">
            New client
          </SheetTitle>
          <SheetDescription className="text-[#9aaba2]">
            Create the organization, then optionally send a portal invite.
          </SheetDescription>
        </SheetHeader>
        <form
          action={createOrganizationAction}
          className="flex flex-1 flex-col gap-3 overflow-y-auto p-4"
        >
          <Field id="name" label="Company" required />
          <Field
            id="primaryContactName"
            name="primaryContactName"
            label="Primary contact"
          />
          <Field
            id="billingEmail"
            name="billingEmail"
            label="Billing email"
            type="email"
          />
          <Field id="phone" name="phone" label="Phone" type="tel" />
          <Field id="website" name="website" label="Website" />
          <div className="my-1 border-t border-[#24302b] pt-3">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[#5f6f68]">
              Optional invite
            </p>
            <div className="space-y-3">
              <Field
                id="inviteEmail"
                name="inviteEmail"
                label="Invite email"
                type="email"
              />
              <Field id="inviteName" name="inviteName" label="Invite name" />
            </div>
          </div>
          <div className="mt-auto flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1 border-[#24302b] bg-transparent"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Create + invite
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  id,
  name,
  label,
  type = "text",
  required,
}: {
  id: string;
  name?: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[#c8d3cd]">
        {label}
      </Label>
      <Input
        id={id}
        name={name ?? id}
        type={type}
        required={required}
        className="border-[#24302b] bg-[#121a17]"
      />
    </div>
  );
}
