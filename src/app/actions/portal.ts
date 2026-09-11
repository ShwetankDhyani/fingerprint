"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createServerSupabase,
  homeForRole,
  isAuthConfigured,
  requirePortalProfile,
  requireStaff,
  requireAdmin,
  requireSuperAdmin,
  isAdminRole,
  isSuperAdminRole,
  type AppRole,
} from "@/lib/auth/session";
import { emailSettings, isEmailConfigured, siteUrl } from "@/lib/env";
import {
  sendInviteEmail,
  sendInvoiceEmail,
  sendPasswordResetEmail,
  sendQuoteEmail,
  sendSnapshotEmail,
  sendTestEmail,
  sendTicketCreatedEmails,
  sendTicketReplyEmail,
} from "@/lib/email/notifications";
import {
  sendMilestoneCompletedEmail,
  sendProjectHandoverEmail,
} from "@/lib/email/lifecycle";
import {
  assertEmailInviteAllowed,
  detachStaffFromClientOrgs,
  ensureClientOrganization,
  ensureEmailMembership,
  ensureLeadRecord,
  isStaffProfileRole,
  markLeadConverted,
} from "@/lib/portal/access";
import { MILESTONE_STATUS_LABEL, labelOf } from "@/lib/portal/labels";
import { isProtectedPortalEmail } from "@/lib/portal/auth-safety";
import { ensureProjectForPaidQuote } from "@/lib/portal/ensure-project";
import { getProjectFinancialSummary } from "@/lib/portal/finance";
import { notifyStaff } from "@/lib/portal/notify";
import {
  ensureAuthUserForListedIdentity,
  findListedPortalIdentity,
} from "@/lib/portal/password-reset";
import {
  uploadPortalImage,
  uploadProjectScreenshot,
} from "@/lib/portal/media";
import {
  formatInr,
  hashToken,
  logActivity,
  mintToken,
  nextInvoiceNumber,
  nextProjectCode,
  nextQuoteNumber,
  nextTicketNumber,
  paiseFromInr,
  slugify,
} from "@/lib/portal/utils";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendInvoiceWhatsApp, sendQuoteWhatsApp } from "@/lib/whatsapp";
import {
  WHATSAPP_EVENT_KEYS,
  type WhatsAppEventKey,
  updateWhatsAppEventSettings,
} from "@/lib/whatsapp-events";

function db() {
  const client = getSupabaseAdmin();
  if (!client) throw new Error("Database is not configured.");
  return client;
}

export type AuthFormState = { ok: boolean; message: string };

export async function signOutAction() {
  const supabase = await createServerSupabase();
  if (supabase) await supabase.auth.signOut();
  redirect("/login");
}

export async function signInAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!isAuthConfigured()) {
    return {
      ok: false,
      message:
        "Portal auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { ok: false, message: "Email and password are required." };
  }

  const supabase = await createServerSupabase();
  if (!supabase) return { ok: false, message: "Auth client unavailable." };

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.user) {
    return { ok: false, message: error?.message ?? "Invalid credentials." };
  }

  // Prefer service role, but fall back to the signed-in user's RLS so a missing
  // service key never dumps staff into the client shell.
  const admin = getSupabaseAdmin();
  const profileClient = admin ?? supabase;
  const { data: profile } = await profileClient
    .from("profiles")
    .select("role, account_status")
    .eq("id", data.user.id)
    .maybeSingle();

  if ((profile?.account_status as string | undefined) === "dormant") {
    await supabase.auth.signOut();
    return {
      ok: false,
      message:
        "This login is dormant. Contact Lynx if you need access restored.",
    };
  }

  if (admin) {
    await admin
      .from("profiles")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", data.user.id);
  }

  redirect(homeForRole((profile?.role as AppRole) ?? "CLIENT"));
}

export async function acceptInviteAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  let fullName = String(formData.get("fullName") ?? "").trim();

  if (!token || password.length < 8) {
    return { ok: false, message: "Password must be at least 8 characters." };
  }

  // Browsers often autofill a saved password into the name field on invite forms.
  // Never store or greet with that value.
  if (!fullName || fullName === password || fullName.includes(password)) {
    fullName = "";
  }

  const admin = db();
  const { data: invite } = await admin
    .from("invites")
    .select("*")
    .eq("token_hash", hashToken(token))
    .is("accepted_at", null)
    .maybeSingle();

  if (!invite) {
    return { ok: false, message: "Invite is invalid or already used." };
  }
  if (new Date(invite.expires_at as string).getTime() < Date.now()) {
    return { ok: false, message: "This invite has expired." };
  }

  const email = String(invite.email).trim().toLowerCase();
  const resolvedName =
    fullName || String(invite.full_name ?? "").trim() || email.split("@")[0];

  let userId: string | null = null;
  const inviteRole = String(invite.role);

  // Resolve any existing profile BEFORE touching Auth passwords.
  // Staff/admin passwords must never be overwritten by invite acceptance —
  // including when the invite is later rejected for role conflicts.
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id, full_name, role")
    .ilike("email", email)
    .maybeSingle();
  const priorRole = String(existingProfile?.role ?? "");

  if (isStaffProfileRole(priorRole) && !isStaffProfileRole(inviteRole)) {
    return {
      ok: false,
      message:
        "This email belongs to a panel admin/staff account and cannot become a client login. Use a different email for the client.",
    };
  }

  if (isStaffProfileRole(priorRole)) {
    return {
      ok: false,
      message:
        "This email already has a panel login. Sign in with your existing password (use Forgot password if needed). Do not re-accept an invite to reset staff access.",
    };
  }

  // Belt-and-suspenders: known owner/admin emails never get password writes
  // from invite acceptance, even if the profile row is missing/corrupt.
  if (isProtectedPortalEmail(email)) {
    return {
      ok: false,
      message:
        "This email is a protected panel account. Sign in with the existing password or use Forgot password — invites cannot reset it.",
    };
  }

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: resolvedName },
    app_metadata: { role: invite.role },
  });

  if (created?.user) {
    userId = created.user.id;
  } else {
    // Existing Auth user (client / orphan) — attach membership; password update
    // is allowed only when this email is not a staff/admin profile.
    if (!existingProfile?.id) {
      const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const match = listed.data?.users?.find(
        (u) => u.email?.toLowerCase() === email,
      );
      if (!match) {
        return {
          ok: false,
          message:
            error?.message ??
            "Unable to create account. If you already have access, sign in and ask Lynx to re-link your workspace.",
        };
      }
      userId = match.id;
    } else {
      userId = existingProfile.id as string;
    }

    const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: { full_name: resolvedName },
      app_metadata: { role: invite.role },
    });
    if (updateErr) {
      return {
        ok: false,
        message: updateErr.message ?? "Unable to update existing account.",
      };
    }
  }

  if (!userId) {
    return { ok: false, message: "Unable to create account." };
  }

  const nextRole = isStaffProfileRole(inviteRole)
    ? inviteRole
    : isStaffProfileRole(priorRole)
      ? priorRole
      : inviteRole;

  const { error: profileErr } = await admin.from("profiles").upsert({
    id: userId,
    email,
    full_name: resolvedName,
    role: nextRole,
  });
  if (profileErr) {
    return { ok: false, message: profileErr.message };
  }

  if (isStaffProfileRole(String(nextRole))) {
    await detachStaffFromClientOrgs(admin, userId);
  }

  if (invite.organization_id && !isStaffProfileRole(String(nextRole))) {
    const { error: memberErr } = await admin.from("organization_members").upsert(
      {
        organization_id: invite.organization_id,
        user_id: userId,
        member_role: invite.role === "CLIENT_VIEWER" ? "viewer" : "owner",
        can_comment: true,
        can_approve: invite.role === "CLIENT",
        can_pay: invite.role === "CLIENT",
      },
      { onConflict: "organization_id,user_id" },
    );
    if (memberErr) {
      return {
        ok: false,
        message: `Account created but workspace link failed: ${memberErr.message}`,
      };
    }

    await ensureEmailMembership(admin, {
      email,
      organizationId: invite.organization_id as string,
      memberRole: invite.role === "CLIENT_VIEWER" ? "viewer" : "owner",
    });
  }

  await admin
    .from("invites")
    .update({
      accepted_at: new Date().toISOString(),
      token_plain: null,
    })
    .eq("id", invite.id);

  await logActivity(admin, {
    actorId: userId,
    organizationId: invite.organization_id as string | null,
    action: "accepted",
    entityType: "invite",
    entityId: invite.id as string,
    summary: `${email} accepted invite`,
  });

  const supabase = await createServerSupabase();
  if (supabase) {
    await supabase.auth.signInWithPassword({ email, password });
  }

  redirect(homeForRole(nextRole as AppRole));
}


type AdminClient = ReturnType<typeof db>;

/**
 * Creates the invite row, emails it, and records the outcome so the admin UI
 * can always show a copyable link — even when the mail provider is down.
 */
