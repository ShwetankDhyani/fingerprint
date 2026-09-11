import Link from "next/link";
import { LynxLogo } from "@/components/brand/lynx-logo";
import { siteConfig } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/80 bg-mist dark:bg-forest/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <LynxLogo size="md" />
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Web engineering since {siteConfig.founded}. India and global. You
            work with the people who design and ship — with support any day of
            the week.
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Navigate</p>
          <ul className="mt-3 grid gap-2 text-sm text-muted-foreground">
            {siteConfig.nav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-foreground">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Contact</p>
          <ul className="mt-3 grid gap-2 text-sm text-muted-foreground">
            <li>
              <a
                href={`mailto:${siteConfig.email}`}
                className="hover:text-foreground"
              >
                {siteConfig.email}
              </a>
            </li>
            {siteConfig.phones.map((phone) => (
              <li key={phone}>
                <a
                  href={`tel:${phone.replace(/\s/g, "")}`}
                  className="hover:text-foreground"
                >
                  {phone}
                </a>
              </li>
            ))}
            <li>India · Global delivery</li>
            <li>
              <a
                href={siteConfig.social.linkedin}
                className="hover:text-foreground"
                rel="noopener noreferrer"
                target="_blank"
              >
                LinkedIn
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>
            © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <span>
              Est. {siteConfig.founded} ·{" "}
              {siteConfig.url.replace(/^https?:\/\//, "")}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
