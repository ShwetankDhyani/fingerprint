import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  defaultWhatsAppEventSettings,
  WHATSAPP_EVENT_KEYS,
  type WhatsAppEventKey,
  type WhatsAppEventSettings,
} from "@/lib/whatsapp-event-catalog";

export {
  WHATSAPP_EVENT_KEYS,
  WHATSAPP_EVENTS,
  defaultWhatsAppEventSettings,
  type WhatsAppEventDefinition,
  type WhatsAppEventKey,
  type WhatsAppEventSettings,
} from "@/lib/whatsapp-event-catalog";

const SETTINGS_KEY = "whatsapp_event_toggles";
const LOCAL_PATH = path.join(
  process.cwd(),
  ".data",
  "whatsapp-event-settings.json",
);

function normalizeSettings(
  raw: Partial<Record<string, boolean>> | null | undefined,
): WhatsAppEventSettings {
  const defaults = defaultWhatsAppEventSettings();
  if (!raw) return defaults;
  for (const key of WHATSAPP_EVENT_KEYS) {
    if (typeof raw[key] === "boolean") defaults[key] = raw[key]!;
  }
  return defaults;
}

async function readLocal(): Promise<WhatsAppEventSettings | null> {
  try {
    const text = await fs.readFile(LOCAL_PATH, "utf8");
    return normalizeSettings(
      JSON.parse(text) as Partial<WhatsAppEventSettings>,
    );
  } catch {
    return null;
  }
}

async function writeLocal(settings: WhatsAppEventSettings) {
  await fs.mkdir(path.dirname(LOCAL_PATH), { recursive: true });
  await fs.writeFile(
    LOCAL_PATH,
    `${JSON.stringify(settings, null, 2)}\n`,
    "utf8",
  );
}

export async function getWhatsAppEventSettings(): Promise<{
  settings: WhatsAppEventSettings;
  source: "supabase" | "local" | "defaults";
}> {
  const admin = getSupabaseAdmin();
  if (admin) {
    const { data, error } = await admin
      .from("portal_settings")
      .select("value")
      .eq("key", SETTINGS_KEY)
      .maybeSingle();
    if (!error && data?.value) {
      return {
        settings: normalizeSettings(
          data.value as Partial<WhatsAppEventSettings>,
        ),
        source: "supabase",
      };
    }
  }

  const local = await readLocal();
  if (local) return { settings: local, source: "local" };
  return { settings: defaultWhatsAppEventSettings(), source: "defaults" };
}

export async function isWhatsAppEventEnabled(
  event: WhatsAppEventKey,
): Promise<boolean> {
  const { settings } = await getWhatsAppEventSettings();
  return settings[event];
}

export async function updateWhatsAppEventSettings(
  patch: Partial<WhatsAppEventSettings>,
): Promise<{ settings: WhatsAppEventSettings; source: "supabase" | "local" }> {
  const current = await getWhatsAppEventSettings();
  const next = normalizeSettings({ ...current.settings, ...patch });

  const admin = getSupabaseAdmin();
  if (admin) {
    const { error } = await admin.from("portal_settings").upsert(
      {
        key: SETTINGS_KEY,
        value: next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
    if (!error) return { settings: next, source: "supabase" };
    console.error("[whatsapp-events] upsert failed", error.message);
  }

  await writeLocal(next);
  return { settings: next, source: "local" };
}
