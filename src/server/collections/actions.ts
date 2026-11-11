"use server";

import { ActionError, defineAction } from "@/lib/action";
import { prisma } from "@/lib/prisma";
import { invoiceScope } from "../billing/queries";
import { collectionScope } from "./queries";
import { collectionNoteSchema } from "./schema";

export const createCollectionNote = defineAction(
  { module: "billing", perm: "update", entity: "CollectionNote", schema: collectionNoteSchema },
  async (input, { user }, clientId: string) => {
    if (input.invoiceId) {
      const inv = await prisma.invoice.findFirst({ where: { AND: [invoiceScope(user), { id: input.invoiceId, clientId }] } });
      if (!inv) throw new ActionError("errors.notFound");
    } else if (!user.scopeAll) {
      const visible = await prisma.invoice.count({ where: { AND: [invoiceScope(user), { clientId }] } });
      if (!visible) throw new ActionError("errors.forbidden");
    }
    const n = await prisma.collectionNote.create({
      data: { ...input, clientId, promisedAmount: input.promisedAmount ?? null, createdById: user.id, assigneeId: input.assigneeId ?? user.id },
    });
    return { id: n.id };
  },
);

export const deleteCollectionNote = defineAction({ module: "billing", perm: "delete", entity: "CollectionNote" }, async (_i, { user }, id: string) => {
  const n = await prisma.collectionNote.findFirst({ where: { AND: [collectionScope(user), { id }] } });
  if (!n) throw new ActionError("errors.notFound");
  await prisma.collectionNote.delete({ where: { id } });
  return { id, audit: n };
});
