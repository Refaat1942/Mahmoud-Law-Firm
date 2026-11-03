"use server";

import { ActionError, defineAction } from "@/lib/action";
import { prisma } from "@/lib/prisma";
import { putFile } from "@/lib/storage";
import { DEFAULT_EMAIL_TEMPLATES, getDeadlinePresets, getEmailTemplates, getOffice, setSetting } from "@/lib/settings";
import { courtSchema, emailTemplateSchema, holidaySchema, logoSchema, matterTypeSchema, officeSchema, presetSchema, sequenceSchema } from "./schema";

export const saveOffice = defineAction({ module: "settings", perm: "update", entity: "Setting", schema: officeSchema }, async (input) => {
  const office = await getOffice();
  await setSetting("office", { ...office, ...input, trn: input.trn ?? "", addressAr: input.addressAr ?? "", addressEn: input.addressEn ?? "", phone: input.phone ?? "", email: input.email ?? "", wpsEmployerId: input.wpsEmployerId ?? "", wpsBankCode: input.wpsBankCode ?? "" });
  return { id: "office" };
});

/** Stores the logo used on PDF letterheads. */
export const uploadLogo = defineAction({ module: "settings", perm: "update", entity: "Setting", schema: logoSchema }, async ({ file }) => {
  const stored = await putFile(file, "logos");
  await setSetting("office", { ...(await getOffice()), logoKey: stored.key });
  return { id: "office", audit: { logo: stored.fileName } };
});

export const removeLogo = defineAction({ module: "settings", perm: "update", entity: "Setting" }, async () => {
  await setSetting("office", { ...(await getOffice()), logoKey: null });
  return { id: "office" };
});

export const createCourt = defineAction({ module: "settings", perm: "create", entity: "Court", schema: courtSchema }, async (input) => {
  const c = await prisma.court.create({ data: input });
  return { id: c.id };
});

export const updateCourt = defineAction({ module: "settings", perm: "update", entity: "Court", schema: courtSchema }, async (input, _c, id: string) => {
  await prisma.court.update({ where: { id }, data: { ...input, emirate: input.emirate ?? null } });
  return { id };
});

export const createMatterType = defineAction({ module: "settings", perm: "create", entity: "MatterType", schema: matterTypeSchema }, async (input) => {
  const m = await prisma.matterType.create({ data: input });
  return { id: m.id };
});

export const updateMatterType = defineAction({ module: "settings", perm: "update", entity: "MatterType", schema: matterTypeSchema }, async (input, _c, id: string) => {
  await prisma.matterType.update({ where: { id }, data: input });
  return { id };
});

export const addHoliday = defineAction({ module: "settings", perm: "create", entity: "Holiday", schema: holidaySchema }, async (input) => {
  const h = await prisma.holiday.create({ data: input });
  return { id: h.id };
});

export const deleteHoliday = defineAction({ module: "settings", perm: "delete", entity: "Holiday" }, async (_i, _c, id: string) => {
  await prisma.holiday.delete({ where: { id } });
  return { id };
});

/** Changing the next number never goes below a number already used in the current year. */
export const updateSequence = defineAction({ module: "settings", perm: "update", entity: "Sequence", schema: sequenceSchema }, async (input, _c, key: string) => {
  const seq = await prisma.sequence.findUnique({ where: { key } });
  if (seq && input.next < seq.next && seq.year === new Date().getFullYear()) throw new ActionError("settings.sequenceBackwards");
  await prisma.sequence.upsert({ where: { key }, create: { key, ...input, year: new Date().getFullYear() }, update: input });
  return { id: key };
});

export const savePreset = defineAction({ module: "settings", perm: "update", entity: "Setting", schema: presetSchema }, async (input) => {
  const presets = await getDeadlinePresets();
  const next = presets.some((p) => p.key === input.key) ? presets.map((p) => (p.key === input.key ? input : p)) : [...presets, input];
  await setSetting("deadlinePresets", next);
  return { id: input.key };
});

export const deletePreset = defineAction({ module: "settings", perm: "update", entity: "Setting" }, async (_i, _c, key: string) => {
  await setSetting("deadlinePresets", (await getDeadlinePresets()).filter((p) => p.key !== key));
  return { id: key };
});

export const saveEmailTemplate = defineAction({ module: "settings", perm: "update", entity: "Setting", schema: emailTemplateSchema }, async (input, _c, key: string) => {
  if (!(key in DEFAULT_EMAIL_TEMPLATES)) throw new ActionError("errors.notFound");
  await setSetting("emailTemplates", { ...(await getEmailTemplates()), [key]: input });
  return { id: key };
});
