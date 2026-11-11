"use server";

import { getTranslations } from "next-intl/server";
import { ActionError, defineAction } from "@/lib/action";
import { prisma } from "@/lib/prisma";
import { nextNumber } from "@/lib/sequence";
import { startOfDay } from "@/lib/utils";
import { assertMatterAccess, logEvent } from "./access";
import { eventSchema, feeAgreementSchema, installmentSchema, matterPartySchema, matterSchema, memberSchema, poaLinkSchema } from "./schema";

export const createMatter = defineAction({ module: "matters", perm: "create", entity: "Matter", schema: matterSchema }, async (input, { user }) => {
  const t = await getTranslations("cases.events");
  const responsibleId = input.responsibleId ?? user.id;
  const matter = await prisma.$transaction(async (tx) => {
    const m = await tx.matter.create({
      data: { ...input, responsibleId, fileNo: await nextNumber("matter", tx), createdById: user.id },
    });
    await tx.matterMember.create({ data: { matterId: m.id, userId: responsibleId, role: "LEAD" } });
    await logEvent(tx, m.id, "created", t("created"), user.id);
    return m;
  });
  return { id: matter.id };
});

export const updateMatter = defineAction({ module: "matters", perm: "update", entity: "Matter", schema: matterSchema }, async (input, { user }, id: string) => {
  await assertMatterAccess(user, id);
  const t = await getTranslations();
  const before = await prisma.matter.findUniqueOrThrow({ where: { id } });
  await prisma.$transaction(async (tx) => {
    const closedAt = input.status === "CLOSED" ? (input.closedAt ?? before.closedAt ?? new Date()) : null;
    await tx.matter.update({ where: { id }, data: { ...input, outcome: input.outcome ?? null, closedAt } });
    if (before.status !== input.status) {
      await logEvent(tx, id, "status", t("cases.events.status", { status: t(`enum.MatterStatus.${input.status}`) }), user.id);
    }
    if (before.level !== input.level) {
      await logEvent(tx, id, "level", t("cases.events.level", { level: t(`enum.MatterLevel.${input.level}`) }), user.id);
    }
    if (input.responsibleId && before.responsibleId !== input.responsibleId) {
      await tx.matterMember.upsert({
        where: { matterId_userId: { matterId: id, userId: input.responsibleId } },
        create: { matterId: id, userId: input.responsibleId, role: "LEAD" },
        update: { role: "LEAD" },
      });
    }
  });
  return { id };
});

export const deleteMatter = defineAction({ module: "matters", perm: "delete", entity: "Matter" }, async (_i, { user }, id: string) => {
  await assertMatterAccess(user, id);
  await prisma.matter.update({ where: { id }, data: { deletedAt: new Date() } });
  return { id };
});

export const addMatterParty = defineAction(
  { module: "matters", perm: "update", entity: "MatterParty", schema: matterPartySchema },
  async (input, { user }, matterId: string) => {
    await assertMatterAccess(user, matterId);
    const t = await getTranslations();
    const mp = await prisma.$transaction(async (tx) => {
      const partyId = input.partyId ?? (await tx.party.create({ data: { nameAr: input.newPartyName! } })).id;
      const created = await tx.matterParty.create({ data: { matterId, partyId, role: input.role, notes: input.notes }, include: { party: true } });
      await logEvent(tx, matterId, "party", t("cases.events.party", { name: created.party.nameAr, role: t(`enum.MatterPartyRole.${input.role}`) }), user.id);
      return created;
    });
    return { id: mp.id };
  },
);

export const removeMatterParty = defineAction({ module: "matters", perm: "update", entity: "MatterParty" }, async (_i, { user }, id: string) => {
  const mp = await prisma.matterParty.findUniqueOrThrow({ where: { id } });
  await assertMatterAccess(user, mp.matterId);
  await prisma.matterParty.delete({ where: { id } });
  return { id };
});

