"use client";

import { useEffect } from "react";

/**
 * Portaled UI (Select, Dialog, etc.) mounts under document.body, outside the
 * PortalShell `.dark` wrapper. Mirror the portal tone onto <html> so theme
 * tokens resolve correctly for those menus.
 */
export function PortalThemeSync({ tone = "dark" }: { tone?: "dark" | "light" }) {
  useEffect(() => {
    const root = document.documentElement;
    if (tone !== "dark") {
      root.classList.remove("dark");
      return;
    }
    root.classList.add("dark");
    return () => {
      root.classList.remove("dark");
    };
  }, [tone]);

  return null;
}
