/**
 * Per-project visual identity.
 * Themes are assigned deterministically from id/code/name so every project
 * feels distinct without requiring manual setup. Optional override via
 * projects.meta.theme (theme id) or projects.meta.accent (hex).
 */

export type ProjectThemeId =
  | "ember"
  | "lagoon"
  | "ink"
  | "saffron"
  | "verdant"
  | "cobalt"
  | "blush"
  | "arctic"
  | "voltage"
  | "cinder";

export type ProjectTheme = {
  id: ProjectThemeId;
  /** Internal theme label — not shown in product UI. */
  motif: string;
  /** Accent for text, chips, borders */
  accent: string;
  /** Soft wash behind the card */
  wash: string;
  /** Stronger wash for hero headers */
  washStrong: string;
  /** Secondary accent for gradients */
  secondary: string;
  /** Pattern style class key */
  pattern: "embers" | "waves" | "grid" | "diagonals" | "dots" | "rings" | "shards";
  /** Soft glow color for shadows */
  glow: string;
};

export const PROJECT_THEMES: Record<ProjectThemeId, ProjectTheme> = {
  ember: {
    id: "ember",
    motif: "Ember forge",
    accent: "#f0a06a",
    wash: "rgba(180, 72, 28, 0.18)",
    washStrong: "rgba(180, 72, 28, 0.32)",
    secondary: "#7a2e14",
    pattern: "embers",
    glow: "rgba(240, 160, 106, 0.28)",
  },
  lagoon: {
    id: "lagoon",
    motif: "Lagoon tide",
    accent: "#5ecfc0",
    wash: "rgba(20, 120, 110, 0.22)",
    washStrong: "rgba(20, 120, 110, 0.36)",
    secondary: "#0d4a44",
    pattern: "waves",
    glow: "rgba(94, 207, 192, 0.26)",
  },
  ink: {
    id: "ink",
    motif: "Night ink",
    accent: "#c9d4e0",
    wash: "rgba(70, 90, 120, 0.22)",
    washStrong: "rgba(70, 90, 120, 0.38)",
    secondary: "#1a2438",
    pattern: "grid",
    glow: "rgba(170, 190, 220, 0.22)",
  },
  saffron: {
    id: "saffron",
    motif: "Saffron wire",
    accent: "#e6c35c",
    wash: "rgba(150, 110, 20, 0.20)",
    washStrong: "rgba(150, 110, 20, 0.34)",
    secondary: "#5a4210",
    pattern: "diagonals",
    glow: "rgba(230, 195, 92, 0.28)",
  },
  verdant: {
    id: "verdant",
    motif: "Moss line",
    accent: "#8fd48a",
    wash: "rgba(40, 110, 55, 0.22)",
    washStrong: "rgba(40, 110, 55, 0.36)",
    secondary: "#1a3d22",
    pattern: "dots",
    glow: "rgba(143, 212, 138, 0.24)",
  },
  cobalt: {
    id: "cobalt",
    motif: "Steel current",
    accent: "#7eb0f0",
    wash: "rgba(35, 80, 150, 0.24)",
    washStrong: "rgba(35, 80, 150, 0.38)",
    secondary: "#142a52",
    pattern: "rings",
    glow: "rgba(126, 176, 240, 0.28)",
  },
  blush: {
    id: "blush",
    motif: "Dust rose",
    accent: "#e8a0b0",
    wash: "rgba(140, 60, 80, 0.20)",
    washStrong: "rgba(140, 60, 80, 0.34)",
    secondary: "#4a1e2c",
    pattern: "shards",
    glow: "rgba(232, 160, 176, 0.26)",
  },
  arctic: {
    id: "arctic",
    motif: "Frost pane",
    accent: "#b8e4f0",
    wash: "rgba(90, 140, 160, 0.18)",
    washStrong: "rgba(90, 140, 160, 0.32)",
    secondary: "#1e3540",
    pattern: "grid",
    glow: "rgba(184, 228, 240, 0.24)",
  },
  voltage: {
    id: "voltage",
    motif: "Signal cut",
    accent: "#d4f06a",
    wash: "rgba(100, 130, 20, 0.20)",
    washStrong: "rgba(100, 130, 20, 0.34)",
    secondary: "#2e3a0c",
    pattern: "shards",
    glow: "rgba(212, 240, 106, 0.26)",
  },
  cinder: {
    id: "cinder",
    motif: "Cinder grain",
    accent: "#d4a890",
    wash: "rgba(100, 70, 55, 0.22)",
    washStrong: "rgba(100, 70, 55, 0.36)",
    secondary: "#3a2820",
    pattern: "embers",
    glow: "rgba(212, 168, 144, 0.24)",
  },
};

