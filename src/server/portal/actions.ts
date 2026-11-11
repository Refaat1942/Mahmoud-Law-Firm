"use server";

import { getTranslations } from "next-intl/server";
import { ActionError, defineAction } from "@/lib/action";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { putFile } from "@/lib/storage";
import { approvalRequestSchema, approvalResponseSchema, messageSchema, portalUploadSchema } from "./schema";

/** File types a client may upload from the portal. */
const PORTAL_UPLOAD_TYPES = /\.(pdf|jpe?g|png|heic|docx?|xlsx?|txt)$/i;

/** The case team for a matter, or every staff member who manages clients when there is no matter. */
async function officeRecipients(clientId: string, matterId?: string | null) {
  if (matterId) {
    const m = await prisma.matter.findFirst({ where: { id: matterId, clientId, deletedAt: null }, include: { members: true } });
    if (!m) throw new ActionError("errors.forbidden");
    const ids = [m.responsibleId, ...m.members.map((x) => x.userId)].filter((u): u is string => !!u);
    if (ids.length) return [...new Set(ids)];
  }
  const staff = await prisma.user.findMany({
    where: { isActive: true, deletedAt: null, clientId: null, role: { permissions: { some: { module: "clients", action: "update" } } } },
    select: { id: true },
  });
  return staff.map((s) => s.id);
}

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

/** Staff ask the client to approve a step (settlement offer, fee change, filing); portal users are notified. */
export const requestApproval = defineAction(
  { module: "clients", perm: "update", entity: "ClientApproval", schema: approvalRequestSchema },
  async (input, { user }, clientId: string) => {
    if (input.matterId && !(await prisma.matter.findFirst({ where: { id: input.matterId, clientId, deletedAt: null } }))) throw new ActionError("billing.matterClient");
    const a = await prisma.clientApproval.create({ data: { ...input, clientId, requestedById: user.id } });
    const portalUsers = await prisma.user.findMany({ where: { clientId, isActive: true, deletedAt: null }, select: { id: true } });
    for (const u of portalUsers) await notify({ userId: u.id, type: "approval", title: input.title, body: input.details?.slice(0, 300) ?? "", link: "/portal" });
    return { id: a.id };
  },
);

export const cancelApproval = defineAction({ module: "clients", perm: "update", entity: "ClientApproval" }, async (_i, _c, id: string) => {
  const a = await prisma.clientApproval.findUnique({ where: { id } });
  if (!a || a.status !== "PENDING") throw new ActionError("errors.notFound");
  await prisma.clientApproval.delete({ where: { id } });
  return { id, audit: a };
});

/** The client approves or declines; the answer is final and the requester and case team are notified. */
export const respondApproval = defineAction(
  { module: "clients", perm: "view", entity: "ClientApproval", schema: approvalResponseSchema, portal: true },
  async (input, { user }, id: string) => {
    const a = await prisma.clientApproval.findFirst({ where: { id, clientId: user.clientId!, status: "PENDING" } });
    if (!a) throw new ActionError("errors.notFound");
    await prisma.clientApproval.update({ where: { id }, data: { status: input.status, response: input.response, respondedAt: new Date(), respondedById: user.id } });
    const recipients = new Set([a.requestedById, ...(await officeRecipients(a.clientId, a.matterId))].filter((u): u is string => !!u));
    const client = await prisma.client.findUniqueOrThrow({ where: { id: a.clientId } });
    for (const userId of recipients)
      await notify({ userId, type: "approval", title: `${client.nameAr}: ${a.title}`, body: `${input.status}${input.response ? ` — ${input.response.slice(0, 250)}` : ""}`, link: `/clients/${a.clientId}?tab=approvals` });
    return { id, audit: { status: input.status, response: input.response } };
  },
);

/** A client uploads a file; it is stored on the client (and case) as a client-visible document and the office is notified. */
export const uploadClientDocument = defineAction(
  { module: "clients", perm: "view", entity: "Document", schema: portalUploadSchema, portal: true },
  async ({ file, name, matterId }, { user }) => {
    const clientId = user.clientId!;
    if (!PORTAL_UPLOAD_TYPES.test(file.name)) throw new ActionError("portal.fileType");
    const recipients = await officeRecipients(clientId, matterId);
    const stored = await putFile(file, "documents");
    const t = await getTranslations("portal");
    const doc = await prisma.document.create({
      data: {
        name: name || file.name,
        clientId,
        matterId: matterId ?? null,
        folder: "/" + t("uploadFolder"),
        visibleToClient: true,
        uploadedById: user.id,
        versions: { create: { version: 1, storageKey: stored.key, fileName: stored.fileName, mimeType: stored.mimeType, size: stored.size, uploadedById: user.id } },
      },
    });
    const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId } });
    for (const userId of recipients) await notify({ userId, type: "document", title: t("uploadedBy", { client: client.nameAr }), body: doc.name, link: `/documents/${doc.id}` });
    return { id: doc.id, audit: { clientId, matterId, fileName: stored.fileName, size: stored.size } };
  },
);
