"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";

import { signOutAction } from "@/app/actions/portal";
import { LynxMark } from "@/components/brand/lynx-mark";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string };

function isActive(pathname: string, href: string) {
  if (href === "/admin" || href === "/client") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({
  nav,
  tone,
  onNavigate,
}: {
  nav: NavItem[];
  tone: "dark" | "light";
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav className="space-y-1" aria-label="Portal">
      {nav.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "block rounded-md px-2 py-1.5 text-sm transition-colors duration-150",
              active
                ? tone === "dark"
                  ? "bg-[#1a2420] font-medium text-[#e8eee9] ring-1 ring-[#d4b45a]/25"
                  : "bg-[#d9e0dc] font-medium text-[#0c1612]"
                : tone === "dark"
                  ? "text-[#b7c4bd] hover:bg-[#1a2420] hover:text-[#e8eee9]"
                  : "text-[#4f5c56] hover:bg-[#d9e0dc] hover:text-[#0c1612]",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function PortalSidebarNav({
  nav,
  tone,
  homeHref,
  brandSub,
}: {
  nav: NavItem[];
  tone: "dark" | "light";
  homeHref: string;
  brandSub: string;
}) {
  return (
    <aside
      className={cn(
        "hidden w-56 shrink-0 border-r px-4 py-6 md:block",
        tone === "dark" ? "border-[#24302b]" : "border-[#c5cec8]",
      )}
    >
      <Link href={homeHref} className="mb-8 flex items-center gap-2">
        <LynxMark className="h-7 w-7" />
        <div>
          <p className="font-[family-name:var(--font-syne)] text-sm tracking-wide">
            Lynx
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#b08d1f]">
            {brandSub}
          </p>
        </div>
      </Link>
      <NavLinks nav={nav} tone={tone} />
      <form action={signOutAction} className="mt-10">
        <Button type="submit" variant="outline" size="sm" className="w-full">
          Sign out
        </Button>
      </form>
    </aside>
  );
}

export function PortalMobileNav({
  nav,
  tone,
  brandSub,
  title,
}: {
  nav: NavItem[];
  tone: "dark" | "light";
  brandSub: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className={cn(
          buttonVariants({ variant: "outline", size: "icon-sm" }),
          "md:hidden",
        )}
        aria-label="Open menu"
      >
        <Menu className="size-4" />
      </SheetTrigger>
      <SheetContent
        side="left"
        className={cn(
          "w-[min(100%,18rem)] border-[#24302b] p-0",
          tone === "dark"
            ? "bg-[#0b1210] text-[#e8eee9]"
            : "bg-[#e7ece9] text-[#0c1612]",
        )}
      >
        <SheetHeader className="border-b border-[#24302b] text-left">
          <SheetTitle
            className={cn(
              "flex items-center gap-2",
              tone === "dark" ? "text-[#e8eee9]" : "text-[#0c1612]",
            )}
          >
            <LynxMark className="h-6 w-6" />
            <span className="font-[family-name:var(--font-syne)]">{title}</span>
          </SheetTitle>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#b08d1f]">
            {brandSub}
          </p>
        </SheetHeader>
        <div className="px-3 py-4">
          <NavLinks nav={nav} tone={tone} onNavigate={() => setOpen(false)} />
          <form action={signOutAction} className="mt-8 px-1">
            <Button type="submit" variant="outline" size="sm" className="w-full">
              Sign out
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
