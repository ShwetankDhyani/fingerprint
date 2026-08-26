import { cn } from "@/lib/utils";

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
  tone?: "default" | "inverse";
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  className,
  tone = "default",
}: SectionHeadingProps) {
  return (
    <div className={cn("max-w-2xl", className)}>
      {eyebrow ? (
        <p
          className={cn(
            "font-display text-sm font-semibold tracking-[0.2em] uppercase",
            tone === "inverse" ? "text-gold" : "text-forest/60 dark:text-gold/80",
          )}
        >
          {eyebrow}
        </p>
      ) : null}
      <h2
        className={cn(
          "mt-3 font-display text-3xl tracking-tight sm:text-5xl",
          tone === "inverse" ? "text-white" : "text-forest dark:text-foreground",
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "mt-4 text-base leading-relaxed sm:text-lg",
            tone === "inverse"
              ? "text-white/70"
              : "text-muted-foreground",
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
