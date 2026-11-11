import { headers } from "next/headers";
import { prisma, type Tx } from "./prisma";

export async function audit(
  entry: { userId?: string | null; action: string; entity: string; entityId?: string | null; data?: unknown },
  tx: Tx = prisma,
) {
  let ip: string | null = null;
  try {
    const h = await headers();
    // Prefer X-Real-IP (set by nginx); the first X-Forwarded-For entry is client-controlled.
    ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? null;
  } catch {
    ip = null;
  }
  await tx.auditLog.create({
    data: {
      userId: entry.userId ?? null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      data: entry.data === undefined ? undefined : JSON.parse(JSON.stringify(entry.data)),
      ip,
    },
  });
}
