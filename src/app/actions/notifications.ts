"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth/session";
import { markNotificationsRead } from "@/lib/portal/notify";

export async function markNotificationsReadAction(formData: FormData) {
  const profile = await requireStaff();
  const single = String(formData.get("notificationId") ?? "").trim();
  await markNotificationsRead(profile.id, single ? [single] : undefined);
  revalidatePath("/admin", "layout");
}
