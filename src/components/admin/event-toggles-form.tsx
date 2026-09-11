"use client";

import { useActionState } from "react";
import {
  saveWhatsAppEventSettingsAction,
  type AdminActionResult,
} from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import {
  WHATSAPP_EVENTS,
  type WhatsAppEventSettings,
} from "@/lib/whatsapp/events";

const initial: AdminActionResult = { ok: false, message: "" };

export function EventTogglesForm({
  settings,
  source,
}: {
  settings: WhatsAppEventSettings;
  source: string;
}) {
  const [state, action, pending] = useActionState(
    saveWhatsAppEventSettingsAction,
    initial,
  );

  return (
    <form
      action={action}
      className="rounded-2xl border border-forest/15 bg-card/90 p-6 dark:border-white/10"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl tracking-tight text-forest dark:text-gold">
            WhatsApp event triggers
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Toggle which business events send automated company WhatsApp
            messages. Source: {source}.
          </p>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save toggles"}
        </Button>
      </div>

      <ul className="mt-6 space-y-4">
        {WHATSAPP_EVENTS.map((event) => (
          <li
            key={event.key}
            className="flex items-start justify-between gap-4 border-b border-forest/10 pb-4 last:border-0 dark:border-white/10"
          >
            <div>
              <p className="font-medium">{event.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {event.description}
              </p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                name={event.key}
                defaultChecked={settings[event.key]}
                className="size-4 accent-[var(--forest)]"
              />
              On
            </label>
          </li>
        ))}
      </ul>

      {state.message ? (
        <p
          className={`mt-4 text-sm ${state.ok ? "text-forest dark:text-gold" : "text-destructive"}`}
          role="status"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
