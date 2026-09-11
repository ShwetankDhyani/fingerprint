import Link from "next/link";
import { LynxMark } from "@/components/brand/lynx-mark";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

type LynxLogoProps = {
  className?: string;
  /** Pass `null` to render the lockup without a link. */
  href?: string | null;
  size?: Size;
};

const sizeMap = {
  sm: {
    gap: "gap-2.5",
    mark: "h-8",
    name: "text-[1.0625rem]",
    tag: "text-[0.5rem] tracking-[0.28em]",
    stack: "gap-[0.2rem]",
  },
  md: {
    gap: "gap-3",
    mark: "h-10",
    name: "text-xl",
    tag: "text-[0.5625rem] tracking-[0.3em]",
    stack: "gap-[0.25rem]",
  },
  lg: {
    gap: "gap-4",
    mark: "h-14",
    name: "text-3xl",
    tag: "text-[0.6875rem] tracking-[0.32em]",
    stack: "gap-[0.3rem]",
  },
} as const;

/**
 * Brand lockup. Hover restages the 2011 GIF shimmer as a specular that
 * exists only where there is ink:
 * - Mark: champagne duplicate clipped by a CSS mask on an HTML wrapper
 * - Name: background-clip:text
 * Gaps between mark and type never receive paint.
 */
export function LynxLogo({ className, href = "/", size = "sm" }: LynxLogoProps) {
  const s = sizeMap[size];
  const body = (
    <>
      <span className="lynx-logo__mark-wrap relative inline-flex">
        <LynxMark className={cn("w-auto", s.mark)} />
        <span className="lynx-logo__mark-sheen" aria-hidden>
          <LynxMark className={cn("w-auto", s.mark)} />
        </span>
      </span>
      <span className={cn("flex flex-col items-start leading-none", s.stack)}>
        <span
          className={cn(
            "lynx-logo__name font-display font-semibold tracking-tight",
            s.name,
          )}
        >
          Lynx
        </span>
        <span
          className={cn(
            "lynx-logo__tag font-sans font-medium uppercase text-muted-foreground",
            s.tag,
          )}
        >
          Web Solutions
        </span>
      </span>
    </>
  );
  const base = cn(
    "lynx-logo relative inline-flex items-center text-forest dark:text-gold",
    s.gap,
    className,
  );

  if (href === null) {
    return <span className={base}>{body}</span>;
  }

  return (
    <Link
      href={href}
      aria-label={siteConfig.name}
      className={cn(
        base,
        "rounded-sm outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring",
      )}
    >
      {body}
    </Link>
  );
}
