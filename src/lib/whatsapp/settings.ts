import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { isSupabaseConfigured } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  defaultWhatsAppEventSettings,
  WHATSAPP_EVENT_KEYS,
  type WhatsAppEventKey,
  type WhatsAppEventSettings,
} from "@/lib/whatsapp/events";

const SETTINGS_KEY = "whatsapp_event_toggles";
const LOCAL_SETTINGS_PATH = path.join(
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
    if (typeof raw[key] === "boolean") {
      defaults[key] = raw[key]!;
    }
  }
  return defaults;
}

async function readLocalSettings(): Promise<WhatsAppEventSettings | null> {
  try {
    const text = await fs.readFile(LOCAL_SETTINGS_PATH, "utf8");
    return normalizeSettings(
      JSON.parse(text) as Partial<WhatsAppEventSettings>,
    );
  } catch {
    return null;
  }
}

async function writeLocalSettings(
  settings: WhatsAppEventSettings,
): Promise<void> {
  await fs.mkdir(path.dirname(LOCAL_SETTINGS_PATH), { recursive: true });
  await fs.writeFile(
    LOCAL_SETTINGS_PATH,
    `${JSON.stringify(settings, null, 2)}\n`,
    "utf8",
  );
}

export async function getWhatsAppEventSettings(): Promise<{
  settings: WhatsAppEventSettings;
  source: "supabase" | "local" | "defaults";
}> {
  if (isSupabaseConfigured()) {
    const client = getSupabaseAdmin();
    if (client) {
      const { data, error } = await client
        .from("app_settings")
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
  }

  const local = await readLocalSettings();
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

  if (isSupabaseConfigured()) {
    const client = getSupabaseAdmin();
    if (client) {
      const { error } = await client.from("app_settings").upsert(
        {
          key: SETTINGS_KEY,
          value: next,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      );
      if (!error) {
        return { settings: next, source: "supabase" };
      }
      console.error(
        "[whatsapp/settings] supabase upsert failed",
        error.message,
      );
    }
  }

  await writeLocalSettings(next);
  return { settings: next, source: "local" };
}
