import type { ReactNode } from "react";

export default function AuthGroupLayout({ children }: { children: ReactNode }) {
  return <div data-portal="true">{children}</div>;
}
