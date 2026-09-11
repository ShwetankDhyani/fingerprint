import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import {
  projectMonogram,
  resolveProjectTheme,
  themeCssVars,
  type ProjectTheme,
} from "@/lib/portal/project-theme";
import { cn } from "@/lib/utils";

function PatternLayer({ theme }: { theme: ProjectTheme }) {
  const common = "pointer-events-none absolute inset-0 opacity-[0.55]";
  switch (theme.pattern) {
    case "embers":
      return (
        <div
          className={common}
          style={{
            backgroundImage: `radial-gradient(circle at 20% 30%, ${theme.accent}55 0 1.5px, transparent 2px),
              radial-gradient(circle at 70% 55%, ${theme.accent}40 0 1px, transparent 2px),
              radial-gradient(circle at 40% 80%, ${theme.accent}35 0 2px, transparent 3px),
              radial-gradient(circle at 85% 20%, ${theme.accent}45 0 1px, transparent 2px)`,
            backgroundSize: "48px 48px, 36px 36px, 56px 56px, 28px 28px",
          }}
        />
      );
    case "waves":
      return (
        <div
          className={common}
          style={{
            backgroundImage: `repeating-linear-gradient(-12deg, transparent 0 10px, ${theme.accent}18 10px 11px, transparent 11px 22px)`,
          }}
        />
      );
    case "grid":
      return (
        <div
          className={common}
          style={{
            backgroundImage: `linear-gradient(${theme.accent}22 1px, transparent 1px), linear-gradient(90deg, ${theme.accent}22 1px, transparent 1px)`,
            backgroundSize: "22px 22px",
            maskImage: "linear-gradient(135deg, black 0%, transparent 70%)",
          }}
        />
      );
    case "diagonals":
      return (
        <div
          className={common}
          style={{
            backgroundImage: `repeating-linear-gradient(135deg, transparent 0 8px, ${theme.accent}20 8px 9px)`,
          }}
        />
      );
    case "dots":
      return (
        <div
          className={common}
          style={{
            backgroundImage: `radial-gradient(${theme.accent}50 0.9px, transparent 1.1px)`,
            backgroundSize: "14px 14px",
            maskImage:
              "radial-gradient(circle at 30% 20%, black, transparent 75%)",
          }}
        />
      );
    case "rings":
      return (
        <div
          className={cn(common, "overflow-hidden")}
          style={{
            backgroundImage: `radial-gradient(circle at 85% -10%, transparent 35%, ${theme.accent}28 36%, transparent 37%),
              radial-gradient(circle at 85% -10%, transparent 48%, ${theme.accent}18 49%, transparent 50%)`,
          }}
        />
      );
    case "shards":
      return (
        <div
          className={common}
          style={{
            backgroundImage: `repeating-linear-gradient(25deg, transparent 0 14px, ${theme.accent}16 14px 15px, transparent 15px 28px),
              repeating-linear-gradient(-40deg, transparent 0 18px, ${theme.accent}12 18px 19px)`,
          }}
        />
      );
    default:
      return null;
  }
}

export function ProjectMark({
  name,
  code,
  theme,
  size = "md",
}: {
  name?: string | null;
  code?: string | null;
  theme: ProjectTheme;
  size?: "sm" | "md" | "lg";
}) {
  const mono = projectMonogram(name, code);
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border font-[family-name:var(--font-syne)] font-semibold tracking-tight",
        size === "sm" && "size-10 text-sm",
        size === "md" && "size-12 text-base",
        size === "lg" && "size-16 text-xl",
      )}
      style={{
        color: theme.accent,
        borderColor: `${theme.accent}55`,
        background: `linear-gradient(145deg, ${theme.washStrong}, ${theme.secondary}cc)`,
        boxShadow: `0 0 0 1px ${theme.secondary}, 0 10px 28px -16px ${theme.glow}`,
      }}
      aria-hidden
    >
      <PatternLayer theme={theme} />
      <span className="relative z-[1]">{mono}</span>
    </div>
  );
}

type ProjectSeed = {
  id: string;
  name: string;
  code?: string | null;
  summary?: string | null;
  meta?: unknown;
};