export const addMember = defineAction({ module: "matters", perm: "update", entity: "MatterMember", schema: memberSchema }, async (input, { user }, matterId: string) => {
  await assertMatterAccess(user, matterId);
  const m = await prisma.matterMember.upsert({
    where: { matterId_userId: { matterId, userId: input.userId } },
    create: { matterId, ...input },
    update: { role: input.role },
  });
  return { id: m.id };
});

export const removeMember = defineAction({ module: "matters", perm: "update", entity: "MatterMember" }, async (_i, { user }, id: string) => {
  const m = await prisma.matterMember.findUniqueOrThrow({ where: { id } });
  await assertMatterAccess(user, m.matterId);
  await prisma.matterMember.delete({ where: { id } });
  return { id };
});

export const addEvent = defineAction({ module: "matters", perm: "update", entity: "MatterEvent", schema: eventSchema }, async (input, { user }, matterId: string) => {
  await assertMatterAccess(user, matterId);
  await logEvent(prisma, matterId, "note", input.title, user.id, input.details);
  return { id: matterId };
});

export const saveFeeAgreement = defineAction(
  { module: "matters", perm: "update", entity: "FeeAgreement", schema: feeAgreementSchema },
  async (input, { user }, matterId: string) => {
    await assertMatterAccess(user, matterId);
    const fa = await prisma.feeAgreement.upsert({ where: { matterId }, create: { matterId, ...input }, update: input });
    return { id: fa.id };
  },
);

export const addInstallment = defineAction(
  { module: "matters", perm: "update", entity: "FeeInstallment", schema: installmentSchema },
  async (input, { user }, agreementId: string) => {
    const fa = await prisma.feeAgreement.findUniqueOrThrow({ where: { id: agreementId } });
    await assertMatterAccess(user, fa.matterId);
    const i = await prisma.feeInstallment.create({ data: { agreementId, ...input } });
    return { id: i.id };
  },
);

export const deleteInstallment = defineAction({ module: "matters", perm: "update", entity: "FeeInstallment" }, async (_i, { user }, id: string) => {
  const inst = await prisma.feeInstallment.findUniqueOrThrow({ where: { id }, include: { agreement: true } });
  await assertMatterAccess(user, inst.agreement.matterId);
  if (!inst.invoiceId) await prisma.feeInstallment.delete({ where: { id } });
  return { id };
});

/** Links a verified, unexpired PoA of the same client to the case. */
export const linkPoa = defineAction({ module: "matters", perm: "update", entity: "MatterPoa", schema: poaLinkSchema }, async ({ poaId }, { user }, matterId: string) => {
  await assertMatterAccess(user, matterId);
  const [m, p] = await Promise.all([
    prisma.matter.findUniqueOrThrow({ where: { id: matterId } }),
    prisma.powerOfAttorney.findFirst({ where: { id: poaId, deletedAt: null } }),
  ]);
  if (!p || p.clientId !== m.clientId) throw new ActionError("cases.poaOtherClient");
  if (!p.verified) throw new ActionError("cases.poaUnverified");
  if (p.expiresAt && p.expiresAt < startOfDay()) throw new ActionError("cases.poaExpired");
  const t = await getTranslations("cases");
  await prisma.$transaction(async (tx) => {
    await tx.matterPoa.create({ data: { matterId, poaId, linkedById: user.id } });
    await logEvent(tx, matterId, "poa", t("events.poaLinked", { number: p.number }), user.id);
  });
  return { id: matterId, audit: { poaId, number: p.number } };
});

export const unlinkPoa = defineAction({ module: "matters", perm: "update", entity: "MatterPoa" }, async (_i, { user }, matterId: string, poaId: string) => {
  await assertMatterAccess(user, matterId);
  await prisma.matterPoa.delete({ where: { matterId_poaId: { matterId, poaId } } });
  return { id: matterId, audit: { poaId } };
});
