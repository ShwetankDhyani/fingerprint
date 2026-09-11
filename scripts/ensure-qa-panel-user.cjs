#!/usr/bin/env node
/**
 * Ensures a disposable QA panel login for Cloud Agent browser tests.
 *
 * HARD RULES
 * - Never touches SUPER_ADMIN / owner emails (see PROTECTED_EMAILS).
 * - Never rotates production human passwords.
 * - Safe to re-run; upserts the QA user only.
 *
 * Usage: node scripts/ensure-qa-panel-user.cjs
 * Writes credentials to /tmp/lynx-qa-panel-login.txt (mode 600).
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(path.join(process.cwd(), ".env.local"));
loadEnvFile("/tmp/lynx-portal-admin.env");

const PROTECTED_EMAILS = new Set(
  [
    process.env.PORTAL_ADMIN_EMAIL,
    "setu.dhyani@gmail.com",
    "raghudhyani@gmail.com",
  ]
    .filter(Boolean)
    .map((e) => String(e).trim().toLowerCase()),
);

const QA_EMAIL = (
  process.env.PORTAL_QA_EMAIL || "qa.panel@lynxweb.in"
).toLowerCase();
const QA_PASSWORD =
  process.env.PORTAL_QA_PASSWORD || "LynxQA-Panel-Agent-Only-2026!";
const QA_NAME = "Lynx QA Panel";

if (PROTECTED_EMAILS.has(QA_EMAIL)) {
  console.error(
    "[ensure-qa-panel-user] Refusing to use a protected human email as QA.",
  );
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase URL or service role key.");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(email) {
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const match = (data.users || []).find(
      (u) => (u.email || "").toLowerCase() === email,
    );
    if (match) return match;
    if (!data.users?.length || data.users.length < 200) return null;
    page += 1;
  }
}

async function main() {
  if (PROTECTED_EMAILS.has(QA_EMAIL)) {
    throw new Error("QA email is protected — aborting.");
  }

  let user = await findUserByEmail(QA_EMAIL);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: QA_EMAIL,
      password: QA_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: QA_NAME },
      app_metadata: { role: "ADMIN" },
    });
    if (error) throw error;
    user = data.user;
    console.log("Created QA auth user", QA_EMAIL);
  } else {
    if (PROTECTED_EMAILS.has((user.email || "").toLowerCase())) {
      throw new Error("Refusing to rotate a protected account.");
    }
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      password: QA_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: QA_NAME },
      app_metadata: { role: "ADMIN" },
    });
    if (error) throw error;
    console.log("Refreshed QA auth user", QA_EMAIL);
  }

  const { error: profileErr } = await admin.from("profiles").upsert({
    id: user.id,
    email: QA_EMAIL,
    full_name: QA_NAME,
    role: "ADMIN",
    account_status: "active",
  });
  if (profileErr) throw profileErr;

  const out = "/tmp/lynx-qa-panel-login.txt";
  fs.writeFileSync(out, `${QA_EMAIL}\n${QA_PASSWORD}\n`, { mode: 0o600 });
  try {
    fs.chmodSync(out, 0o600);
  } catch {
    /* ignore */
  }

  // Scrub any leftover owner-credential scratch files used by prior agent runs.
  for (const stale of [
    "/tmp/lynx-admin-login.txt",
    "/tmp/lynx-owner-login.txt",
  ]) {
    if (fs.existsSync(stale)) {
      fs.unlinkSync(stale);
      console.log("Removed stale credential file", stale);
    }
  }

  console.log("QA panel login ready →", out);
  console.log("Email:", QA_EMAIL);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
