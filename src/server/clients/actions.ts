"use server";

import { getTranslations } from "next-intl/server";
import { ActionError, defineAction } from "@/lib/action";
import { prisma } from "@/lib/prisma";
import { nextNumber } from "@/lib/sequence";
import { putFile } from "@/lib/storage";
import { clientSchema, contactSchema, partySchema, poaSchema } from "./schema";

const normalizeEid = (v?: string) => (v ? v.replace(/^(784)-?(\d{4})-?(\d{7})-?(\d)$/, "$1-$2-$3-$4") : v);

/** Blocks a second client with the same Emirates ID, trade licence or TRN (the identifiers that must be unique). */
async function assertNoDuplicate(input: { emiratesId?: string; tradeLicenseNo?: string; trn?: string }, exceptId?: string) {
  const eid = normalizeEid(input.emiratesId);
  const or = [eid && { emiratesId: eid }, input.tradeLicenseNo && { tradeLicenseNo: { equals: input.tradeLicenseNo, mode: "insensitive" as const } }, input.trn && { trn: input.trn }].filter(
    Boolean,
  ) as object[];
  if (!or.length) return;
  const dup = await prisma.client.findFirst({ where: { deletedAt: null, OR: or, ...(exceptId ? { id: { not: exceptId } } : {}) } });
  if (dup) throw new ActionError("clients.duplicate");
}

export const createClient = defineAction({ module: "clients", perm: "create", entity: "Client", schema: clientSchema }, async (input, { user }) => {
  await assertNoDuplicate(input);
  const client = await prisma.$transaction(async (tx) =>
    tx.client.create({ data: { ...input, emiratesId: normalizeEid(input.emiratesId), code: await nextNumber("client", tx), createdById: user.id } }),
  );
  return { id: client.id };
});

export const updateClient = defineAction({ module: "clients", perm: "update", entity: "Client", schema: clientSchema }, async (input, _c, id: string) => {
  await assertNoDuplicate(input, id);
  await prisma.client.update({ where: { id }, data: { ...input, emiratesId: normalizeEid(input.emiratesId) } });
  return { id };
});

export const deleteClient = defineAction({ module: "clients", perm: "delete", entity: "Client" }, async (_i, _c, id: string) => {
  const open = await prisma.matter.count({ where: { clientId: id, deletedAt: null, status: { not: "CLOSED" } } });
  if (open > 0) throw new ActionError("clients.hasOpenMatters");
  await prisma.client.update({ where: { id }, data: { deletedAt: new Date() } });
  return { id };
});

export const addContact = defineAction({ module: "clients", perm: "update", entity: "ClientContact", schema: contactSchema }, async (input, _c, clientId: string) => {
  const c = await prisma.clientContact.create({ data: { ...input, clientId } });
  return { id: c.id };
});

export const deleteContact = defineAction({ module: "clients", perm: "update", entity: "ClientContact" }, async (_i, _c, id: string) => {
  await prisma.clientContact.delete({ where: { id } });
  return { id };
});

/** Saves the PoA; an attached PDF is stored as a client document (category POWER_OF_ATTORNEY) and linked to it. */
export const addPoa = defineAction({ module: "clients", perm: "update", entity: "PowerOfAttorney", schema: poaSchema }, async ({ file, ...input }, { user }, clientId: string) => {
  const stored = file ? await putFile(file, "documents") : null;
  const t = await getTranslations("clients");
  const p = await prisma.$transaction(async (tx) => {
    const doc = stored
      ? await tx.document.create({
          data: {
            name: t("poaDocName", { number: input.number }),
            clientId,
            folder: "/" + t("poaFolder"),
            category: "POWER_OF_ATTORNEY",
            uploadedById: user.id,
            versions: { create: { version: 1, storageKey: stored.key, fileName: stored.fileName, mimeType: stored.mimeType, size: stored.size, uploadedById: user.id } },
          },
        })
      : null;
    return tx.powerOfAttorney.create({ data: { ...input, clientId, documentId: doc?.id } });
  });
  return { id: p.id, audit: { ...input, clientId, fileName: stored?.fileName } };
});

export const deletePoa = defineAction({ module: "clients", perm: "update", entity: "PowerOfAttorney" }, async (_i, _c, id: string) => {
  const now = new Date();
  const p = await prisma.powerOfAttorney.update({ where: { id }, data: { deletedAt: now } });
  if (p.documentId) await prisma.document.update({ where: { id: p.documentId }, data: { deletedAt: now } });
  return { id };
});

export const createParty = defineAction({ module: "clients", perm: "create", entity: "Party", schema: partySchema }, async (input) => {
  const p = await prisma.party.create({ data: input });
  return { id: p.id };
});

export const updateParty = defineAction({ module: "clients", perm: "update", entity: "Party", schema: partySchema }, async (input, _c, id: string) => {
  await prisma.party.update({ where: { id }, data: input });
  return { id };
});

export const deleteParty = defineAction({ module: "clients", perm: "delete", entity: "Party" }, async (_i, _c, id: string) => {
  await prisma.party.update({ where: { id }, data: { deletedAt: new Date() } });
  return { id };
});

/** Marks a PoA as checked against the original (or clears the mark); only verified PoAs can be linked to cases. */
export const setPoaVerified = defineAction({ module: "clients", perm: "update", entity: "PowerOfAttorney" }, async (input, { user }, id: string) => {
  const verified = (input as { verified?: boolean })?.verified === true;
  const p = await prisma.powerOfAttorney.findFirstOrThrow({ where: { id, deletedAt: null } });
  if (!verified && (await prisma.matterPoa.count({ where: { poaId: id } }))) throw new ActionError("clients.poaLinked");
  await prisma.powerOfAttorney.update({ where: { id }, data: { verified, verifiedAt: verified ? new Date() : null, verifiedById: verified ? user.id : null } });
  return { id, audit: { number: p.number, verified } };
});
