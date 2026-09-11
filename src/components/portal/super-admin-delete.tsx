"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  action: (formData: FormData) => Promise<void>;
  entityLabel: string;
  hidden?: Record<string, string>;
  /** Extra confirmation phrase shown in the dialog */
  consequence?: string;
  className?: string;
  buttonLabel?: string;
};

/**
 * Super Admin–only destructive control. Requires an explicit confirm() so
 * absolute delete power stays intentional.
 */
export function SuperAdminDeleteButton({
  action,
  entityLabel,
  hidden,
  consequence,
  className,
  buttonLabel,
}: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      className={cn(className)}
      action={(formData) => {
        const message = [
          `Permanently delete this ${entityLabel}?`,
          consequence ?? "This cannot be undone.",
          "Only Super Admin can do this.",
        ].join("\n\n");
        if (!window.confirm(message)) return;
        startTransition(() => {
          void action(formData);
        });
      }}
    >
      {hidden
        ? Object.entries(hidden).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))
        : null}
      <Button
        type="submit"
        size="sm"
        variant="destructive"
        disabled={pending}
        className="border border-[#7a3030]/50"
      >
        {pending ? "Deleting…" : buttonLabel ?? `Delete ${entityLabel}`}
      </Button>
    </form>
  );
}
