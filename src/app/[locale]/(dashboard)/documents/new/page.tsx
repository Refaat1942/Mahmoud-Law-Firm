import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/session";
import { EntityForm } from "@/components/entity-form";
import { PageHeader, Section } from "@/components/page";
import { uploadDocument } from "@/server/documents/actions";
import { documentFields } from "../fields";

export default async function NewDocumentPage({ searchParams }: { searchParams: Promise<{ matterId?: string; clientId?: string; folder?: string }> }) {
  const user = await requirePermission("documents", "create");
  const t = await getTranslations();
  const sp = await searchParams;
  return (
    <>
      <PageHeader title={t("documents.upload")} />
      <Section>
        <EntityForm
          fields={await documentFields(user, { upload: true })}
          schema="documentUpload"
          action={uploadDocument}
          defaultValues={{ matterId: sp.matterId, clientId: sp.clientId, folder: sp.folder ?? "/", category: "OTHER", visibleToClient: false }}
          submitLabel={t("common.upload")}
          redirectTo="/documents/:id"
        />
      </Section>
    </>
  );
}
