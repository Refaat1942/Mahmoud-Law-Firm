import "server-only";
import { ActionError } from "@/lib/action";
import { prisma, type Tx } from "@/lib/prisma";
import { matterScope, type CurrentUser } from "@/lib/session";

/** Throws unless the user may work on the matter (assigned or role sees all). */
export async function assertMatterAccess(user: CurrentUser, matterId: string) {
  const m = await prisma.matter.findFirst({ where: { AND: [matterScope(user), { id: matterId }] }, select: { id: true } });
  if (!m) throw new ActionError("errors.forbidden");
}

export async function logEvent(tx: Tx, matterId: string, type: string, title: string, userId?: string, details?: string) {
  await tx.matterEvent.create({ data: { matterId, type, title, details, userId } });
}
