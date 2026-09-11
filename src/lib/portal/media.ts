import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "project-media";
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

async function ensureBucket(admin: SupabaseClient) {
  const { data: buckets } = await admin.storage.listBuckets();
  if (buckets?.some((b) => b.name === BUCKET)) return;
  await admin.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: [...ALLOWED],
  });
}

function extensionFor(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "jpg";
}

/**
 * Uploads an image under `folder/` in project-media and returns a public URL.
 * Returns null when no file was provided.
 */
export async function uploadPortalImage(
  admin: SupabaseClient,
  folder: string,
  file: File | null,
  label = "Image",
): Promise<string | null> {
  if (!file || file.size <= 0) return null;
  if (file.size > MAX_BYTES) {
    throw new Error(`${label} must be under 8 MB.`);
  }
  if (!ALLOWED.has(file.type)) {
    throw new Error(`Use a JPG, PNG, WEBP or GIF ${label.toLowerCase()}.`);
  }

  await ensureBucket(admin);

  const safeFolder = folder.replace(/^\/+|\/+$/g, "") || "uploads";
  const path = `${safeFolder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensionFor(file.type)}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await admin.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(error.message);

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl || null;
}

/** Progress screenshot helper — stores under the project id. */
export async function uploadProjectScreenshot(
  admin: SupabaseClient,
  projectId: string,
  file: File | null,
): Promise<string | null> {
  return uploadPortalImage(admin, projectId, file, "Screenshot");
}

export type ProgressMedia = { type: string; url: string };

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