async function issueInvite(
  admin: AdminClient,
  input: {
    email: string;
    fullName: string;
    phone?: string | null;
    role: AppRole;
    organizationId: string | null;
    organizationName?: string | null;
    invitedById: string;
    invitedByName?: string | null;
  },
) {
  const email = input.email.trim().toLowerCase();
  const inviteCheck = await assertEmailInviteAllowed(admin, {
    email,
    role: input.role,
  });
  // Staff invite of an existing client: promote immediately so they leave the client list.
  if (inviteCheck.promoteClientToStaff && inviteCheck.existing) {
    await admin
      .from("profiles")
      .update({ role: input.role })
      .eq("id", inviteCheck.existing.id);
    await detachStaffFromClientOrgs(admin, String(inviteCheck.existing.id));
  }

  const token = mintToken();
  const expires = new Date();
  expires.setDate(expires.getDate() + 14);

  const { data, error } = await admin
    .from("invites")
    .insert({
      email,
      full_name: input.fullName,
      phone: input.phone || null,
      role: input.role,
      organization_id: input.organizationId,
      token_hash: hashToken(token),
      token_plain: token,
      expires_at: expires.toISOString(),
      invited_by: input.invitedById,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const result = await sendInviteEmail({
    email,
    fullName: input.fullName,
    token,
    role: input.role,
    organizationName: input.organizationName,
    organizationId: input.organizationId,
    invitedBy: input.invitedByName,
  });

  await admin
    .from("invites")
    .update({
      last_sent_at: result.sent ? new Date().toISOString() : null,
      send_error: result.sent ? null : (result.error ?? "Email not sent."),
    })
    .eq("id", data.id);

  // If this email already has a portal login, link the org immediately so
  // projects/quotes appear without waiting for another accept cycle.
  if (input.organizationId) {
    await ensureEmailMembership(admin, {
      email,
      organizationId: input.organizationId,
      memberRole: input.role === "CLIENT_VIEWER" ? "viewer" : "owner",
    });
  }

  return { ...result, inviteId: data.id as string };
}

export async function resendInviteAction(formData: FormData) {
  const profile = await requireStaff();
  const admin = db();
  const inviteId = String(formData.get("inviteId") ?? "");
  if (!inviteId) throw new Error("Missing invite.");

  const { data: invite } = await admin
    .from("invites")
    .select("*, organizations(name)")
    .eq("id", inviteId)
    .maybeSingle();
  if (!invite) throw new Error("Invite not found.");
  if (invite.accepted_at) throw new Error("This invite was already accepted.");

  let token = invite.token_plain as string | null;
  if (!token) {
    // Legacy invite stored only the hash — mint a fresh token in place.
    token = mintToken();
    await admin
      .from("invites")
      .update({ token_hash: hashToken(token), token_plain: token })
      .eq("id", inviteId);
  }

  const org = invite.organizations as { name?: string } | null;
  const result = await sendInviteEmail({
    email: invite.email as string,
    fullName: (invite.full_name as string) ?? "",
    token,
    role: (invite.role as string | null) ?? null,
    organizationName: org?.name ?? null,
    organizationId: (invite.organization_id as string | null) ?? null,
    invitedBy: profile.full_name || profile.email,
  });

  await admin
    .from("invites")
    .update({
      last_sent_at: result.sent ? new Date().toISOString() : null,
      send_error: result.sent ? null : (result.error ?? "Email not sent."),
    })
    .eq("id", inviteId);

  revalidatePath(`/admin/clients/${invite.organization_id}`);
  revalidatePath("/admin/clients");
}

export async function revokeInviteAction(formData: FormData) {
  await requireStaff();
  const admin = db();
  const inviteId = String(formData.get("inviteId") ?? "");
  const organizationId = String(formData.get("organizationId") ?? "");
  if (!inviteId) throw new Error("Missing invite.");
  // Wipe plaintext token before delete in case soft-delete/audit retains the row.
  await admin.from("invites").update({ token_plain: null }).eq("id", inviteId);
  await admin.from("invites").delete().eq("id", inviteId);
  revalidatePath(`/admin/clients/${organizationId}`);
}

export async function updateOrganizationNotesAction(formData: FormData) {
  const profile = await requireStaff();
  const admin = db();
  const organizationId = String(formData.get("organizationId") ?? "").trim();
  const notes = String(formData.get("notes") ?? "");
  if (!organizationId) throw new Error("Missing organization.");

  const { data: before, error: readError } = await admin
    .from("organizations")
    .select("name, notes_internal")
    .eq("id", organizationId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!before) throw new Error("Organization not found.");

  const { error } = await admin
    .from("organizations")
    .update({ notes_internal: notes })
    .eq("id", organizationId);
  if (error) throw new Error(error.message);

  await logActivity(admin, {
    actorId: profile.id,
    organizationId,
    action: "updated",
    entityType: "organization",
    entityId: organizationId,
    summary: `Updated internal notes for ${before.name}`,
    beforeState: { notes_internal: before.notes_internal },
    afterState: { notes_internal: notes },
  });

  revalidatePath(`/admin/clients/${organizationId}`);
  revalidatePath("/admin/clients");
}

export async function createOrganizationAction(formData: FormData) {
  const profile = await requireStaff();
  const admin = db();

  const name = String(formData.get("name") ?? "").trim();
  const billingEmail = String(formData.get("billingEmail") ?? "").trim();
  const website = String(formData.get("website") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const contactName = String(formData.get("primaryContactName") ?? "").trim();
  const inviteEmail = String(formData.get("inviteEmail") ?? "")
    .trim()
    .toLowerCase();
  const inviteName = String(formData.get("inviteName") ?? "").trim();

  if (!name) throw new Error("Organization name is required.");

  const slug = `${slugify(name) || "client"}-${Date.now().toString(36).slice(-4)}`;
  const { data, error } = await admin
    .from("organizations")
    .insert({
      name,
      slug,
      billing_email: billingEmail || null,
      website: website || null,
      phone: phone || null,
      primary_contact_name: contactName || null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await logActivity(admin, {
    actorId: profile.id,
    organizationId: data.id,
    action: "created",
    entityType: "organization",
    entityId: data.id,
    summary: `Created organization ${name}`,
  });

  if (inviteEmail) {
    await issueInvite(admin, {
      email: inviteEmail,
      fullName: inviteName || name,
      phone,
      role: "CLIENT",
      organizationId: data.id,
      organizationName: name,
      invitedById: profile.id,
      invitedByName: profile.full_name || profile.email,
    });
  }

  revalidatePath("/admin/clients");
  redirect(`/admin/clients/${data.id}`);
}

export async function inviteClientAction(formData: FormData) {
  const profile = await requireStaff();
  const admin = db();
  const organizationId = String(formData.get("organizationId") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const roleRaw = String(formData.get("role") ?? "CLIENT");
  const role: AppRole =
    roleRaw === "CLIENT_VIEWER" ? "CLIENT_VIEWER" : "CLIENT";

  if (!organizationId || !email) throw new Error("Missing invite fields.");

  const { data: org } = await admin
    .from("organizations")
    .select("name")
    .eq("id", organizationId)
    .maybeSingle();

  const result = await issueInvite(admin, {
    email,
    fullName,
    phone,
    role,
    organizationId,
    organizationName: org?.name ?? null,
    invitedById: profile.id,
    invitedByName: profile.full_name || profile.email,
  });

  await logActivity(admin, {
    actorId: profile.id,
    organizationId,
    action: "invited",
    entityType: "invite",
    summary: result.sent
      ? `Invited ${email}`
      : `Invite created for ${email} (email not sent)`,
    meta: { role, emailSent: result.sent, error: result.error ?? null },
  });

  revalidatePath(`/admin/clients/${organizationId}`);
}

export async function createProjectAction(formData: FormData) {
  const profile = await requireStaff();
  const admin = db();

  const organizationId = String(formData.get("organizationId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  if (!organizationId || !name) throw new Error("Missing project fields.");

  const { data: org } = await admin
    .from("organizations")
    .select("slug, name")
    .eq("id", organizationId)
    .single();

  const code = nextProjectCode(org?.slug ?? "lwx");
  const { data, error } = await admin
    .from("projects")
    .insert({
      organization_id: organizationId,
      name,
      code,
      summary,
      status: "intake",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await admin.from("threads").insert({
    organization_id: organizationId,
    project_id: data.id,
    subject: `${name} · conversation`,
    kind: "project",
  });

  await logActivity(admin, {
    actorId: profile.id,
    organizationId,
    projectId: data.id,
    action: "created",
    entityType: "project",
    entityId: data.id,
    summary: `Created project ${name} (${code}) for ${org?.name ?? "client"}`,
  });

  const { data: orgRow } = await admin
    .from("organizations")
    .select("billing_email")
    .eq("id", organizationId)
    .maybeSingle();
  if (orgRow?.billing_email) {
    await ensureEmailMembership(admin, {
      email: orgRow.billing_email as string,
      organizationId,
      memberRole: "owner",
    });
  }
  const { data: orgInvites } = await admin
    .from("invites")
    .select("email, role")
    .eq("organization_id", organizationId);
  for (const inv of orgInvites ?? []) {
    await ensureEmailMembership(admin, {
      email: inv.email as string,
      organizationId,
      memberRole: inv.role === "CLIENT_VIEWER" ? "viewer" : "owner",
    });
  }

  revalidatePath("/admin/projects");
  revalidatePath("/client/projects");
  redirect(`/admin/projects/${data.id}`);
}

export async function createMilestoneAction(formData: FormData) {
  const profile = await requireStaff();
  const admin = db();

  const projectId = String(formData.get("projectId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const dueAt = String(formData.get("dueAt") ?? "") || null;
  const clientVisible = formData.get("clientVisible") === "on";
  const paymentInr = Number(formData.get("paymentInr") ?? 0);
  if (!projectId || !title) throw new Error("Missing milestone fields.");

  const { data: project } = await admin
    .from("projects")
    .select("organization_id, name")
    .eq("id", projectId)
    .single();

  const { count } = await admin
    .from("milestones")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId);

  const { data, error } = await admin
    .from("milestones")
    .insert({
      project_id: projectId,
      title,
      due_at: dueAt,
      client_visible: clientVisible,
      sort_order: count ?? 0,
      status: "upcoming",
      payment_amount_minor: paymentInr > 0 ? paiseFromInr(paymentInr) : null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await logActivity(admin, {
    actorId: profile.id,
    organizationId: project?.organization_id,
    projectId,
    action: "created",
    entityType: "milestone",
    entityId: data.id,
    summary: `Added milestone “${title}” on ${project?.name}`,
  });

  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath(`/client/projects/${projectId}`);
}

const MILESTONE_STATUSES = [
  "upcoming",
  "in_progress",
  "review",
  "done",
  "blocked",
];

/**
 * Moving a milestone to done is a client-facing moment, so the mail goes out
 * from here rather than from a separate screen — the status change, the
 * activity entry and the email are one step and can't drift apart.
 */
export async function setMilestoneStatusAction(formData: FormData) {
  const profile = await requireStaff();
  const admin = db();

  const milestoneId = String(formData.get("milestoneId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  if (!milestoneId) throw new Error("Missing milestone.");
  if (!MILESTONE_STATUSES.includes(status)) {
    throw new Error("Invalid milestone status.");
  }

  const { data: milestone } = await admin
    .from("milestones")
    .select(
      "id, title, status, project_id, client_visible, client_notified_at, projects(id, name, organization_id)",
    )
    .eq("id", milestoneId)
    .maybeSingle();
  if (!milestone) throw new Error("Milestone not found.");

  const project = milestone.projects as unknown as {
    id: string;
    name: string;
    organization_id: string | null;
  } | null;
  const projectId = String(milestone.project_id);
  const done = status === "done";
  const wasDone = String(milestone.status) === "done";

  const { error } = await admin
    .from("milestones")
    .update({
      status,
      completed_at: done ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", milestoneId);
  if (error) throw new Error(error.message);

  await logActivity(admin, {
    actorId: profile.id,
    organizationId: project?.organization_id ?? null,
    projectId,
    action: done ? "completed" : "updated",
    entityType: "milestone",
    entityId: milestoneId,
    summary: done
      ? `Completed “${milestone.title}” on ${project?.name ?? "project"}`
      : `Moved “${milestone.title}” to ${labelOf(MILESTONE_STATUS_LABEL, status)}`,
  });

  // Tell the client once, and only about work they can actually see.
  if (
    done &&
    !wasDone &&
    milestone.client_visible &&
    !milestone.client_notified_at &&
    project?.organization_id
  ) {
    const { data: members } = await admin
      .from("organization_members")
      .select("profiles(email)")
      .eq("organization_id", project.organization_id);
    const recipients = [
      ...new Set(
        (members ?? [])
          .map((row) => (row.profiles as { email?: string } | null)?.email)
          .filter((value): value is string => Boolean(value)),
      ),
    ];

    const sent = await sendMilestoneCompletedEmail({
      to: recipients,
      projectName: project.name,
      projectId,
      milestoneTitle: String(milestone.title),
      organizationId: project.organization_id,
      milestoneId,
    }).catch((error) => {
      console.error("[milestones] email failed", error);
      return null;
    });

    if (sent?.sent) {
      await admin
        .from("milestones")
        .update({ client_notified_at: new Date().toISOString() })
        .eq("id", milestoneId);
    }
  }

  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath(`/client/projects/${projectId}`);
  revalidatePath("/admin");
}

export async function createQuoteAction(formData: FormData) {
  const profile = await requireStaff();
  const admin = db();

  let organizationId = String(formData.get("organizationId") ?? "") || null;
  let leadId = String(formData.get("leadId") ?? "") || null;
  const projectId = String(formData.get("projectId") ?? "") || null;
  const title = String(formData.get("title") ?? "").trim();
  const recipientEmail = String(formData.get("recipientEmail") ?? "")
    .trim()
    .toLowerCase();
  const recipientName = String(formData.get("recipientName") ?? "").trim();
  const recipientPhone = String(formData.get("recipientPhone") ?? "").trim();

  // Keep unpaid prospects on Leads — only become Clients after advance payment.
  // Explicit organizationId means quoting an existing client.
  if (!organizationId) {
    if (!leadId && (recipientEmail || recipientName)) {
      leadId = await ensureLeadRecord(admin, {
        name: recipientName || title,
        email: recipientEmail || null,
        phone: recipientPhone || null,
        company: recipientName || title,
        projectType: title,
        scope: title,
        source: "admin_quote",
      });
    } else if (leadId) {
      await admin
        .from("leads")
        .update({
          status: "contacted",
          updated_at: new Date().toISOString(),
        })
        .eq("id", leadId)
        .eq("status", "new");
    }
  }
  const lineLabel = String(formData.get("lineLabel") ?? "").trim();
  const lineAmountInr = Number(formData.get("lineAmountInr") ?? 0);
  const taxInr = Number(formData.get("taxInr") ?? 0);
  const discountInr = Number(formData.get("discountInr") ?? 0);
  const advanceInr = Number(formData.get("advanceInr") ?? 0);
  const validDays = Number(formData.get("validDays") ?? 14);
  const terms = String(formData.get("terms") ?? "").trim();
  const sendNow = formData.get("sendNow") === "on";

  if (!title || !lineLabel || lineAmountInr <= 0) {
    throw new Error("Quote title and a priced line item are required.");
  }

  const quoteNumber = await nextQuoteNumber(admin);
  const subtotal = paiseFromInr(lineAmountInr);
  const tax = paiseFromInr(taxInr);
  const discount = paiseFromInr(discountInr);
  const total = Math.max(0, subtotal + tax - discount);
  const advance =
    advanceInr > 0 ? paiseFromInr(advanceInr) : Math.round(total * 0.4);

  const shareToken = mintToken();
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + (validDays || 14));

  const { data: quote, error } = await admin
    .from("quotes")
    .insert({
      organization_id: organizationId,
      project_id: projectId,
      created_by: profile.id,
      quote_number: quoteNumber,
      title,
      status: sendNow ? "sent" : "draft",
      subtotal_minor: subtotal,
      tax_minor: tax,
      discount_minor: discount,
      total_minor: total,
      advance_minor: advance,
      valid_until: validUntil.toISOString(),
      share_token: shareToken,
      share_token_hash: hashToken(shareToken),
      share_expires_at: validUntil.toISOString(),
      sent_at: sendNow ? new Date().toISOString() : null,
      recipient_email: recipientEmail || null,
      recipient_name: recipientName || null,
      recipient_phone: recipientPhone || null,
      terms:
        terms ||
        "Advance due on acceptance. Balance per milestone schedule. Scope changes require a revised quote.",
      meta: leadId ? { lead_id: leadId } : {},
    })
    .select("id, quote_number")
    .single();
  if (error) throw new Error(error.message);

  if (organizationId && recipientEmail) {
    await ensureEmailMembership(admin, {
      email: recipientEmail,
      organizationId,
      memberRole: "owner",
    });
  }

  await admin.from("quote_line_items").insert({
    quote_id: quote.id,
    sort_order: 0,
    label: lineLabel,
    description: String(formData.get("lineDescription") ?? ""),
    quantity: 1,
    unit_amount_minor: subtotal,
    amount_minor: subtotal,
  });

  let emailed = false;
  if (sendNow && recipientEmail) {
    const result = await sendQuoteEmail({
      to: recipientEmail,
      recipientName,
      quoteNumber,
      title,
      totalMinor: total,
      advanceMinor: advance,
      validUntil: validUntil.toISOString(),
      shareToken,
      organizationId,
      quoteId: quote.id,
    });
    emailed = result.sent;
    if (result.sent) {
      await admin
        .from("quotes")
        .update({ last_emailed_at: new Date().toISOString() })
        .eq("id", quote.id);

      await sendQuoteWhatsApp({
        toPhone: recipientPhone,
        clientName: recipientName,
        quoteNumber,
        title,
        totalMinor: total,
        url: result.url,
        organizationId,
        quoteId: quote.id,
      }).catch((error) => console.error("[quotes] whatsapp failed", error));
    }
  }

  await admin.from("quote_events").insert({
    quote_id: quote.id,
    event_type: sendNow ? "sent" : "drafted",
    summary: sendNow
      ? emailed
        ? `Quote sent to ${recipientEmail}`
        : "Quote marked sent (share link ready)"
      : "Quote drafted",
    meta: leadId ? { leadId } : {},
  });

  await logActivity(admin, {
    actorId: profile.id,
    organizationId,
    projectId,
    action: sendNow ? "sent" : "drafted",
    entityType: "quote",
    entityId: quote.id,
    summary: `${sendNow ? "Sent" : "Drafted"} ${quoteNumber} — ${title}`,
    meta: leadId ? { leadId } : {},
  });

  // Quoting a lead is contact — it should silence the stale-lead nudge.
  if (leadId && sendNow) {
    await admin
      .from("leads")
      .update({
        status: "contacted",
        last_contacted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId)
      .eq("status", "new");
  }

  revalidatePath("/admin/quotes");
  revalidatePath("/admin/leads");
  if (leadId) revalidatePath(`/admin/leads/${leadId}`);
  redirect(`/admin/quotes/${quote.id}`);
}

export async function emailQuoteAction(formData: FormData) {
  const profile = await requireStaff();
  const admin = db();
  const quoteId = String(formData.get("quoteId") ?? "");
  const overrideEmail = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!quoteId) throw new Error("Missing quote.");

  const { data: quote } = await admin
    .from("quotes")
    .select("*")
    .eq("id", quoteId)
    .maybeSingle();
  if (!quote) throw new Error("Quote not found.");

  const to = overrideEmail || (quote.recipient_email as string | null);
  if (!to) throw new Error("Add a recipient email on this quote first.");

  let shareToken = quote.share_token as string | null;
  if (!shareToken) {
    shareToken = mintToken();
    await admin
      .from("quotes")
      .update({
        share_token: shareToken,
        share_token_hash: hashToken(shareToken),
      })
      .eq("id", quoteId);
  }

  const result = await sendQuoteEmail({
    to,
    recipientName: quote.recipient_name as string | null,
    quoteNumber: quote.quote_number as string,
    title: quote.title as string,
    totalMinor: Number(quote.total_minor),
    advanceMinor: Number(quote.advance_minor),
    validUntil: quote.valid_until as string | null,
    shareToken,
    organizationId: quote.organization_id as string | null,
    quoteId,
  });

  await admin
    .from("quotes")
    .update({
      status: quote.status === "draft" ? "sent" : quote.status,
      sent_at: quote.sent_at ?? new Date().toISOString(),
      last_emailed_at: result.sent ? new Date().toISOString() : null,
      recipient_email: to,
    })
    .eq("id", quoteId);

  if (quote.organization_id && to) {
    await ensureEmailMembership(admin, {
      email: to,
      organizationId: quote.organization_id as string,
      memberRole: "owner",
    });
  }

  if (result.sent) {
    await sendQuoteWhatsApp({
      toPhone: quote.recipient_phone as string | null,
      clientName: quote.recipient_name as string | null,
      quoteNumber: quote.quote_number as string,
      title: quote.title as string,
      totalMinor: Number(quote.total_minor),
      url: result.url,
      organizationId: quote.organization_id as string | null,
      quoteId,
    }).catch((error) => console.error("[quotes] whatsapp failed", error));
  }

  await admin.from("quote_events").insert({
    quote_id: quoteId,
    event_type: result.sent ? "emailed" : "email_failed",
    summary: result.sent
      ? `Quote emailed to ${to}`
      : `Email to ${to} failed: ${result.error ?? "unknown error"}`,
  });

  await logActivity(admin, {
    actorId: profile.id,
    organizationId: quote.organization_id as string | null,
    action: "emailed",
    entityType: "quote",
    entityId: quoteId,
    summary: `${result.sent ? "Emailed" : "Failed to email"} ${quote.quote_number} to ${to}`,
  });

  revalidatePath(`/admin/quotes/${quoteId}`);
}

export async function regenerateQuoteShareAction(formData: FormData) {
  const profile = await requireStaff();
  const admin = db();
  const quoteId = String(formData.get("quoteId") ?? "");
  const validDays = Number(formData.get("validDays") ?? 14) || 14;
  if (!quoteId) throw new Error("Missing quote.");

  const shareToken = mintToken();
  const expires = new Date();
  expires.setDate(expires.getDate() + validDays);

  const { data: quote, error } = await admin
    .from("quotes")
    .update({
      share_token: shareToken,
      share_token_hash: hashToken(shareToken),
      share_expires_at: expires.toISOString(),
    })
    .eq("id", quoteId)
    .select("quote_number, organization_id")
    .single();
  if (error) throw new Error(error.message);

  await admin.from("quote_events").insert({
    quote_id: quoteId,
    event_type: "link_regenerated",
    summary: `Share link regenerated (valid ${validDays} days)`,
  });

  await logActivity(admin, {
    actorId: profile.id,
    organizationId: quote.organization_id,
    action: "updated",
    entityType: "quote",
    entityId: quoteId,
    summary: `Regenerated share link for ${quote.quote_number}`,
  });

  revalidatePath(`/admin/quotes/${quoteId}`);
}

export async function setQuoteStatusAction(formData: FormData) {
  const profile = await requireStaff();
  const admin = db();
  const quoteId = String(formData.get("quoteId") ?? "");
  const status = String(formData.get("status") ?? "");
  const allowed = [
    "draft",
    "sent",
    "opened",
    "accepted",
    "declined",
    "expired",
    "converted",
  ];
  if (!quoteId || !allowed.includes(status)) {
    throw new Error("Invalid quote status.");
  }

  const { error } = await admin
    .from("quotes")
    .update({
      status,
      accepted_at: status === "accepted" ? new Date().toISOString() : null,
    })
    .eq("id", quoteId);
  if (error) throw new Error(error.message);

  await admin.from("quote_events").insert({
    quote_id: quoteId,
    event_type: status,
    summary: `Status set to ${status} by ${profile.full_name || profile.email}`,
  });

  revalidatePath(`/admin/quotes/${quoteId}`);
  revalidatePath("/admin/quotes");
}

export async function createInvoiceFromQuoteAction(formData: FormData) {
  const profile = await requireStaff();
  const admin = db();
  const quoteId = String(formData.get("quoteId") ?? "");
  if (!quoteId) throw new Error("Missing quote.");

  const { data: quote } = await admin
    .from("quotes")
    .select("*")
    .eq("id", quoteId)
    .single();
  if (!quote) throw new Error("Quote not found.");

  let organizationId = (quote.organization_id as string | null) ?? null;
  const leadId =
    ((quote.meta as { lead_id?: string } | null)?.lead_id as
      | string
      | undefined) ?? null;
  if (!organizationId) {
    organizationId = await ensureClientOrganization(admin, {
      name: quote.recipient_name as string | null,
      email: quote.recipient_email as string | null,
      phone: quote.recipient_phone as string | null,
      fallbackName: quote.title as string | null,
      leadId,
    });
    if (!organizationId) {
      throw new Error(
        "Could not create a client organization from this quote. Add a recipient email or attach a client first.",
      );
    }
    await admin
      .from("quotes")
      .update({ organization_id: organizationId })
      .eq("id", quote.id);
  }

  const invoiceNumber = await nextInvoiceNumber(admin);
  const due = new Date();
  due.setDate(due.getDate() + 7);
  const amount =
    (quote.advance_minor as number) || (quote.total_minor as number);

  const { data: invoice, error } = await admin
    .from("invoices")
    .insert({
      organization_id: organizationId,
      project_id: quote.project_id,
      quote_id: quote.id,
      invoice_number: invoiceNumber,
      status: "sent",
      subtotal_minor: amount,
      tax_minor: 0,
      total_minor: amount,
      amount_paid_minor: 0,
      due_at: due.toISOString().slice(0, 10),
      issued_at: new Date().toISOString().slice(0, 10),
      notes: `Advance for ${quote.quote_number}`,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await ensureEmailMembership(admin, {
    email: quote.recipient_email as string | null,
    organizationId,
    memberRole: "owner",
  });

  await admin.from("invoice_line_items").insert({
    invoice_id: invoice.id,
    sort_order: 0,
    label: `Advance — ${quote.title}`,
    description: quote.quote_number,
    quantity: 1,
    unit_amount_minor: amount,
    amount_minor: amount,
  });

  await admin.from("quotes").update({ status: "converted" }).eq("id", quoteId);

  const billingEmail = await resolveBillingEmail(
    admin,
    quote.organization_id as string,
    quote.recipient_email as string | null,
  );
  if (billingEmail) {
    await sendInvoiceEmail({
      to: billingEmail,
      invoiceNumber,
      amountDueMinor: amount,
      dueAt: due.toISOString().slice(0, 10),
      organizationId: quote.organization_id as string,
      invoiceId: invoice.id as string,
    });
  }

  await sendInvoiceWhatsApp({
    toPhone: quote.recipient_phone as string | null,
    clientName: quote.recipient_name as string | null,
    invoiceNumber,
    amountMinor: amount,
    dueAt: due.toISOString().slice(0, 10),
    organizationId: organizationId,
    invoiceId: invoice.id as string,
  }).catch((error) => console.error("[invoices] whatsapp failed", error));

  await logActivity(admin, {
    actorId: profile.id,
    organizationId: quote.organization_id,
    projectId: quote.project_id,
    action: "created",
    entityType: "invoice",
    entityId: invoice.id,
    summary: `Created ${invoiceNumber} from ${quote.quote_number} (${formatInr(amount)})`,
  });

  revalidatePath("/admin/invoices");
  redirect(`/admin/invoices/${invoice.id}`);
}

/** Prefers the organization billing inbox, then owners, then the quote contact. */
async function resolveBillingEmail(
  admin: AdminClient,
  organizationId: string,
  fallback?: string | null,
) {
  const { data: org } = await admin
    .from("organizations")
    .select("billing_email")
    .eq("id", organizationId)
    .maybeSingle();
  if (org?.billing_email) return org.billing_email as string;

  const { data: members } = await admin
    .from("organization_members")
    .select("profiles(email)")
    .eq("organization_id", organizationId)
    .limit(1);
  const profile = members?.[0]?.profiles as { email?: string } | null;
  return profile?.email ?? fallback ?? null;
}

async function organizationContactEmails(
  admin: AdminClient,
  organizationId: string,
) {
  const { data: members } = await admin
    .from("organization_members")
    .select("profiles(email)")
    .eq("organization_id", organizationId);
  const emails = (members ?? [])
    .map((m) => (m.profiles as { email?: string } | null)?.email)
    .filter((value): value is string => Boolean(value));
  if (emails.length) return emails;

  const { data: org } = await admin
    .from("organizations")
    .select("billing_email")
    .eq("id", organizationId)
    .maybeSingle();
  return org?.billing_email ? [org.billing_email as string] : [];
}

export async function createTicketAction(formData: FormData) {
  const profile = await requirePortalProfile();
  const admin = db();

  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const category = String(formData.get("category") ?? "general");
  const priorityRaw = String(formData.get("priority") ?? "normal");
  const priority = ["low", "normal", "high", "urgent"].includes(priorityRaw)
    ? priorityRaw
    : "normal";
  const projectId = String(formData.get("projectId") ?? "") || null;

  const isStaff = profile.role === "SUPER_ADMIN" || profile.role === "ADMIN" || profile.role === "STAFF";
  const organizationId = isStaff
    ? String(formData.get("organizationId") ?? "")
    : profile.organization_ids[0];

  const attachmentFile = formData.get("attachment");
  const file =
    attachmentFile instanceof File && attachmentFile.size > 0
      ? attachmentFile
      : null;

  if (!subject) throw new Error("Subject is required.");
  if (!body && !file) {
    throw new Error("Add details or attach a screenshot.");
  }
  if (!organizationId) throw new Error("No client organization linked to you.");

  const ticketNumber = await nextTicketNumber(admin);
  const now = new Date().toISOString();

  const { data: thread, error } = await admin
    .from("threads")
    .insert({
      organization_id: organizationId,
      project_id: projectId,
      subject,
      kind: "support",
      status: "open",
      ticket_number: ticketNumber,
      priority,
      category,
      created_by: profile.id,
      last_reply_at: now,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const imageUrl = await uploadPortalImage(
    admin,
    `tickets/${thread.id}`,
    file,
    "Screenshot",
  );
  const attachments = imageUrl ? [{ type: "image", url: imageUrl }] : [];
  const messageBody =
    body ||
    (imageUrl ? "Attached a screenshot of the issue." : "");

  await admin.from("messages").insert({
    thread_id: thread.id,
    author_id: profile.id,
    body: messageBody,
    attachments,
    read_by: [profile.id],
  });

  const { data: org } = await admin
    .from("organizations")
    .select("name")
    .eq("id", organizationId)
    .maybeSingle();

  await sendTicketCreatedEmails({
    ticketNumber,
    subject,
    body: messageBody,
    priority,
    category,
    clientName: profile.full_name || profile.email,
    clientEmail: profile.email,
    organizationName: org?.name ?? null,
    organizationId,
    threadId: thread.id as string,
  });

  await logActivity(admin, {
    actorId: profile.id,
    organizationId,
    projectId,
    action: "created",
    entityType: "ticket",
    entityId: thread.id,
    summary: `${ticketNumber} — ${subject}`,
    meta: { priority, category },
  });

  await notifyStaff({
    kind: "ticket",
    title: `${priority === "urgent" ? "Urgent ticket" : "New ticket"} — ${subject}`,
    body: `${ticketNumber} · ${org?.name ?? "Client"} · raised by ${profile.full_name || profile.email}`,
    href: `/admin/tickets/${thread.id}`,
    organizationId,
    entityType: "ticket",
    entityId: thread.id as string,
    dedupeKey: `ticket-created:${thread.id}`,
  }).catch((error) => console.error("[tickets] notify failed", error));

  revalidatePath("/admin/tickets");
  revalidatePath("/client/support");
  redirect(
    isStaff
      ? `/admin/tickets/${thread.id}`
      : `/client/support/${thread.id}`,
  );
}

export async function replyTicketAction(formData: FormData) {
  const profile = await requirePortalProfile();
  const admin = db();

  const threadId = String(formData.get("threadId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const isStaff = profile.role === "SUPER_ADMIN" || profile.role === "ADMIN" || profile.role === "STAFF";
  const internalOnly = isStaff && formData.get("internalOnly") === "on";
  const attachmentFile = formData.get("attachment");
  const file =
    attachmentFile instanceof File && attachmentFile.size > 0
      ? attachmentFile
      : null;
  if (!threadId) throw new Error("Missing ticket.");
  if (!body && !file) throw new Error("Write a reply or attach a screenshot.");

  const { data: thread } = await admin
    .from("threads")
    .select("id, subject, ticket_number, organization_id, project_id, status")
    .eq("id", threadId)
    .maybeSingle();
  if (!thread) throw new Error("Ticket not found.");
  if (
    !isStaff &&
    !profile.organization_ids.includes(thread.organization_id as string)
  ) {
    throw new Error("Unauthorized.");
  }

  const imageUrl = await uploadPortalImage(
    admin,
    `tickets/${threadId}`,
    file,
    "Screenshot",
  );
  const attachments = imageUrl ? [{ type: "image", url: imageUrl }] : [];
  const messageBody =
    body ||
    (imageUrl ? "Attached a screenshot." : "");

  await admin.from("messages").insert({
    thread_id: threadId,
    author_id: profile.id,
    body: messageBody,
    attachments,
    internal_only: internalOnly,
    read_by: [profile.id],
  });

  const now = new Date().toISOString();
  await admin
    .from("threads")
    .update({
      updated_at: now,
      last_reply_at: now,
      status: isStaff ? "pending" : "open",
    })
    .eq("id", threadId);

  if (!internalOnly) {
    const ticketNumber = (thread.ticket_number as string) ?? "Ticket";
    if (isStaff) {
      const recipients = await organizationContactEmails(
        admin,
        thread.organization_id as string,
      );
      await Promise.all(
        recipients.map((to) =>
          sendTicketReplyEmail({
            to,
            ticketNumber,
            subject: thread.subject as string,
            body: messageBody,
            authorName: profile.full_name || "Lynx team",
            threadId,
            toStaff: false,
            organizationId: thread.organization_id as string,
          }),
        ),
      );
    } else {
      await sendTicketReplyEmail({
        to: emailSettings().teamInbox,
        ticketNumber,
        subject: thread.subject as string,
        body: messageBody,
        authorName: profile.full_name || profile.email,
        threadId,
        toStaff: true,
        organizationId: thread.organization_id as string,
      });
    }
  }

  revalidatePath(`/admin/tickets/${threadId}`);
  revalidatePath(`/client/support/${threadId}`);
}

export async function updateTicketAction(formData: FormData) {
  const profile = await requireStaff();
  const admin = db();
  const threadId = String(formData.get("threadId") ?? "");
  const status = String(formData.get("status") ?? "");
  const priority = String(formData.get("priority") ?? "");
  if (!threadId) throw new Error("Missing ticket.");

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (["open", "pending", "resolved", "closed"].includes(status)) {
    patch.status = status;
    patch.closed_at =
      status === "closed" || status === "resolved"
        ? new Date().toISOString()
        : null;
  }
  if (["low", "normal", "high", "urgent"].includes(priority)) {
    patch.priority = priority;
  }

  const { data: thread, error } = await admin
    .from("threads")
    .update(patch)
    .eq("id", threadId)
    .select("ticket_number, organization_id")
    .single();
  if (error) throw new Error(error.message);

  await logActivity(admin, {
    actorId: profile.id,
    organizationId: thread.organization_id,
    action: "updated",
    entityType: "ticket",
    entityId: threadId,
    summary: `${thread.ticket_number} → ${status || priority}`,
  });

  revalidatePath(`/admin/tickets/${threadId}`);
  revalidatePath("/admin/tickets");
}


export async function saveWhatsAppEventSettingsAction(
  _prev: { ok: boolean; message: string },
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  await requireStaff();
  const patch = Object.fromEntries(
    WHATSAPP_EVENT_KEYS.map((key) => [key, formData.get(key) === "on"]),
  ) as Record<WhatsAppEventKey, boolean>;
  const saved = await updateWhatsAppEventSettings(patch);
  revalidatePath("/admin/settings");
  return {
    ok: true,
    message: `WhatsApp event toggles saved (${saved.source}).`,
  };
}

export async function sendTestEmailAction(formData: FormData) {
  const profile = await requireStaff();
  const to = String(formData.get("to") ?? "").trim() || profile.email;
  await sendTestEmail(to);
  revalidatePath("/admin/settings");
}

export async function postMessageAction(formData: FormData) {
  const profile = await requirePortalProfile();
  const admin = db();

  const threadId = String(formData.get("threadId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const internalOnly =
    formData.get("internalOnly") === "on" &&
    (profile.role === "SUPER_ADMIN" || profile.role === "ADMIN" || profile.role === "STAFF");

  if (!threadId || !body) throw new Error("Message required.");

  const { data: thread } = await admin
    .from("threads")
    .select("organization_id, project_id, subject")
    .eq("id", threadId)
    .single();
  if (!thread) throw new Error("Thread not found.");

  const isStaff = profile.role === "SUPER_ADMIN" || profile.role === "ADMIN" || profile.role === "STAFF";
  if (
    !isStaff &&
    !profile.organization_ids.includes(thread.organization_id as string)
  ) {
    throw new Error("Unauthorized.");
  }

  const { data: message, error } = await admin
    .from("messages")
    .insert({
      thread_id: threadId,
      author_id: profile.id,
      body,
      internal_only: internalOnly,
      read_by: [profile.id],
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await admin
    .from("threads")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", threadId);

  await logActivity(admin, {
    actorId: profile.id,
    organizationId: thread.organization_id,
    projectId: thread.project_id,
    action: "messaged",
    entityType: "message",
    entityId: message.id,
    summary: `${profile.full_name || profile.email} → ${thread.subject}`,
    meta: { internalOnly },
  });

  revalidatePath("/admin/inbox");
  revalidatePath("/client/messages");
}


export async function addSnapshotRemarkAction(formData: FormData) {
  const profile = await requirePortalProfile();
  const admin = db();

  const snapshotId = String(formData.get("snapshotId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!snapshotId || !body) throw new Error("Write a short note about what looks off.");

  const { data: snapshot } = await admin
    .from("snapshots")
    .select("id, title, project_id, projects(id, name, organization_id)")
    .eq("id", snapshotId)
    .maybeSingle();
  if (!snapshot) throw new Error("Update not found.");

  const project = snapshot.projects as
    | { id?: string; name?: string; organization_id?: string }
    | { id?: string; name?: string; organization_id?: string }[]
    | null;
  const projectRow = Array.isArray(project) ? project[0] : project;
  const organizationId = projectRow?.organization_id;
  if (!organizationId) throw new Error("Project organization missing.");

  const isStaff =
    profile.role === "SUPER_ADMIN" ||
    profile.role === "ADMIN" ||
    profile.role === "STAFF";
  if (!isStaff && !profile.organization_ids.includes(organizationId)) {
    throw new Error("Unauthorized.");
  }

  const { error } = await admin.from("snapshot_remarks").insert({
    snapshot_id: snapshotId,
    author_id: profile.id,
    body,
  });
  if (error) throw new Error(error.message);

  // Flag the update so the studio sees client feedback in the pipeline.
  if (!isStaff) {
    await admin
      .from("snapshots")
      .update({ status: "changes_requested" })
      .eq("id", snapshotId)
      .eq("status", "published");
  }

  await logActivity(admin, {
    actorId: profile.id,
    organizationId,
    projectId: String(snapshot.project_id),
    action: "commented",
    entityType: "snapshot",
    entityId: snapshotId,
    summary: `Feedback on “${snapshot.title}”: ${body.slice(0, 120)}`,
  });

  const projectId = String(snapshot.project_id);
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath(`/client/projects/${projectId}`);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function publishSnapshotAction(formData: FormData) {
  const profile = await requireStaff();
  const admin = db();

  const projectId = String(formData.get("projectId") ?? "");
  const milestoneId = String(formData.get("milestoneId") ?? "") || null;
  const title = String(formData.get("title") ?? "").trim();
  const changelog = String(formData.get("changelog") ?? "").trim();
  const stagingUrl = String(formData.get("stagingUrl") ?? "").trim();
  const screenshotUrlFallback = String(
    formData.get("screenshotUrl") ?? "",
  ).trim();
  const screenshotFile = formData.get("screenshot");

  if (!projectId || !title) throw new Error("Add a title for this update.");

  const { data: project } = await admin
    .from("projects")
    .select("organization_id, name")
    .eq("id", projectId)
    .single();

  let imageUrl: string | null = null;
  if (screenshotFile instanceof File && screenshotFile.size > 0) {
    imageUrl = await uploadProjectScreenshot(admin, projectId, screenshotFile);
  } else if (screenshotUrlFallback) {
    try {
      const parsed = new URL(screenshotUrlFallback);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        imageUrl = parsed.toString();
      }
    } catch {
      throw new Error("Screenshot link must be a full http(s) URL.");
    }
  }

  let previewUrl: string | null = null;
  if (stagingUrl) {
    try {
      const parsed = new URL(stagingUrl);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        previewUrl = parsed.toString();
      } else {
        throw new Error("invalid");
      }
    } catch {
      throw new Error("Preview link must be a full http(s) URL.");
    }
  }

  const { data, error } = await admin
    .from("snapshots")
    .insert({
      project_id: projectId,
      milestone_id: milestoneId,
      created_by: profile.id,
      title,
      changelog,
      staging_url: previewUrl,
      media: imageUrl ? [{ type: "image", url: imageUrl }] : [],
      status: "published",
      published_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (project?.organization_id) {
    const recipients = await organizationContactEmails(
      admin,
      project.organization_id as string,
    );
    await sendSnapshotEmail({
      to: recipients,
      projectName: (project.name as string) ?? "your project",
      projectId,
      title,
      changelog:
        changelog || "A new progress update is available in your portal.",
      stagingUrl: previewUrl,
      organizationId: project.organization_id as string,
    });
  }

  await logActivity(admin, {
    actorId: profile.id,
    organizationId: project?.organization_id,
    projectId,
    action: "published",
    entityType: "snapshot",
    entityId: data.id,
    summary: `Published progress update “${title}” on ${project?.name}`,
  });

  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath(`/client/projects/${projectId}`);
  revalidatePath("/client");
  revalidatePath("/admin");
}


export async function requestPasswordResetAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!isAuthConfigured()) {
    return { ok: false, message: "Auth is not configured in this environment." };
  }
  if (!isEmailConfigured()) {
    return {
      ok: false,
      message:
        "Outbound email is not configured. Contact Lynx support to reset your password.",
    };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { ok: false, message: "Enter the email on your portal account." };

  const genericOk = {
    ok: true as const,
    message:
      "If that email is on the Lynx client or team list, a reset link is on its way. Check inbox and spam.",
  };

  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, message: "Auth admin client unavailable." };

  // Generate a recovery token without using Supabase's built-in mailer
  // (that mailer is branded "Supabase" and often redirects to localhost).
  const redirectTo = `${siteUrl()}/auth/callback?next=/update-password`;
  let link = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  });

  // Auth user missing, but the email is still on Clients / Team → recreate the
  // login shell (not a password we know) so the recovery mail can land.
  if (link.error || !link.data?.properties?.hashed_token) {
    const notFound =
      !link.error ||
      /not found|unable to find|user not found/i.test(link.error.message);
    if (!notFound) {
      console.error("[auth] recovery link failed", link.error?.message);
      return genericOk;
    }

    const listed = await findListedPortalIdentity(admin, email);
    if (!listed) return genericOk;

    const ensured = await ensureAuthUserForListedIdentity(admin, email, listed);
    if ("error" in ensured) {
      console.error("[auth] listed-email provision failed", ensured.error);
      return genericOk;
    }

    link = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });
    if (link.error || !link.data?.properties?.hashed_token) {
      console.error(
        "[auth] recovery link failed after provision",
        link.error?.message,
      );
      return genericOk;
    }
  }

  const resetUrl = `${siteUrl()}/auth/callback?token_hash=${encodeURIComponent(
    link.data.properties.hashed_token,
  )}&type=recovery&next=${encodeURIComponent("/update-password")}`;

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name")
    .ilike("email", email)
    .maybeSingle();

  const mailed = await sendPasswordResetEmail({
    to: email,
    fullName: (profile?.full_name as string | null) ?? null,
    resetUrl,
  });

  if (!mailed.sent) {
    console.error("[auth] password reset email failed", mailed.error);
    return {
      ok: false,
      message:
        mailed.error ??
        "We couldn’t send the reset email right now. Try again in a minute.",
    };
  }

  return genericOk;
}

export async function updatePasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) {
    return { ok: false, message: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { ok: false, message: "Passwords do not match." };
  }

  const supabase = await createServerSupabase();
  if (!supabase) return { ok: false, message: "Auth client unavailable." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, message: error.message };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const admin = getSupabaseAdmin();
    if (admin) {
      const { data: profile } = await admin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      redirect(homeForRole((profile?.role as AppRole) ?? "CLIENT"));
    }
  }
  redirect("/client");
}

export async function setMemberDormantAction(formData: FormData) {
  const actor = await requireStaff();
  const admin = db();
  const userId = String(formData.get("userId") ?? "");
  const organizationId = String(formData.get("organizationId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const dormant = String(formData.get("dormant") ?? "true") === "true";
  if (!userId) throw new Error("Missing user.");

  const { data: target } = await admin
    .from("profiles")
    .select("id, role, email, full_name")
    .eq("id", userId)
    .maybeSingle();
  if (!target) throw new Error("User not found.");
  if (isSuperAdminRole(target.role as AppRole) && !isSuperAdminRole(actor.role)) {
    throw new Error("Only a Super Admin can change another Super Admin.");
  }
  if (target.id === actor.id) throw new Error("You cannot dormant your own login.");

  await admin
    .from("profiles")
    .update(
      dormant
        ? {
            account_status: "dormant",
            dormant_at: new Date().toISOString(),
            dormant_by: actor.id,
            dormant_reason: reason || "Engagement complete — login paused.",
          }
        : {
            account_status: "active",
            dormant_at: null,
            dormant_by: null,
            dormant_reason: null,
          },
    )
    .eq("id", userId);

  // Revoke sessions so a dormant user cannot stay signed in.
  if (dormant) {
    await admin.auth.admin.signOut(userId).catch(() => undefined);
  }

  await logActivity(admin, {
    actorId: actor.id,
    organizationId: organizationId || null,
    action: dormant ? "dormant" : "reactivated",
    entityType: "profile",
    entityId: userId,
    summary: dormant
      ? `Dormanted login for ${target.email}`
      : `Reactivated login for ${target.email}`,
    meta: { reason: reason || null },
  });

  if (organizationId) revalidatePath(`/admin/clients/${organizationId}`);
  revalidatePath("/admin/settings");
  revalidatePath("/admin/team");
}

export async function deleteUserAction(formData: FormData) {
  const actor = await requireSuperAdmin();
  const admin = db();
  const userId = String(formData.get("userId") ?? "");
  const organizationId = String(formData.get("organizationId") ?? "");
  const returnToRaw = String(formData.get("returnTo") ?? "").trim();
  if (!userId) throw new Error("Missing user.");
  if (userId === actor.id) throw new Error("You cannot delete your own Super Admin account.");

  const { data: target } = await admin
    .from("profiles")
    .select("email, role, full_name")
    .eq("id", userId)
    .maybeSingle();
  if (!target) throw new Error("User not found.");

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);

  await logActivity(admin, {
    actorId: actor.id,
    organizationId: organizationId || null,
    action: "deleted",
    entityType: "profile",
    entityId: userId,
    summary: `Deleted user ${target.email}`,
    meta: { role: target.role },
  });

  if (organizationId) revalidatePath(`/admin/clients/${organizationId}`);
  revalidatePath("/admin/settings");
  revalidatePath("/admin/team");

  // Leave the deleted profile URL — otherwise /admin/team/[id] 404s.
  const staffRoles = ["SUPER_ADMIN", "ADMIN", "STAFF"];
  const safeReturn =
    returnToRaw.startsWith("/admin/") &&
    !returnToRaw.includes(userId)
      ? returnToRaw
      : organizationId
        ? `/admin/clients/${organizationId}`
        : staffRoles.includes(String(target.role))
          ? "/admin/team"
          : "/admin/settings";
  redirect(safeReturn);
}

export async function inviteStaffAction(formData: FormData) {
  const actor = await requireAdmin();
  const admin = db();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const roleRaw = String(formData.get("role") ?? "ADMIN");
  const role: AppRole = roleRaw === "STAFF" ? "STAFF" : "ADMIN";
  if (!email) throw new Error("Email is required.");

  const result = await issueInvite(admin, {
    email,
    fullName: fullName || email.split("@")[0],
    role,
    organizationId: null,
    organizationName: "Lynx Web Solutions",
    invitedById: actor.id,
    invitedByName: actor.full_name || actor.email,
  });

  await logActivity(admin, {
    actorId: actor.id,
    action: "invited",
    entityType: "invite",
    summary: result.sent
      ? `Invited ${role} ${email}`
      : `Invite created for ${role} ${email} (email not sent)`,
    meta: { role, emailSent: result.sent, error: result.error ?? null },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin/team");
}

export async function listStaffProfilesAction() {
  await requireAdmin();
  const admin = db();
  const { data } = await admin
    .from("profiles")
    .select("id, email, full_name, role, account_status, created_at, last_login_at")
    .in("role", ["SUPER_ADMIN", "ADMIN", "STAFF"])
    .order("created_at", { ascending: true });
  return data ?? [];
}

const STUDIO_ORG_SLUG = "lynx-studio";

/** Shared org shell for staff↔staff threads (schema requires organization_id). */
async function ensureStudioOrganizationId(
  admin: ReturnType<typeof db>,
): Promise<string> {
  const { data: existing } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", STUDIO_ORG_SLUG)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data, error } = await admin
    .from("organizations")
    .insert({
      name: "Lynx Studio",
      slug: STUDIO_ORG_SLUG,
      notes_internal: "Internal studio org for admin team channels. Not a client.",
      health_score: "green",
      meta: { studio: true },
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

function pairKey(a: string, b: string) {
  return [a, b].sort().join(":");
}

/** Open or resume a private DM between two staff members. */
export async function startTeamThreadAction(formData: FormData) {
  const actor = await requireStaff();
  const admin = db();
  const peerId = String(formData.get("peerId") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!peerId) throw new Error("Pick a teammate.");
  if (peerId === actor.id) throw new Error("You cannot message yourself.");

  const { data: peer } = await admin
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", peerId)
    .maybeSingle();
  if (!peer) throw new Error("Teammate not found.");
  if (!["SUPER_ADMIN", "ADMIN", "STAFF"].includes(String(peer.role))) {
    throw new Error("Team channels are for panel staff only.");
  }

  const studioId = await ensureStudioOrganizationId(admin);
  const key = pairKey(actor.id, peerId);

  const { data: existingRows } = await admin
    .from("threads")
    .select("id, meta")
    .eq("organization_id", studioId)
    .eq("kind", "internal");

  const existing = (existingRows ?? []).find((row) => {
    const meta = (row.meta ?? {}) as { pair_key?: string };
    return meta.pair_key === key;
  });

  let threadId = existing?.id as string | undefined;
  if (!threadId) {
    const peerName = peer.full_name || peer.email;
    const actorName = actor.full_name || actor.email;
    const { data: thread, error } = await admin
      .from("threads")
      .insert({
        organization_id: studioId,
        subject: `${actorName} ↔ ${peerName}`,
        kind: "internal",
        status: "open",
        meta: {
          pair_key: key,
          participant_ids: [actor.id, peerId],
          channel: "dm",
        },
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    threadId = thread.id as string;
  }

  if (body) {
    const { error } = await admin.from("messages").insert({
      thread_id: threadId,
      author_id: actor.id,
      body,
      internal_only: false,
      read_by: [actor.id],
    });
    if (error) throw new Error(error.message);
    await admin
      .from("threads")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", threadId);
  }

  await logActivity(admin, {
    actorId: actor.id,
    organizationId: studioId,
    action: "messaged",
    entityType: "thread",
    entityId: threadId,
    summary: `Opened team chat with ${peer.full_name || peer.email}`,
  });

  revalidatePath("/admin/inbox");
  redirect(`/admin/inbox?channel=team&thread=${threadId}`);
}

/** Start a general conversation with a client organization. */
export async function startClientThreadAction(formData: FormData) {
  const actor = await requireStaff();
  const admin = db();
  const organizationId = String(formData.get("organizationId") ?? "").trim();
  const subject =
    String(formData.get("subject") ?? "").trim() || "Panel conversation";
  const body = String(formData.get("body") ?? "").trim();
  if (!organizationId) throw new Error("Pick a client.");

  const { data: org } = await admin
    .from("organizations")
    .select("id, name, slug")
    .eq("id", organizationId)
    .maybeSingle();
  if (!org) throw new Error("Client not found.");
  if (org.slug === STUDIO_ORG_SLUG) {
    throw new Error("Use Team channel for panel chats.");
  }

  const { data: thread, error } = await admin
    .from("threads")
    .insert({
      organization_id: organizationId,
      subject,
      kind: "general",
      status: "open",
      meta: { started_by: actor.id, channel: "client" },
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (body) {
    const { error: msgError } = await admin.from("messages").insert({
      thread_id: thread.id,
      author_id: actor.id,
      body,
      internal_only: false,
      read_by: [actor.id],
    });
    if (msgError) throw new Error(msgError.message);
  }

  await logActivity(admin, {
    actorId: actor.id,
    organizationId,
    action: "messaged",
    entityType: "thread",
    entityId: thread.id,
    summary: `Started client conversation with ${org.name}`,
  });

  revalidatePath("/admin/inbox");
  revalidatePath("/client/messages");
  redirect(`/admin/inbox?channel=clients&thread=${thread.id}`);
}

// ---------------------------------------------------------------------------
// Super Admin absolute deletes — hard remove, no soft-delete.
// ---------------------------------------------------------------------------

async function purgeOrphanClientUsers(
  admin: ReturnType<typeof db>,
  userIds: string[],
) {
  for (const userId of userIds) {
    const { data: profile } = await admin
      .from("profiles")
      .select("id, role, email")
      .eq("id", userId)
      .maybeSingle();
    if (!profile) continue;
    if (!["CLIENT", "CLIENT_VIEWER"].includes(String(profile.role))) continue;

    const { count } = await admin
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if ((count ?? 0) > 0) continue;

    await admin.auth.admin.deleteUser(userId);
  }
}

/**
 * Wipe a client organization and every operational record attached to it
 * (quotes, invoices, projects, threads, invites, payments, notifications,
 * memberships, orphan client logins). Audit / delivery logs are kept —
 * their organization_id is cleared so the history survives.
 */
export async function deleteOrganizationAction(formData: FormData) {
  const actor = await requireSuperAdmin();
  const admin = db();
  const organizationId = String(formData.get("organizationId") ?? "").trim();
  if (!organizationId) throw new Error("Missing client.");

  const { data: org } = await admin
    .from("organizations")
    .select("id, name, slug, billing_email")
    .eq("id", organizationId)
    .maybeSingle();
  if (!org) throw new Error("Client not found.");
  if (org.slug === STUDIO_ORG_SLUG) {
    throw new Error("The panel organization cannot be deleted.");
  }

  const { data: members } = await admin
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId);
  const memberIds = [
    ...new Set(
      (members ?? []).map((row) => String(row.user_id)).filter(Boolean),
    ),
  ];

  const { data: projects } = await admin
    .from("projects")
    .select("id")
    .eq("organization_id", organizationId);
  const projectIds = (projects ?? []).map((row) => String(row.id));

  const { data: quotes } = await admin
    .from("quotes")
    .select("id")
    .eq("organization_id", organizationId);
  const quoteIds = (quotes ?? []).map((row) => String(row.id));

  const { data: invoices } = await admin
    .from("invoices")
    .select("id")
    .eq("organization_id", organizationId);
  const invoiceIds = (invoices ?? []).map((row) => String(row.id));

  const { count: threadCount } = await admin
    .from("threads")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  // Detach logs first so they survive even if a FK is still CASCADE in an
  // older environment that has not applied client_delete_keep_logs.sql.
  await admin
    .from("activity_log")
    .update({ organization_id: null })
    .eq("organization_id", organizationId);
  if (projectIds.length) {
    await admin
      .from("activity_log")
      .update({ project_id: null })
      .in("project_id", projectIds);
  }
  await admin
    .from("email_log")
    .update({ organization_id: null })
    .eq("organization_id", organizationId);
  await admin
    .from("whatsapp_log")
    .update({ organization_id: null })
    .eq("organization_id", organizationId);

  // Operational records that SET NULL on org delete — remove explicitly.
  await admin.from("transactions").delete().eq("organization_id", organizationId);
  if (quoteIds.length) {
    await admin.from("transactions").delete().in("quote_id", quoteIds);
  }
  if (invoiceIds.length) {
    await admin.from("transactions").delete().in("invoice_id", invoiceIds);
  }

  const { error: quoteError } = await admin
    .from("quotes")
    .delete()
    .eq("organization_id", organizationId);
  if (quoteError) throw new Error(quoteError.message);

  const { error: invoiceError } = await admin
    .from("invoices")
    .delete()
    .eq("organization_id", organizationId);
  if (invoiceError) throw new Error(invoiceError.message);

  const { error: threadError } = await admin
    .from("threads")
    .delete()
    .eq("organization_id", organizationId);
  if (threadError) throw new Error(threadError.message);

  const { error: inviteError } = await admin
    .from("invites")
    .delete()
    .eq("organization_id", organizationId);
  if (inviteError) throw new Error(inviteError.message);

  const { error: notificationError } = await admin
    .from("notifications")
    .delete()
    .eq("organization_id", organizationId);
  if (notificationError) throw new Error(notificationError.message);

  const { error: projectError } = await admin
    .from("projects")
    .delete()
    .eq("organization_id", organizationId);
  if (projectError) throw new Error(projectError.message);

  // Members cascade with the org, but clear them first so orphan-client purge
  // can see they no longer belong anywhere.
  await admin
    .from("organization_members")
    .delete()
    .eq("organization_id", organizationId);

  const { error } = await admin
    .from("organizations")
    .delete()
    .eq("id", organizationId);
  if (error) throw new Error(error.message);

  await purgeOrphanClientUsers(admin, memberIds);

  // Also drop CLIENT auth users whose only identity was this org's billing email.
  const billingEmail = String(org.billing_email ?? "")
    .trim()
    .toLowerCase();
  if (billingEmail) {
    const { data: billingProfile } = await admin
      .from("profiles")
      .select("id, role")
      .ilike("email", billingEmail)
      .maybeSingle();
    if (
      billingProfile?.id &&
      ["CLIENT", "CLIENT_VIEWER"].includes(String(billingProfile.role))
    ) {
      await purgeOrphanClientUsers(admin, [String(billingProfile.id)]);
    }
  }

  await logActivity(admin, {
    actorId: actor.id,
    organizationId: null,
    action: "deleted",
    entityType: "organization",
    entityId: organizationId,
    summary: `Deleted client ${org.name}`,
    meta: {
      slug: org.slug,
      billingEmail: billingEmail || null,
      purged: {
        members: memberIds.length,
        projects: projectIds.length,
        quotes: quoteIds.length,
        invoices: invoiceIds.length,
        threads: threadCount ?? 0,
      },
      kept: "activity_log, email_log, whatsapp_log",
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/clients");
  revalidatePath("/admin/invoices");
  revalidatePath("/admin/quotes");
  revalidatePath("/admin/projects");
  revalidatePath("/admin/tickets");
  revalidatePath("/admin/inbox");
  redirect("/admin/clients");
}

export async function deleteInvoiceAction(formData: FormData) {
  const actor = await requireSuperAdmin();
  const admin = db();
  const invoiceId = String(formData.get("invoiceId") ?? "").trim();
  if (!invoiceId) throw new Error("Missing invoice.");

  const { data: invoice } = await admin
    .from("invoices")
    .select("id, invoice_number, organization_id, total_minor, status")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice) throw new Error("Invoice not found.");

  const { error } = await admin.from("invoices").delete().eq("id", invoiceId);
  if (error) throw new Error(error.message);

  await logActivity(admin, {
    actorId: actor.id,
    organizationId: invoice.organization_id as string,
    action: "deleted",
    entityType: "invoice",
    entityId: invoiceId,
    summary: `Deleted invoice ${invoice.invoice_number}`,
    meta: {
      status: invoice.status,
      total_minor: invoice.total_minor,
    },
  });

  revalidatePath("/admin/invoices");
  revalidatePath(`/admin/clients/${invoice.organization_id}`);
  revalidatePath("/admin");
  redirect("/admin/invoices");
}

export async function deleteQuoteAction(formData: FormData) {
  const actor = await requireSuperAdmin();
  const admin = db();
  const quoteId = String(formData.get("quoteId") ?? "").trim();
  if (!quoteId) throw new Error("Missing quote.");

  const { data: quote } = await admin
    .from("quotes")
    .select("id, quote_number, title, organization_id, status, total_minor")
    .eq("id", quoteId)
    .maybeSingle();
  if (!quote) throw new Error("Quote not found.");

  const { error } = await admin.from("quotes").delete().eq("id", quoteId);
  if (error) throw new Error(error.message);

  await logActivity(admin, {
    actorId: actor.id,
    organizationId: (quote.organization_id as string | null) ?? null,
    action: "deleted",
    entityType: "quote",
    entityId: quoteId,
    summary: `Deleted quote ${quote.quote_number}`,
    meta: { title: quote.title, status: quote.status },
  });

  revalidatePath("/admin/quotes");
  if (quote.organization_id) {
    revalidatePath(`/admin/clients/${quote.organization_id}`);
  }
  revalidatePath("/admin");
  redirect("/admin/quotes");
}

export async function deleteProjectAction(formData: FormData) {
  const actor = await requireSuperAdmin();
  const admin = db();
  const projectId = String(formData.get("projectId") ?? "").trim();
  if (!projectId) throw new Error("Missing project.");

  const { data: project } = await admin
    .from("projects")
    .select("id, name, code, organization_id, status")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) throw new Error("Project not found.");

  const { error } = await admin.from("projects").delete().eq("id", projectId);
  if (error) throw new Error(error.message);

  await logActivity(admin, {
    actorId: actor.id,
    organizationId: project.organization_id as string,
    action: "deleted",
    entityType: "project",
    entityId: projectId,
    summary: `Deleted project ${project.code ?? project.name}`,
    meta: { name: project.name, status: project.status },
  });

  revalidatePath("/admin/projects");
  revalidatePath(`/admin/clients/${project.organization_id}`);
  revalidatePath("/admin");
  redirect("/admin/projects");
}

export async function deleteThreadAction(formData: FormData) {
  const actor = await requireSuperAdmin();
  const admin = db();
  const threadId = String(formData.get("threadId") ?? "").trim();
  const returnTo = String(formData.get("returnTo") ?? "").trim();
  if (!threadId) throw new Error("Missing conversation.");

  const { data: thread } = await admin
    .from("threads")
    .select("id, subject, kind, organization_id, ticket_number")
    .eq("id", threadId)
    .maybeSingle();
  if (!thread) throw new Error("Conversation not found.");

  const { error } = await admin.from("threads").delete().eq("id", threadId);
  if (error) throw new Error(error.message);

  await logActivity(admin, {
    actorId: actor.id,
    organizationId: thread.organization_id as string,
    action: "deleted",
    entityType: "thread",
    entityId: threadId,
    summary: `Deleted ${thread.kind} thread ${thread.ticket_number || thread.subject}`,
    meta: { kind: thread.kind, subject: thread.subject },
  });

  revalidatePath("/admin/tickets");
  revalidatePath("/admin/inbox");
  revalidatePath("/client/messages");
  revalidatePath("/client/support");
  if (thread.organization_id) {
    revalidatePath(`/admin/clients/${thread.organization_id}`);
  }

  if (returnTo.startsWith("/admin/")) {
    redirect(returnTo);
  }
  redirect(thread.kind === "support" ? "/admin/tickets" : "/admin/inbox");
}


export async function updateLeadStatusAction(formData: FormData) {
  const profile = await requireStaff();
  const admin = db();
  const leadId = String(formData.get("leadId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  if (!leadId) throw new Error("Missing lead.");
  if (!["new", "contacted", "converted", "archived"].includes(status)) {
    throw new Error("Invalid lead status.");
  }

  const { data: lead } = await admin
    .from("leads")
    .select("id, name, email, status")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) throw new Error("Lead not found.");

  const now = new Date().toISOString();
  const { error } = await admin
    .from("leads")
    .update({
      status,
      updated_at: now,
      // Anything past "new" means somebody has actually touched this lead, so
      // the 48-hour nudge should stop looking at it.
      ...(status === "new" ? {} : { last_contacted_at: now }),
    })
    .eq("id", leadId);
  if (error) throw new Error(error.message);

  await logActivity(admin, {
    actorId: profile.id,
    organizationId: null,
    action: "updated",
    entityType: "lead",
    entityId: leadId,
    summary: `Lead ${lead.name} marked ${status}`,
    meta: { from: lead.status, to: status, email: lead.email },
  });

  revalidatePath("/admin/leads");
  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin");
}

export async function updateProjectAction(formData: FormData) {
  const profile = await requireStaff();
  const admin = db();
  const projectId = String(formData.get("projectId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  if (!projectId) throw new Error("Missing project.");
  if (!name) throw new Error("Project name is required.");

  const allowed = [
    "intake",
    "active",
    "review",
    "launched",
    "maintenance",
    "paused",
    "archived",
  ];
  if (status && !allowed.includes(status)) {
    throw new Error("Invalid project status.");
  }

  const { data: project } = await admin
    .from("projects")
    .select("id, name, code, status, organization_id, summary")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) throw new Error("Project not found.");

  const patch: Record<string, unknown> = {
    name,
    summary,
    updated_at: new Date().toISOString(),
  };
  if (code) patch.code = code;
  if (status) patch.status = status;

  const { error } = await admin.from("projects").update(patch).eq("id", projectId);
  if (error) throw new Error(error.message);

  await logActivity(admin, {
    actorId: profile.id,
    organizationId: project.organization_id as string,
    projectId,
    action: "updated",
    entityType: "project",
    entityId: projectId,
    summary: `Updated project ${code || project.code || name}`,
    meta: {
      before: {
        name: project.name,
        code: project.code,
        status: project.status,
      },
      after: { name, code: code || project.code, status: status || project.status },
    },
  });

  revalidatePath("/admin/projects");
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath(`/admin/clients/${project.organization_id}`);
  revalidatePath("/client/projects");
  revalidatePath("/admin");
}

/**
 * The end of the line for a project: reconcile the money, hand over, and stop
 * the project pretending it is still in flight. Completion is deliberately not
 * one of the options in the status dropdown — going through here is what
 * guarantees the balance was checked and the handover actually went out.
 */
export async function completeProjectAction(formData: FormData) {
  const profile = await requireStaff();
  const admin = db();
  const projectId = String(formData.get("projectId") ?? "").trim();
  const handoverNote = String(formData.get("handoverNote") ?? "").trim();
  const balanceWaived = formData.get("balanceWaived") === "on";
  if (!projectId) throw new Error("Missing project.");

  const { data: project } = await admin
    .from("projects")
    .select("id, name, code, status, organization_id, completed_at")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) throw new Error("Project not found.");

  const money = await getProjectFinancialSummary(projectId);
  const outstanding = money.outstanding;

  // Fail loudly rather than quietly closing a project that still owes money.
  if (outstanding > 0 && !balanceWaived) {
    throw new Error(
      `${formatInr(outstanding)} is still unpaid on ${project.name}. Collect it, or tick "balance agreed as settled" to close anyway.`,
    );
  }

  const now = new Date().toISOString();
  const { error } = await admin
    .from("projects")
    .update({
      status: "completed",
      completed_at: project.completed_at ?? now,
      handover_note: handoverNote,
      updated_at: now,
    })
    .eq("id", projectId);
  if (error) throw new Error(error.message);

  await logActivity(admin, {
    actorId: profile.id,
    organizationId: project.organization_id as string | null,
    projectId,
    action: "completed",
    entityType: "project",
    entityId: projectId,
    summary: `${project.name} delivered${
      outstanding > 0 ? ` with ${formatInr(outstanding)} written off` : ""
    }`,
    meta: {
      outstandingMinor: outstanding,
      balanceWaived,
      paidMinor: money.paid,
    },
  });

  let recipients: string[] = [];
  if (project.organization_id) {
    const { data: members } = await admin
      .from("organization_members")
      .select("profiles(email)")
      .eq("organization_id", project.organization_id as string);
    recipients = [
      ...new Set(
        (members ?? [])
          .map((row) => (row.profiles as { email?: string } | null)?.email)
          .filter((value): value is string => Boolean(value)),
      ),
    ];
  }

  const handover = await sendProjectHandoverEmail({
    to: recipients,
    projectName: String(project.name),
    projectId,
    handoverNote,
    outstandingMinor: balanceWaived ? 0 : outstanding,
    organizationId: project.organization_id as string | null,
  }).catch((error) => {
    console.error("[projects] handover email failed", error);
    return null;
  });

  if (handover?.sent) {
    await admin
      .from("projects")
      .update({ handover_sent_at: now })
      .eq("id", projectId);
  }

  await notifyStaff({
    kind: "project",
    title: `Delivered — ${project.name}`,
    body: handover?.sent
      ? `Handover email sent to ${recipients.length} contact${recipients.length === 1 ? "" : "s"}.`
      : "Project closed, but the handover email did not go out. Send it manually.",
    href: `/admin/projects/${projectId}`,
    organizationId: project.organization_id as string | null,
    entityType: "project",
    entityId: projectId,
    dedupeKey: `project-completed:${projectId}`,
  }).catch((error) => console.error("[projects] notify failed", error));

  revalidatePath("/admin/projects");
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath(`/admin/clients/${project.organization_id}`);
  revalidatePath("/client/projects");
  revalidatePath("/admin");
}
