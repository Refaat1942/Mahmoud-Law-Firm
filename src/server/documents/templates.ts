"use server";

import { getTranslations } from "next-intl/server";
import { ActionError, defineAction } from "@/lib/action";
import { prisma } from "@/lib/prisma";
import { putFile } from "@/lib/storage";
import { getOffice } from "@/lib/settings";
import { renderTemplate } from "@/lib/templates";
import { renderLetterDocx } from "@/lib/docx";
import { renderLetterPdf } from "@/lib/pdf/letter";
import { loadLogo } from "@/lib/pdf/base";
import { assertMatterAccess, logEvent } from "../matters/access";
import { generateSchema, templateSchema } from "./schema";

export const createTemplate = defineAction({ module: "documents", perm: "create", entity: "Template", schema: templateSchema }, async (input) => {
  const tpl = await prisma.template.create({ data: input });
  return { id: tpl.id };
});

export const updateTemplate = defineAction({ module: "documents", perm: "update", entity: "Template", schema: templateSchema }, async (input, _c, id: string) => {
  await prisma.template.update({ where: { id }, data: input });
  return { id };
});

export const deleteTemplate = defineAction({ module: "documents", perm: "delete", entity: "Template" }, async (_i, _c, id: string) => {
  await prisma.template.update({ where: { id }, data: { deletedAt: new Date() } });
  return { id };
});

/** Values for the {{placeholders}} of a template, in the template's language. */
async function templateVars(matterId: string, language: string) {
  const en = language === "en";
  const pick = (r: { nameAr: string; nameEn?: string | null } | null | undefined) => (r ? (en ? r.nameEn || r.nameAr : r.nameAr) : "");
  const [office, m] = await Promise.all([
    getOffice(),
    prisma.matter.findUniqueOrThrow({
      where: { id: matterId },
      include: { client: true, court: true, type: true, responsible: true, parties: { where: { role: "OPPONENT" }, include: { party: true } } },
    }),
  ]);
  return {
    office: { name: en ? office.nameEn : office.nameAr, trn: office.trn, address: en ? office.addressEn : office.addressAr },
    client: { name: pick(m.client), code: m.client.code, emiratesId: m.client.emiratesId ?? "", address: m.client.address ?? "", phone: m.client.mobile || m.client.phone || "" },
    case: { number: m.courtCaseNo ?? "", fileNo: m.fileNo, title: en ? m.titleEn || m.titleAr : m.titleAr, court: pick(m.court), type: pick(m.type) },
    opponent: { name: m.parties.map((p) => pick(p.party)).join(en ? ", " : "، ") },
    lawyer: { name: pick(m.responsible) },
    // DD/MM/YYYY: the usual format in the UAE, and it keeps its order inside Arabic PDFs.
    today: new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date()),
  };
}

/** Fills the template from the case and saves the result (PDF or Word) as a document of the case. */
export const generateDocument = defineAction({ module: "documents", perm: "create", entity: "Document", schema: generateSchema }, async (input, { user }, templateId: string) => {
  await assertMatterAccess(user, input.matterId);
  const tpl = await prisma.template.findFirst({ where: { id: templateId, deletedAt: null } });
  if (!tpl) throw new ActionError("errors.notFound");
  const vars = await templateVars(input.matterId, tpl.language);
  const body = renderTemplate(tpl.body, vars);
  const office = await getOffice();
  const rtl = tpl.language !== "en";
  const buffer =
    input.format === "pdf"
      ? await renderLetterPdf({ office, locale: tpl.language, title: tpl.name, body, logo: await loadLogo(office) })
      : await renderLetterDocx({
          officeName: rtl ? office.nameAr : office.nameEn,
          officeLine: [rtl ? office.addressAr : office.addressEn, office.phone, office.trn && `TRN ${office.trn}`].filter(Boolean).join("  |  "),
          title: tpl.name,
          body,
          rtl,
        });
  const ext = input.format === "pdf" ? "pdf" : "docx";
  const mime = input.format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const fileName = `${tpl.name} - ${vars.case.fileNo}.${ext}`;
  const stored = await putFile(new File([new Uint8Array(buffer)], fileName, { type: mime }), "documents");
  const matter = await prisma.matter.findUniqueOrThrow({ where: { id: input.matterId }, select: { clientId: true } });
  const t = await getTranslations("documents");
  const doc = await prisma.$transaction(async (tx) => {
    const created = await tx.document.create({
      data: {
        name: `${tpl.name} — ${vars.case.fileNo}`,
        matterId: input.matterId,
        clientId: matter.clientId,
        folder: "/",
        category: tpl.category,
        uploadedById: user.id,
        versions: { create: { version: 1, storageKey: stored.key, fileName, mimeType: mime, size: stored.size, uploadedById: user.id } },
      },
    });
    await logEvent(tx, input.matterId, "document", t("events.generated", { name: tpl.name }), user.id, input.note);
    return created;
  });
  return { id: doc.id, audit: { templateId, format: input.format } };
});
