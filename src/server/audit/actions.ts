"use server";

import { audit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/session";

/** Records a table export (what, format, how many rows) in the audit log. */
export async function logExport(name: string, format: "csv" | "xlsx", rows: number) {
  const user = await getCurrentUser();
  if (!user) return;
  await audit({ userId: user.id, action: "export", entity: String(name).slice(0, 80), data: { format, rows: Math.max(0, Math.floor(rows)) } });
}