/** Distinctive project tile — each project gets its own visual skin. */
export function ProjectCard({
  href,
  project,
  statusLabel,
  orgName,
  trailing,
  className,
}: {
  href: string;
  project: ProjectSeed;
  statusLabel: string;
  orgName?: string | null;
  trailing?: ReactNode;
  className?: string;
}) {
  const theme = resolveProjectTheme(project);
  const vars = themeCssVars(theme) as CSSProperties;

  return (
    <li className={cn("list-none", className)}>
      <article
        className="group/card relative h-full overflow-hidden rounded-2xl border border-[#2a3832] transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:border-[color:var(--project-accent)]/45"
        style={{
          ...vars,
          background: `linear-gradient(155deg, ${theme.wash} 0%, #0e1613 42%, #0b1210 100%)`,
          boxShadow: `0 18px 40px -28px ${theme.glow}`,
        }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-70"
          style={{
            background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)`,
          }}
        />
        <PatternLayer theme={theme} />
        <div
          className="pointer-events-none absolute -right-8 -top-10 size-36 rounded-full blur-2xl"
          style={{ background: theme.washStrong }}
        />

        <Link
          href={href}
          className="relative z-[1] flex h-full items-start gap-3.5 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--project-accent)]/50"
        >
          <ProjectMark
            name={project.name}
            code={project.code}
            theme={theme}
          />
          <div className="min-w-0 flex-1">
            <p
              className="inline-flex rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]"
              style={{
                color: theme.accent,
                background: `${theme.accent}18`,
                border: `1px solid ${theme.accent}33`,
              }}
            >
              {statusLabel}
            </p>
            <h3 className="mt-1.5 truncate font-[family-name:var(--font-syne)] text-lg text-[#eef3ef] transition-colors group-hover/card:text-white">
              {project.name}
            </h3>
            <p className="mt-0.5 truncate font-mono text-xs text-[#8a9b93]">
              {project.code ?? "—"}
              {orgName ? ` · ${orgName}` : ""}
            </p>
            {project.summary ? (
              <p className="mt-2 line-clamp-2 text-sm leading-snug text-[#9aaba2]">
                {project.summary}
              </p>
            ) : null}
            {trailing ? <div className="mt-3">{trailing}</div> : null}
          </div>
        </Link>
      </article>
    </li>
  );
}

/** Atmospheric hero band for project detail pages. */
export function ProjectHero({
  project,
  statusLabel,
  orgName,
  children,
}: {
  project: ProjectSeed;
  statusLabel: string;
  orgName?: string | null;
  children?: ReactNode;
}) {
  const theme = resolveProjectTheme(project);
  const vars = themeCssVars(theme) as CSSProperties;

  return (
    <header
      className="relative overflow-hidden rounded-2xl border border-[#2a3832] px-5 py-6 md:px-7 md:py-8"
      style={{
        ...vars,
        background: `linear-gradient(125deg, ${theme.washStrong} 0%, #0e1613 48%, #0b1210 100%)`,
        boxShadow: `inset 0 1px 0 ${theme.accent}33, 0 24px 60px -40px ${theme.glow}`,
      }}
    >
      <PatternLayer theme={theme} />
      <div
        className="pointer-events-none absolute -left-16 top-1/2 size-56 -translate-y-1/2 rounded-full blur-3xl"
        style={{ background: theme.washStrong }}
      />
      <div
        className="pointer-events-none absolute -right-10 -top-12 size-44 rounded-full blur-3xl"
        style={{ background: `${theme.accent}22` }}
      />

      <div className="relative z-[1] flex flex-wrap items-start gap-4">
        <ProjectMark
          name={project.name}
          code={project.code}
          theme={theme}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <p
            className="inline-flex rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]"
            style={{
              color: theme.accent,
              background: `${theme.accent}18`,
              border: `1px solid ${theme.accent}40`,
            }}
          >
            {statusLabel}
          </p>
          <h2 className="mt-1 font-[family-name:var(--font-syne)] text-3xl tracking-tight text-[#f2f6f3] md:text-4xl">
            {project.name}
          </h2>
          <p className="mt-1 font-mono text-xs text-[#9aaba2]">
            {project.code ?? "Project"}
            {orgName ? ` · ${orgName}` : ""}
          </p>
          {project.summary ? (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#c5d1ca]">
              {project.summary}
            </p>
          ) : null}
          {children}
        </div>
      </div>
    </header>
  );
}
