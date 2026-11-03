"use server";

import { ActionError, defineAction } from "@/lib/action";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { messageSchema } from "./schema";

/** A client writes to the office; the case lawyer (or the staff who manage clients) is notified. */
export const sendClientMessage = defineAction({ module: "clients", perm: "view", entity: "Message", schema: messageSchema, portal: true }, async (input, { user }) => {
  const clientId = user.clientId!;
  let recipients: string[] = [];
  if (input.matterId) {
    const m = await prisma.matter.findFirst({ where: { id: input.matterId, clientId, deletedAt: null }, include: { members: true } });
    if (!m) throw new ActionError("errors.forbidden");
    recipients = [m.responsibleId, ...m.members.map((x) => x.userId)].filter((u): u is string => !!u);
  }
  if (!recipients.length) {
    const staff = await prisma.user.findMany({ where: { isActive: true, deletedAt: null, clientId: null, role: { permissions: { some: { module: "clients", action: "update" } } } }, select: { id: true } });
    recipients = staff.map((s) => s.id);
  }
  const msg = await prisma.message.create({ data: { clientId, matterId: input.matterId, fromUserId: user.id, fromClient: true, body: input.body } });
  const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId } });
  for (const userId of new Set(recipients)) {
    await notify({ userId, type: "message", title: client.nameAr, body: input.body.slice(0, 300), link: `/clients/${clientId}?tab=messages` });
  }
  return { id: msg.id, audit: { clientId, matterId: input.matterId } };
});

/** Staff reply to a client; the client's portal users are notified. */
export const replyToClient = defineAction({ module: "clients", perm: "update", entity: "Message", schema: messageSchema }, async (input, { user }, clientId: string) => {
  if (input.matterId && !(await prisma.matter.findFirst({ where: { id: input.matterId, clientId } }))) throw new ActionError("billing.matterClient");
  const msg = await prisma.message.create({ data: { clientId, matterId: input.matterId, fromUserId: user.id, fromClient: false, body: input.body } });
  await prisma.message.updateMany({ where: { clientId, fromClient: true, readAt: null }, data: { readAt: new Date() } });
  const portalUsers = await prisma.user.findMany({ where: { clientId, isActive: true, deletedAt: null }, select: { id: true } });
  for (const u of portalUsers) await notify({ userId: u.id, type: "message", title: user.nameAr, body: input.body.slice(0, 300), link: "/portal/messages" });
  return { id: msg.id, audit: { clientId } };
});
