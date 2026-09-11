import Link from "next/link";
import type { ReactNode } from "react";

import {
  PortalMobileNav,
  PortalSidebarNav,
} from "@/components/portal/portal-nav";
import { PortalThemeSync } from "@/components/portal/portal-theme";
import type { AppRole } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string };

export function PortalShell({
  role,
  name,
  email,
  nav,
  title,
  children,
  tone = "dark",
  headerAside,
}: {
  role: AppRole;
  name: string;
  email: string;
  nav: NavItem[];
  title: string;
  children: ReactNode;
  tone?: "dark" | "light";
  /** Slot beside the identity block — the admin notification bell lives here. */
  headerAside?: ReactNode;
}) {
  const isStaff =
    role === "SUPER_ADMIN" || role === "ADMIN" || role === "STAFF";
  const homeHref = isStaff ? "/admin" : "/client";
  const brandSub = isStaff ? "Panel" : "Portal";

  return (
    <div
      data-portal=""
      className={cn(
        "min-h-screen",
        tone === "dark"
          ? "dark bg-[#0b1210] text-[#e8eee9]"
          : "bg-[#e7ece9] text-[#0c1612]",
      )}
    >
      <PortalThemeSync tone={tone} />
      <div className="mx-auto flex min-h-screen max-w-7xl">
        <PortalSidebarNav
          nav={nav}
          tone={tone}
          homeHref={homeHref}
          brandSub={brandSub}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <header
            className={cn(
              "flex items-center justify-between gap-3 border-b px-4 py-4 md:px-8",
              tone === "dark" ? "border-[#24302b]" : "border-[#c5cec8]",
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <PortalMobileNav
                nav={nav}
                tone={tone}
                brandSub={brandSub}
                title={title}
              />
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#b08d1f]">
                  {isStaff ? "admin" : "client"}
                </p>
                <h1 className="truncate font-[family-name:var(--font-syne)] text-xl md:text-2xl">
                  {title}
                </h1>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium">{name || "Operator"}</p>
                <p className="max-w-[12rem] truncate font-mono text-[11px] opacity-60 sm:max-w-none">
                  {email}
                </p>
              </div>
              {headerAside}
            </div>
          </header>
          <div className="flex-1 px-4 py-6 md:px-8">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function KpiStrip({
  items,
  tone = "default",
}: {
  items: {
    label: string;
    value: string;
    hint?: string;
    href?: string;
    /** 0–1 fill for the quiet pulse bar */
    heat?: number;
  }[];
  /** Quiet tone for overview pulse — less “dashboard cockpit”. */
  tone?: "default" | "quiet";
}) {
  if (tone === "quiet") {
    return (
      <div className="grid gap-px overflow-hidden rounded-2xl border border-[#1c2622] bg-[#1c2622] sm:grid-cols-2 lg:grid-cols-5">
        {items.map((item) => {
          const heat = Math.max(0, Math.min(1, item.heat ?? 0));
          const inner = (
            <>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#5f6f68]">
                {item.label}
              </p>
              <p className="mt-1 font-[family-name:var(--font-syne)] text-2xl tracking-tight text-[#f0f4f1]">
                {item.value}
              </p>
              {item.hint ? (
                <p className="mt-0.5 text-[11px] text-[#5f6f68]">{item.hint}</p>
              ) : null}
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-[#18201c]">
                <div
                  className="h-full rounded-full bg-[#d4b45a]/80 transition-[width]"
                  style={{ width: `${Math.max(heat * 100, heat > 0 ? 8 : 0)}%` }}
                />
              </div>
            </>
          );
          const className =
            "block bg-[#0d1411] px-4 py-3.5 transition-colors hover:bg-[#121a17]";
          return item.href ? (
            <Link key={item.label} href={item.href} className={className}>
              {inner}
            </Link>
          ) : (
            <div key={item.label} className={className}>
              {inner}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {items.map((item) => {
        const card = (
          <>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#9aaba2]">
              {item.label}
            </p>
            <p className="mt-1 font-[family-name:var(--font-syne)] text-2xl text-[#d4b45a]">
              {item.value}
            </p>
            {item.hint ? (
              <p className="mt-1 text-xs text-[#9aaba2]">{item.hint}</p>
            ) : null}
          </>
        );
        return item.href ? (
          <Link
            key={item.label}
            href={item.href}
            className="rounded-lg border border-[#24302b] bg-[#121a17] px-3 py-3 transition-colors hover:border-[#d4b45a]/35 hover:bg-[#161f1b]"
          >
            {card}
          </Link>
        ) : (
          <div
            key={item.label}
            className="rounded-lg border border-[#24302b] bg-[#121a17] px-3 py-3"
          >
            {card}
          </div>
        );
      })}
    </div>
  );
}

export function CliFeed({
  lines,
}: {
  lines: { ts: string; text: string }[];
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#24302b] bg-[#0b1210]">
      <div className="border-b border-[#24302b] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#b08d1f]">
        activity.log
      </div>
      <ul className="max-h-80 space-y-1 overflow-auto p-3 font-mono text-xs leading-relaxed">
        {lines.length === 0 ? (
          <li className="text-[#9aaba2]">[idle] waiting for signal…</li>
        ) : (
          lines.map((line, i) => (
            <li key={`${line.ts}-${i}`}>
              <span className="text-[#b08d1f]">[{line.ts}]</span>{" "}
              <span className="text-[#e8eee9]">{line.text}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[#24302b] px-4 py-10 text-center">
      <p className="font-[family-name:var(--font-syne)] text-lg">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-[#9aaba2]">{body}</p>
    </div>
  );
}
