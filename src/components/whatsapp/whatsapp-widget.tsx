"use client";

import { MessageCircle } from "lucide-react";
import { usePathname } from "next/navigation";
import {
  buildWhatsAppUrl,
  defaultWhatsAppMessage,
} from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

export function WhatsAppWidget() {
  const pathname = usePathname();

  const context =
    pathname.startsWith("/plans")
      ? "a website plan from your pricing page"
      : pathname.startsWith("/services")
        ? "a custom web development engagement"
        : pathname.startsWith("/work")
          ? "a project similar to your portfolio work"
          : pathname.startsWith("/contact")
            ? "a project brief"
            : "a custom web development project";

  if (pathname.startsWith("/admin")) return null;

  const href = buildWhatsAppUrl(defaultWhatsAppMessage(context));

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with Lynx on WhatsApp"
      className={cn(
        "fixed right-4 bottom-4 z-50 inline-flex items-center gap-2 rounded-full bg-[#1f6b4a] px-4 py-3 text-sm font-medium text-white shadow-[0_18px_40px_-20px_rgba(15,61,46,0.9)] transition hover:bg-[#18553a] sm:right-6 sm:bottom-6",
      )}
    >
      <MessageCircle className="size-4" />
      <span className="hidden sm:inline">WhatsApp</span>
    </a>
  );
}
