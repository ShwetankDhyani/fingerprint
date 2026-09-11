"use client";

import { useActionState } from "react";
import { saveWhatsAppEventSettingsAction } from "@/app/actions/portal";
import { Button } from "@/components/ui/button";
import {
  WHATSAPP_EVENTS,
  type WhatsAppEventSettings,
} from "@/lib/whatsapp-event-catalog";

const initial = { ok: false, message: "" };

export function WhatsAppEventTogglesForm({
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
      className="space-y-4 rounded-lg border border-[#24302b] bg-[#121a17] p-4"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#b08d1f]">
            WhatsApp event triggers
          </h3>
          <p className="mt-1 text-xs text-[#9aaba2]">
            Choose which business events send automated company WhatsApp
            messages. Stored in {source}. Without Cloud API keys, sends are
            skipped and logged.
          </p>
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save toggles"}
        </Button>
      </div>

      <ul className="divide-y divide-[#24302b] rounded-md border border-[#24302b]">
        {WHATSAPP_EVENTS.map((event) => (
          <li
            key={event.key}
            className="flex items-start justify-between gap-4 px-3 py-3"
          >
            <div>
              <p className="text-sm font-medium">{event.label}</p>
              <p className="mt-1 text-xs text-[#9aaba2]">{event.description}</p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 font-mono text-xs text-[#9aaba2]">
              <input
                type="checkbox"
                name={event.key}
                defaultChecked={settings[event.key]}
                className="size-4 accent-emerald-500"
              />
              On
            </label>
          </li>
        ))}
      </ul>

      {state.message ? (
        <p
          className={`text-xs ${state.ok ? "text-emerald-300" : "text-red-300"}`}
          role="status"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
