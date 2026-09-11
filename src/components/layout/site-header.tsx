"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";
import { LynxLogo } from "@/components/brand/lynx-logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 text-foreground backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <LynxLogo size="sm" />

        <nav
          className="hidden items-center gap-7 text-sm md:flex"
          aria-label="Primary"
        >
          {siteConfig.nav.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "transition-colors hover:text-foreground",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle />
          <Link
            href="/contact"
            className={cn(
              buttonVariants({ size: "sm" }),
              "hidden h-8 bg-forest text-primary-foreground hover:bg-forest/90 sm:inline-flex dark:bg-gold dark:text-gold-foreground dark:hover:bg-gold/90",
            )}
          >
            Start a project
          </Link>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon-sm" }),
                "md:hidden",
              )}
              aria-label="Open menu"
            >
              <Menu className="size-4" />
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(100%,20rem)]">
              <SheetHeader>
                <SheetTitle className="sr-only">{siteConfig.name}</SheetTitle>
                <LynxLogo href={null} size="md" className="mt-1" />
              </SheetHeader>
              <nav className="mt-6 grid gap-1" aria-label="Mobile">
                {siteConfig.nav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-2.5 text-base hover:bg-muted"
                  >
                    {item.label}
                  </Link>
                ))}
                <Link
                  href="/contact"
                  onClick={() => setOpen(false)}
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "mt-4 h-11 bg-forest text-primary-foreground hover:bg-forest/90 dark:bg-gold dark:text-gold-foreground",
                  )}
                >
                  Start a project
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
