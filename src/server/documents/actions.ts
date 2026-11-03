"use server";

import path from "node:path";
import { getTranslations } from "next-intl/server";
import { ActionError, defineAction } from "@/lib/action";
import { prisma } from "@/lib/prisma";
import { putFile } from "@/lib/storage";
import type { CurrentUser } from "@/lib/session";
import { assertMatterAccess, logEvent } from "../matters/access";
import { documentScope } from "./queries";
import { documentSchema, documentUploadSchema, versionSchema } from "./schema";

async function findDocument(user: CurrentUser, id: string) {
  const doc = await prisma.document.findFirst({ where: { AND: [documentScope(user), { id }] } });
  if (!doc) throw new ActionError("errors.notFound");
  return doc;
}

/** A case decides the client; folders are stored as "/a/b" without a trailing slash. */
async function normalize(user: CurrentUser, input: { matterId?: string; clientId?: string; folder: string }) {
  let clientId = input.clientId;
  if (input.matterId) {
    await assertMatterAccess(user, input.matterId);
    const m = await prisma.matter.findUniqueOrThrow({ where: { id: input.matterId }, select: { clientId: true } });
    clientId = m.clientId;
  }
  const folder = "/" + input.folder.split("/").map((s) => s.trim()).filter(Boolean).join("/");
  return { clientId, folder };
}

const baseName = (fileName: string) => path.basename(fileName, path.extname(fileName)).slice(0, 300) || fileName;

export const uploadDocument = defineAction(
  { module: "documents", perm: "create", entity: "Document", schema: documentUploadSchema },
  async ({ file, ...input }, { user }) => {
    const { clientId, folder } = await normalize(user, input);
    const stored = await putFile(file, "documents");
    const name = input.name ?? baseName(file.name);
    const t = await getTranslations("documents");
    const doc = await prisma.$transaction(async (tx) => {
      const created = await tx.document.create({
        data: {
          ...input,
          name,
          clientId,
          folder,
          uploadedById: user.id,
          versions: { create: { version: 1, storageKey: stored.key, fileName: stored.fileName, mimeType: stored.mimeType, size: stored.size, uploadedById: user.id } },
        },
      });
      if (input.matterId) await logEvent(tx, input.matterId, "document", t("events.uploaded", { name }), user.id);
      return created;
    });
    return { id: doc.id, audit: { ...input, name, clientId, folder, fileName: stored.fileName, size: stored.size } };
  },
);

export const uploadVersion = defineAction(
  { module: "documents", perm: "update", entity: "Document", schema: versionSchema },
  async ({ file }, { user }, id: string) => {
    const doc = await findDocument(user, id);
    if (doc.matterId) await assertMatterAccess(user, doc.matterId);
    const stored = await putFile(file, "documents");
    const version = doc.currentVersion + 1;
    const t = await getTranslations("documents");
    await prisma.$transaction(async (tx) => {
      await tx.documentVersion.create({
        data: { documentId: id, version, storageKey: stored.key, fileName: stored.fileName, mimeType: stored.mimeType, size: stored.size, uploadedById: user.id },
      });
      await tx.document.update({ where: { id }, data: { currentVersion: version } });
      if (doc.matterId) await logEvent(tx, doc.matterId, "document", t("events.newVersion", { name: doc.name, version }), user.id);
    });
    return { id, audit: { version, fileName: stored.fileName, size: stored.size } };
  },
);

export const updateDocument = defineAction({ module: "documents", perm: "update", entity: "Document", schema: documentSchema }, async (input, { user }, id: string) => {
  await findDocument(user, id);
  const { clientId, folder } = await normalize(user, input);
  await prisma.document.update({ where: { id }, data: { ...input, clientId, folder } });
  return { id };
});

/** Soft delete; stored files are kept so the record can be restored from the audit trail. */
export const deleteDocument = defineAction({ module: "documents", perm: "delete", entity: "Document" }, async (_i, { user }, id: string) => {
  const doc = await findDocument(user, id);
  if (doc.matterId) await assertMatterAccess(user, doc.matterId);
  await prisma.document.update({ where: { id }, data: { deletedAt: new Date() } });
  return { id };
});
