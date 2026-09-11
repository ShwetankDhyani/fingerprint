import type { ReactNode } from "react";

import { PortalShell } from "@/components/portal/shell";
import { requireClient } from "@/lib/auth/session";

/** Plain-language nav — written for non-technical clients. */
const nav = [
  { href: "/client", label: "Home" },
  { href: "/client/projects", label: "My projects" },
  { href: "/client/billing", label: "Pay bills" },
  { href: "/client/quotes", label: "Quotes" },
  { href: "/client/support", label: "Get help" },
  { href: "/client/messages", label: "Messages" },
];

export default async function ClientLayout({
  children,
}: {
  children: ReactNode;
}) {
  const profile = await requireClient();
  return (
    <PortalShell
      role={profile.role}
      name={profile.full_name}
      email={profile.email}
      nav={nav}
      title="Your Lynx space"
      tone="dark"
    >
      {children}
    </PortalShell>
  );
}
