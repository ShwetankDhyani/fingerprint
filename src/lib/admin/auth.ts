import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { env, isAdminConfigured } from "@/lib/env";

export const ADMIN_COOKIE = "lynx_admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

function adminSecret(): string | null {
  if (isAdminConfigured()) return env.ADMIN_PASSWORD!;
  if (env.NODE_ENV === "development") return "lynx-admin-dev";
  return null;
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function getAdminAuthMode(): {
  configured: boolean;
  developmentFallback: boolean;
} {
  return {
    configured: isAdminConfigured(),
    developmentFallback: !isAdminConfigured() && env.NODE_ENV === "development",
  };
}

export async function createAdminSession(): Promise<boolean> {
  const secret = adminSecret();
  if (!secret) return false;
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `admin:${expiresAt}`;
  const token = `${expiresAt}.${sign(payload, secret)}`;
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  return true;
}

export async function clearAdminSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
}

export async function verifyAdminSession(): Promise<boolean> {
  const secret = adminSecret();
  if (!secret) return false;
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  const [expiresRaw, signature] = token.split(".");
  if (!expiresRaw || !signature) return false;
  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  const expected = sign(`admin:${expiresAt}`, secret);
  try {
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected),
    );
  } catch {
    return false;
  }
}

export function verifyAdminPassword(password: string): boolean {
  const secret = adminSecret();
  if (!secret) return false;
  const a = Buffer.from(password);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
