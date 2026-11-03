import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Download, Eye, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { plain } from "@/lib/plain";
import { can, requirePermission } from "@/lib/session";
import { localized, localizedTitle } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ActionButton } from "@/components/action-button";
import { EntityForm } from "@/components/entity-form";
import { DateText } from "@/components/format";
import { DetailList, PageHeader, Section } from "@/components/page";
import { deleteDocument, updateDocument, uploadVersion } from "@/server/documents/actions";
import { canPreview, documentScope } from "@/server/documents/queries";
import { documentFields } from "../fields";

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("documents");
  const { id } = await params;
  const t = await getTranslations();
  const locale = await getLocale();
  const doc = await prisma.document.findFirst({
    where: { AND: [documentScope(user), { id }] },
    include: { matter: true, client: true, versions: { include: { uploadedBy: true }, orderBy: { version: "desc" } } },
  });
  if (!doc) notFound();
  const current = doc.versions[0];
  const canEdit = can(user, "documents", "update");
  const fileUrl = (versionId: string, inline = false) => `/api/documents/${versionId}${inline ? "?inline=1" : ""}`;

  return (
    <>
      <PageHeader
        title={doc.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{t(`enum.DocumentCategory.${doc.category}`)}</Badge>
            <span dir="ltr">{doc.folder}</span>
            {doc.visibleToClient && <Badge tone="info">{t("f.visibleToClient")}</Badge>}
            {doc.tags.map((tag) => (
              <Badge key={tag} tone="neutral">
                {tag}
              </Badge>
            ))}
          </span>
        }
        actions={
          <>
            {current && canPreview(current.mimeType) && (
              <a href={fileUrl(current.id, true)} target="_blank" rel="noopener" className={buttonVariants({ variant: "outline" })}>
                <Eye /> {t("documents.preview")}
              </a>
            )}
            {current && (
              <a href={fileUrl(current.id)} className={buttonVariants()}>
                <Download /> {t("common.download")}
              </a>
            )}
            {can(user, "documents", "delete") && (
              <ActionButton variant="destructive" action={deleteDocument.bind(null, id)} confirm={t("common.confirmDelete")} redirectTo="/documents">
                <Trash2 /> {t("common.delete")}
              </ActionButton>
            )}
          </>
        }
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <Section title={t("common.details")}>
            <DetailList
              columns={2}
              items={[
                {
                  label: t("f.matter"),
                  value: doc.matter && (
                    <Link href={`/cases/${doc.matter.id}?tab=documents`} className="text-primary hover:underline dark:text-accent">
                      {doc.matter.fileNo} — {localizedTitle(doc.matter, locale)}
                    </Link>
                  ),
                },
                {
                  label: t("f.client"),
                  value: doc.client && (
                    <Link href={`/clients/${doc.client.id}`} className="text-primary hover:underline dark:text-accent">
                      {localized(doc.client, locale)}
                    </Link>
                  ),
                },
                { label: t("documents.fileName"), value: current && <span dir="ltr">{current.fileName}</span> },
                { label: t("documents.size"), value: current && <span dir="ltr">{fileSize(current.size)}</span> },
                { label: t("documents.version"), value: doc.currentVersion },
                { label: t("documents.updatedAt"), value: <DateText value={doc.updatedAt} withTime /> },
              ]}
            />
          </Section>

          <Section title={t("documents.versions")}>
            <ul className="divide-y">
              {doc.versions.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {t("documents.versionN", { n: v.version })}
                      {v.version === doc.currentVersion && (
                        <Badge tone="success" className="ms-2">
                          {t("documents.current")}
                        </Badge>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      <span dir="ltr">{v.fileName}</span> · <span dir="ltr">{fileSize(v.size)}</span> · {localized(v.uploadedBy, locale)} ·{" "}
                      <DateText value={v.createdAt} withTime />
                    </p>
                  </div>
                  <a href={fileUrl(v.id)} className={buttonVariants({ variant: "ghost", size: "sm" })} aria-label={t("common.download")}>
                    <Download />
                  </a>
                </li>
              ))}
            </ul>
            {canEdit && (
              <div className="mt-4 border-t pt-4">
                <EntityForm
                  schema="documentVersion"
                  action={uploadVersion.bind(null, id)}
                  fields={[{ name: "file", label: t("documents.newVersion"), type: "file", required: true, help: t("documents.maxSize") }]}
                  submitLabel={t("documents.uploadVersion")}
                  columns={1}
                  resetOnSuccess
                />
              </div>
            )}
          </Section>
        </div>
        {canEdit && (
          <Section title={t("common.edit")}>
            <EntityForm fields={await documentFields(user, { upload: false })} schema="document" action={updateDocument.bind(null, id)} defaultValues={plain(doc)} />
          </Section>
        )}
      </div>
    </>
  );
}