const THEME_ORDER = Object.keys(PROJECT_THEMES) as ProjectThemeId[];

const KEYWORD_HINTS: Array<{ re: RegExp; theme: ProjectThemeId }> = [
  { re: /chess|game|board|play/i, theme: "ink" },
  { re: /shop|store|commerce|cart|pay/i, theme: "saffron" },
  { re: /health|care|clinic|well/i, theme: "verdant" },
  { re: /ocean|sea|wave|aqua|water|marine/i, theme: "lagoon" },
  { re: /frost|ice|snow|cold|nord/i, theme: "arctic" },
  { re: /studio|design|art|photo|film/i, theme: "blush" },
  { re: /tech|soft|code|api|data|cloud/i, theme: "cobalt" },
  { re: /food|cafe|kitchen|spice|cook/i, theme: "ember" },
  { re: /energy|power|signal|radio|volt/i, theme: "voltage" },
  { re: /law|firm|estate|build|stone/i, theme: "cinder" },
];

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function readMetaTheme(
  meta: unknown,
): { id?: ProjectThemeId; accent?: string } {
  if (!meta || typeof meta !== "object") return {};
  const record = meta as Record<string, unknown>;
  const raw = String(record.theme ?? record.motif ?? "").toLowerCase().trim();
  const id = THEME_ORDER.includes(raw as ProjectThemeId)
    ? (raw as ProjectThemeId)
    : undefined;
  const accent =
    typeof record.accent === "string" && /^#[0-9a-f]{6}$/i.test(record.accent)
      ? record.accent
      : undefined;
  return { id, accent };
}

export function resolveProjectTheme(input: {
  id?: string | null;
  name?: string | null;
  code?: string | null;
  summary?: string | null;
  meta?: unknown;
}): ProjectTheme {
  const override = readMetaTheme(input.meta);
  if (override.id) {
    const base = PROJECT_THEMES[override.id];
    return override.accent ? { ...base, accent: override.accent } : base;
  }

  const haystack = [input.name, input.code, input.summary]
    .filter(Boolean)
    .join(" ");
  for (const hint of KEYWORD_HINTS) {
    if (hint.re.test(haystack)) {
      const base = PROJECT_THEMES[hint.theme];
      return override.accent ? { ...base, accent: override.accent } : base;
    }
  }

  const seed = hashSeed(
    String(input.id || input.code || input.name || "lynx-project"),
  );
  const base = PROJECT_THEMES[THEME_ORDER[seed % THEME_ORDER.length]!];
  return override.accent ? { ...base, accent: override.accent } : base;
}

/** Two-letter monogram for the project mark. */
export function projectMonogram(name?: string | null, code?: string | null) {
  const fromName = String(name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
  if (fromName.length >= 1) return fromName.slice(0, 2);
  const fromCode = String(code ?? "")
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 2)
    .toUpperCase();
  return fromCode || "LX";
}

export function themeCssVars(theme: ProjectTheme): Record<string, string> {
  return {
    "--project-accent": theme.accent,
    "--project-wash": theme.wash,
    "--project-wash-strong": theme.washStrong,
    "--project-secondary": theme.secondary,
    "--project-glow": theme.glow,
  };
}
