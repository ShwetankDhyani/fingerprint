import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { siteUrl } from "@/lib/env";
import {
  ensureEmailMembership,
  isStaffProfileRole,
} from "@/lib/portal/access";
import { hashToken, mintToken } from "@/lib/portal/utils";

function inviteUrlFor(token: string) {
  return `${siteUrl()}/invite/${token}`;
}

export type PortalAccessLink = {
  /** Absolute URL for the CTA. */
  url: string;
  /** True when the person still needs to set a password via invite. */
  needsPasswordSetup: boolean;
  inviteId?: string;
};

/**
 * After a first payment, make sure the payer can open the client portal.
 * - Existing client login → link to sign in.
 * - No login yet → create (or refresh) a CLIENT invite and return that URL.
 *
 * Does not send mail itself — the payment confirmation email carries the link.
 */
export async function ensureClientPortalAccessInvite(
  admin: SupabaseClient,
  input: {
    email?: string | null;
    fullName?: string | null;
    organizationId?: string | null;
    organizationName?: string | null;
    phone?: string | null;
    /** Stored on the invite for audit — e.g. quote number. */
    sourceRef?: string | null;
  },
): Promise<PortalAccessLink | null> {
  const email = input.email?.trim().toLowerCase();
  const organizationId = input.organizationId;
  if (!email || !organizationId) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("id, role")
    .ilike("email", email)
    .maybeSingle();

  // Staff emails never become client logins.
  if (profile?.id && isStaffProfileRole(String(profile.role))) {
    return null;
  }

  // Already has a client profile → they can sign in.
  if (profile?.id) {
    await ensureEmailMembership(admin, {
      email,
      organizationId,
      memberRole: "owner",
    });
    return {
      url: `${siteUrl()}/login`,
      needsPasswordSetup: false,
    };
  }

  // Reuse an open client invite for this email + org when we still have the token.
  const { data: openInvite } = await admin
    .from("invites")
    .select("id, token_plain, expires_at, role, organization_id")
    .ilike("email", email)
    .is("accepted_at", null)
    .in("role", ["CLIENT", "CLIENT_VIEWER"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const fullName =
    input.fullName?.trim() ||
    input.organizationName?.trim() ||
    email.split("@")[0];

  if (
    openInvite?.id &&
    openInvite.token_plain &&
    new Date(String(openInvite.expires_at)).getTime() > Date.now()
  ) {
    // Point the invite at this org if it was floating.
    if (
      !openInvite.organization_id ||
      openInvite.organization_id !== organizationId
    ) {
      await admin
        .from("invites")
        .update({ organization_id: organizationId })
        .eq("id", openInvite.id);
    }
    await admin
      .from("invites")
      .update({ last_sent_at: new Date().toISOString(), send_error: null })
      .eq("id", openInvite.id);

    return {
      url: inviteUrlFor(String(openInvite.token_plain)),
      needsPasswordSetup: true,
      inviteId: openInvite.id as string,
    };
  }

  const token = mintToken();
  const expires = new Date();
  expires.setDate(expires.getDate() + 14);

  // Refresh a stale open invite in place, or insert a new one.
  if (openInvite?.id) {
    const { error } = await admin
      .from("invites")
      .update({
        full_name: fullName,
        phone: input.phone || null,
        role: "CLIENT",
        organization_id: organizationId,
        token_hash: hashToken(token),
        token_plain: token,
        expires_at: expires.toISOString(),
        last_sent_at: new Date().toISOString(),
        send_error: null,
        meta: {
          source: "payment_onboarding",
          ref: input.sourceRef ?? null,
        },
      })
      .eq("id", openInvite.id);
    if (error) {
      console.error("[onboarding-invite] refresh failed", error.message);
      return null;
    }
    return {
      url: inviteUrlFor(token),
      needsPasswordSetup: true,
      inviteId: openInvite.id as string,
    };
  }

  const { data: created, error } = await admin
    .from("invites")
    .insert({
      email,
      full_name: fullName,
      phone: input.phone || null,
      role: "CLIENT",
      organization_id: organizationId,
      token_hash: hashToken(token),
      token_plain: token,
      expires_at: expires.toISOString(),
      invited_by: null,
      last_sent_at: new Date().toISOString(),
      meta: {
        source: "payment_onboarding",
        ref: input.sourceRef ?? null,
      },
    })
    .select("id")
    .single();

  if (error || !created?.id) {
    console.error("[onboarding-invite] insert failed", error?.message);
    return null;
  }

  return {
    url: inviteUrlFor(token),
    needsPasswordSetup: true,
    inviteId: created.id as string,
  };
}
