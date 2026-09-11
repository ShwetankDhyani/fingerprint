import type { ReactNode } from "react";

import { NotificationBell } from "@/components/portal/notification-bell";
import { PortalShell } from "@/components/portal/shell";
import { requireStaff } from "@/lib/auth/session";
import { fetchStaffNotifications } from "@/lib/portal/notify";

const nav = [
  { href: "/admin", label: "Home" },
  { href: "/admin/leads", label: "Leads" },
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/team", label: "Team" },
  { href: "/admin/projects", label: "Projects" },
  { href: "/admin/quotes", label: "Quotes" },
  { href: "/admin/invoices", label: "Invoices" },
  { href: "/admin/tickets", label: "Tickets" },
  { href: "/admin/inbox", label: "Messages" },
  { href: "/admin/settings", label: "Settings" },
];

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const profile = await requireStaff();
  const { rows, unread } = await fetchStaffNotifications(profile.id);
  return (
    <PortalShell
      role={profile.role}
      name={profile.full_name}
      email={profile.email}
      nav={nav}
      title="Home"
      headerAside={<NotificationBell items={rows} unread={unread} />}
    >
      {children}
    </PortalShell>
  );
}
