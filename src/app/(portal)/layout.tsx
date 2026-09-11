import type { ReactNode } from "react";

/** Portal routes render their own chrome — marketing header/footer are suppressed via body class. */
export default function PortalGroupLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div data-portal="true">{children}</div>;
}
