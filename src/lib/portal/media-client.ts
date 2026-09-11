export type ProgressMedia = { type: string; url: string };

/** Client-safe helper — mirrors server mediaImages without server-only imports. */
export function mediaImages(media: unknown): ProgressMedia[] {
  if (!Array.isArray(media)) return [];
  return media.filter(
    (item): item is ProgressMedia =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as ProgressMedia).url === "string" &&
      String((item as ProgressMedia).url).startsWith("http"),
  );
}
