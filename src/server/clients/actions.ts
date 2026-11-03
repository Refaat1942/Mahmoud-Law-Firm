"use server";

import { ActionError, defineAction } from "@/lib/action";
import { prisma } from "@/lib/prisma";
import { nextNumber } from "@/lib/sequence";
import { clientSchema, contactSchema, partySchema, poaSchema } from "./schema";

const normalizeEid = (v?: string) => (v ? v.replace(/^(784)-?(\d{4})-?(\d{7})-?(\d)$/, "$1-$2-$3-$4") : v);

export const createClient = defineAction({ module: "clients", perm: "create", entity: "Client", schema: clientSchema }, async (input, { user }) => {
  const client = await prisma.$transaction(async (tx) =>
    tx.client.create({ data: { ...input, emiratesId: normalizeEid(input.emiratesId), code: await nextNumber("client", tx), createdById: user.id } }),
  );
  return { id: client.id };
});

export const updateClient = defineAction({ module: "clients", perm: "update", entity: "Client", schema: clientSchema }, async (input, _c, id: string) => {
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

export const addPoa = defineAction({ module: "clients", perm: "update", entity: "PowerOfAttorney", schema: poaSchema }, async (input, _c, clientId: string) => {
  const p = await prisma.powerOfAttorney.create({ data: { ...input, clientId } });
  return { id: p.id };
});

export const deletePoa = defineAction({ module: "clients", perm: "update", entity: "PowerOfAttorney" }, async (_i, _c, id: string) => {
  await prisma.powerOfAttorney.update({ where: { id }, data: { deletedAt: new Date() } });
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
