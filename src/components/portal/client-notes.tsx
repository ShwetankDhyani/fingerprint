"use client";

import { useActionState, useEffect, useState } from "react";

import { updateOrganizationNotesAction } from "@/app/actions/portal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type State = { ok: boolean; error?: string } | null;

async function saveNotes(
  _prev: State,
  formData: FormData,
): Promise<State> {
  try {
    await updateOrganizationNotesAction(formData);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not save notes.",
    };
  }
}

export function ClientNotesPanel({
  organizationId,
  initialNotes,
}: {
  organizationId: string;
  initialNotes: string;
}) {
  const [value, setValue] = useState(initialNotes);
  const [state, action, pending] = useActionState(saveNotes, null);
  const dirty = value !== initialNotes;

  useEffect(() => {
    setValue(initialNotes);
  }, [initialNotes]);

  return (
    <section className="overflow-hidden rounded-2xl border border-[#24302b] bg-[#0d1411]/80">
      <div className="border-b border-[#1c2622] px-5 py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#b08d1f]">
          Internal notes
        </p>
        <p className="mt-1 font-[family-name:var(--font-syne)] text-lg text-[#e8eee9]">
          Pitch board
        </p>
        <p className="mt-1 text-sm text-[#7a8a83]">
          What they want, what they don’t, and what to pitch next. Staff only —
          clients never see this.
        </p>
      </div>
      <form action={action} className="space-y-3 p-5">
        <input type="hidden" name="organizationId" value={organizationId} />
        <Textarea
          name="notes"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={8}
          placeholder="e.g. Liked the dark UI direction. No marketplace features. Pitch retainer after launch…"
          className="min-h-[10rem] resize-y border-[#24302b] bg-[#0b1210] text-sm leading-relaxed text-[#d4dcd6] placeholder:text-[#4a5852]"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[#5f6f68]">
            {state?.ok && !dirty
              ? "Saved"
              : state?.error
                ? state.error
                : dirty
                  ? "Unsaved changes"
                  : "Ready"}
          </p>
          <Button type="submit" size="sm" disabled={pending || !dirty}>
            {pending ? "Saving…" : "Save notes"}
          </Button>
        </div>
      </form>
    </section>
  );
}
