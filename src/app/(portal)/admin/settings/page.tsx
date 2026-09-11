import {
  inviteStaffAction,
  sendTestEmailAction,
  setMemberDormantAction,
  deleteUserAction,
  startTeamThreadAction,
} from "@/app/actions/portal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  isAdminRole,
  isSuperAdminRole,
  requireStaff,
} from "@/lib/auth/session";
import { fetchEmailLog } from "@/lib/email/mailer";
import {
  emailSettings,
  isCashfreeConfigured,
  isSupabaseConfigured,
  siteUrl,
} from "@/lib/env";
import {
  fetchWhatsAppLog,
  isWhatsAppConfigured,
} from "@/lib/whatsapp";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { relativeTime } from "@/lib/portal/utils";
import { cn } from "@/lib/utils";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

function Status({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-xs",
        ok ? "text-emerald-400" : "text-red-400",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          ok ? "bg-emerald-400" : "bg-red-400",
        )}
      />
      {label}
    </span>
  );
}

export default async function AdminSettingsPage() {
  const profile = await requireStaff();
  const email = emailSettings();
  const log = await fetchEmailLog(25);
  const whatsappConfigured = isWhatsAppConfigured();
  const whatsappLog = await fetchWhatsAppLog(15);
  const isSuperAdmin = isSuperAdminRole(profile.role);
  const isAdmin = isAdminRole(profile.role);
  const admin = getSupabaseAdmin();
  const { data: staffProfiles } = isAdmin && admin
    ? await admin
        .from("profiles")
        .select(
          "id, email, full_name, role, account_status, created_at, last_login_at",
        )
        .in("role", ["SUPER_ADMIN", "ADMIN", "STAFF"])
        .order("created_at", { ascending: true })
    : { data: [] as Array<Record<string, unknown>> };

  const failures = log.filter((row) => row.status !== "sent").length;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-[family-name:var(--font-syne)] text-2xl">
          System settings
        </h2>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Email delivery",
            ok: email.provider !== "none",
            detail:
              email.provider === "none"
                ? "No provider — add RESEND_API_KEY or SMTP_URL"
                : `via ${email.provider}`,
          },
          {
            label: "Database",
            ok: isSupabaseConfigured(),
            detail: isSupabaseConfigured() ? "Supabase connected" : "Not configured",
          },
          {
            label: "Payments",
            ok: isCashfreeConfigured(),
            detail: isCashfreeConfigured() ? "Cashfree live" : "Not configured",
          },
          {
            label: "Public URL",
            ok: Boolean(siteUrl()),
            detail: siteUrl(),
          },
          {
            label: "WhatsApp API",
            ok: whatsappConfigured,
            detail: whatsappConfigured
              ? "Cloud API ready for payment confirmations"
              : "Add WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-[#24302b] bg-[#121a17] p-3"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#9aaba2]">
              {card.label}
            </p>
            <div className="mt-2">
              <Status ok={card.ok} label={card.ok ? "ready" : "attention"} />
            </div>
            <p className="mt-1 truncate text-xs text-[#9aaba2]" title={card.detail}>
              {card.detail}
            </p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3 rounded-lg border border-[#24302b] bg-[#121a17] p-4">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#b08d1f]">
            Email configuration
          </h3>
          <dl className="space-y-2 text-sm">
            {[
              ["Provider", email.provider],
              ["From address", email.from],
              ["Reply-to", email.replyTo],
              ["Team inbox", email.teamInbox],
            ].map(([key, value]) => (
              <div key={key} className="flex justify-between gap-4">
                <dt className="text-[#9aaba2]">{key}</dt>
                <dd className="truncate font-mono text-xs">{value}</dd>
              </div>
            ))}
          </dl>
          {email.provider === "none" ? (
            <div className="space-y-2 rounded border border-red-500/40 bg-red-500/10 px-3 py-3 text-xs text-red-100">
              <p className="font-medium">
                Outbound email is off — nothing is being delivered.
              </p>
              <p>
                Invites and quotations still produce links you can copy or send
                on WhatsApp, so the portal stays usable. To switch delivery on,
                set one of these in Vercel &rarr; Settings &rarr; Environment
                Variables (Production and Preview), then redeploy:
              </p>
              <ol className="list-decimal space-y-1 pl-4">
                <li>
                  <span className="font-mono">RESEND_API_KEY</span> — send from
                  lynxweb.in. Needs a Resend account and four DNS records at
                  GoDaddy.
                </li>
                <li>
                  <span className="font-mono">SMTP_URL</span> — send through any
                  existing mailbox (a Gmail app password works) in about five
                  minutes.
                </li>
              </ol>
              <p>
                Full walkthrough with the exact records:{" "}
                <span className="font-mono">docs/EMAIL-SETUP.md</span> in the
                repository.
              </p>
            </div>
          ) : null}
        </div>

        <form
          action={sendTestEmailAction}
          className="h-fit space-y-2 rounded-lg border border-[#24302b] bg-[#121a17] p-4"
        >
          <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#b08d1f]">
            Send a test
          </h3>
          <Label htmlFor="to">Recipient</Label>
          <Input id="to" name="to" type="email" defaultValue={profile.email} />
          <Button type="submit" size="sm" className="w-full">
            Send test email
          </Button>
          <p className="text-[11px] text-[#9aaba2]">
            The result appears in the delivery log below, including the exact
            provider error if it fails.
          </p>
        </form>
      </section>

      {isAdmin ? (
        <section className="space-y-4 rounded-lg border border-[#24302b] bg-[#121a17] p-4">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#b08d1f]">
                Panel team
              </h3>
              <a
                href="/admin/team"
                className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#6eb4c8] hover:text-[#9ad0de]"
              >
                Open profiles →
              </a>
            </div>
            <p className="mt-1 text-xs text-[#9aaba2]">
              Admins can invite and dormant. Super Admin has absolute delete control
              across users, clients, invoices, quotes, projects, and conversations.
              One email is one account — panel staff never appear as clients.
            </p>
          </div>
          <form action={inviteStaffAction} className="grid gap-2 sm:grid-cols-4">
            <Input name="email" type="email" required placeholder="Admin email" />
            <Input name="fullName" placeholder="Full name" />
            <select
              name="role"
              defaultValue="ADMIN"
              className="h-9 rounded-md border border-[#24302b] bg-[#0b1210] px-2 text-sm"
            >
              <option value="ADMIN">Admin</option>
              <option value="STAFF">Staff</option>
            </select>
            <Button type="submit" size="sm">
              Email invite
            </Button>
          </form>
          <ul className="divide-y divide-[#24302b] rounded-md border border-[#24302b]">
            {(staffProfiles ?? []).map((row) => {
              const dormant = row.account_status === "dormant";
              return (
                <li
                  key={String(row.id)}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                >
                  <div>
                    <p className="text-sm">
                      {String(row.full_name || row.email)}{" "}
                      <span className="font-mono text-[10px] text-[#9aaba2]">
                        {String(row.role)}
                        {dormant ? " · dormant" : ""}
                      </span>
                    </p>
                    <p className="font-mono text-xs text-[#9aaba2]">
                      {String(row.email)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {String(row.id) !== profile.id ? (
                      <form action={startTeamThreadAction}>
                        <input type="hidden" name="peerId" value={String(row.id)} />
                        <Button type="submit" size="sm" variant="outline">
                          Message
                        </Button>
                      </form>
                    ) : null}
                    <form action={setMemberDormantAction}>
                      <input type="hidden" name="userId" value={String(row.id)} />
                      <input
                        type="hidden"
                        name="dormant"
                        value={dormant ? "false" : "true"}
                      />
                      <Button type="submit" size="sm" variant="outline">
                        {dormant ? "Reactivate" : "Dormant"}
                      </Button>
                    </form>
                    {isSuperAdmin && row.role !== "SUPER_ADMIN" ? (
                      <form action={deleteUserAction}>
                        <input type="hidden" name="userId" value={String(row.id)} />
                        <input type="hidden" name="returnTo" value="/admin/settings" />
                        <Button type="submit" size="sm" variant="ghost">
                          Delete
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {whatsappLog.length > 0 ? (
        <section className="space-y-3">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#9aaba2]">
            WhatsApp log
          </h3>
          <div className="overflow-x-auto rounded-lg border border-[#24302b]">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-[#121a17] font-mono text-[10px] uppercase tracking-[0.14em] text-[#9aaba2]">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">To</th>
                  <th className="px-3 py-2">Template</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {whatsappLog.map((row) => (
                  <tr key={String(row.id)} className="border-t border-[#24302b]">
                    <td className="px-3 py-2 font-mono text-xs text-[#9aaba2]">
                      {relativeTime(String(row.created_at))}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {String(row.to_phone)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {String(row.template)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {String(row.status)}
                      {row.error ? (
                        <span className="ml-2 text-red-300">{String(row.error)}</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#9aaba2]">
            Delivery log
          </h3>
          {failures > 0 ? (
            <p className="font-mono text-xs text-red-400">
              {failures} not delivered
            </p>
          ) : null}
        </div>
        {log.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[#24302b] px-4 py-8 text-center text-sm text-[#9aaba2]">
            No emails sent yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[#24302b]">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-[#121a17] font-mono text-[10px] uppercase tracking-[0.14em] text-[#9aaba2]">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Template</th>
                  <th className="px-3 py-2">To</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {log.map((row) => (
                  <tr key={row.id} className="border-t border-[#24302b]">
                    <td className="px-3 py-2 font-mono text-xs text-[#9aaba2]">
                      {relativeTime(row.created_at as string)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {String(row.template)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {String(row.to_email)}
                    </td>
                    <td className="px-3 py-2">
                      <Status
                        ok={row.status === "sent"}
                        label={String(row.status)}
                      />
                      {row.error ? (
                        <p className="mt-0.5 max-w-xs truncate text-[11px] text-red-300">
                          {String(row.error)}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
