import type { ReactNode } from "react";
import { headers } from "next/headers";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { OrganizationJsonLd } from "@/components/seo/json-ld";
import { WhatsAppWidget } from "@/components/whatsapp/whatsapp-widget";

export async function RootChrome({ children }: { children: ReactNode }) {
  const headerList = await headers();
  const surface = headerList.get("x-lynx-surface");
  const bare =
    surface === "portal" || surface === "auth" || surface === "quote";

  if (bare) {
    return <main className="flex-1">{children}</main>;
  }

  return (
    <>
      <OrganizationJsonLd />
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <WhatsAppWidget />
    </>
  );
}
