import { cn } from "@/lib/utils";

const PALETTES = [
  { from: "#1a2e24", to: "#0d1814", accent: "#c4a046" },
  { from: "#1c2830", to: "#0e151a", accent: "#7eb8a8" },
  { from: "#2a2418", to: "#14110c", accent: "#d4b45a" },
  { from: "#1a2428", to: "#0c1214", accent: "#8fb4c4" },
  { from: "#241c22", to: "#120e11", accent: "#c49a8f" },
  { from: "#18261e", to: "#0b1410", accent: "#9bc47a" },
] as const;

function hashName(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function clientPalette(name: string) {
  return PALETTES[hashName(name) % PALETTES.length];
}

export function clientInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "·";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function ClientAvatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const palette = clientPalette(name);
  const initials = clientInitials(name);
  const dim =
    size === "sm"
      ? "size-9 text-xs"
      : size === "lg"
        ? "size-14 text-lg"
        : size === "xl"
          ? "size-20 text-2xl"
          : "size-11 text-sm";

  return (
    <div
      aria-hidden
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl font-[family-name:var(--font-syne)] font-medium tracking-tight",
        dim,
        className,
      )}
      style={{
        background: `linear-gradient(145deg, ${palette.from}, ${palette.to})`,
        color: palette.accent,
        boxShadow: `inset 0 0 0 1px ${palette.accent}33`,
      }}
    >
      <span
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: `radial-gradient(circle at 30% 20%, ${palette.accent}55, transparent 55%)`,
        }}
      />
      <span className="relative">{initials}</span>
    </div>
  );
}
