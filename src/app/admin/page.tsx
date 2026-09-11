import {
  adminLogoutAction,
} from "@/app/actions/admin";
import { DocumentForm } from "@/components/admin/document-form";
import { EventTogglesForm } from "@/components/admin/event-toggles-form";
import { AdminLoginForm } from "@/components/admin/login-form";
import { Button } from "@/components/ui/button";
import {
  getAdminAuthMode,
  verifyAdminSession,
} from "@/lib/admin/auth";
import { isWhatsAppApiConfigured } from "@/lib/env";
import { getWhatsAppEventSettings } from "@/lib/whatsapp/settings";

export default async function AdminPage() {
  const authed = await verifyAdminSession();
  const authMode = getAdminAuthMode();

  if (!authed) {
    const hint = authMode.developmentFallback
      ? "Development fallback password: lynx-admin-dev (set ADMIN_PASSWORD for production)."
      : authMode.configured
        ? undefined
        : "Set ADMIN_PASSWORD (min 8 chars) in .env.local to enable admin sign-in.";
    return <AdminLoginForm hint={hint} />;
  }

  const { settings, source } = await getWhatsAppEventSettings();
  const apiReady = isWhatsAppApiConfigured();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Lynx admin
          </p>
          <h1 className="mt-2 font-display text-3xl tracking-tight text-forest dark:text-gold">
            WhatsApp automation
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Cloud API credentials are optional for now — without them, messages
            are mocked in server logs. Add Meta WhatsApp keys later to send as
            the company profile.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            API status:{" "}
            <span className="font-medium text-foreground">
              {apiReady ? "configured" : "mock mode (no keys yet)"}
            </span>
          </p>
        </div>
        <form action={adminLogoutAction}>
          <Button type="submit" variant="outline">
            Sign out
          </Button>
        </form>
      </div>

      <EventTogglesForm settings={settings} source={source} />
      <DocumentForm />
    </div>
  );
}
