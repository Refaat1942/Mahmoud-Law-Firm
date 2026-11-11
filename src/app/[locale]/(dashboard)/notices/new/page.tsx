import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/session";
import { EntityForm } from "@/components/entity-form";
import { PageHeader, Section } from "@/components/page";
import { createNotice } from "@/server/notices/actions";
import { noticeFields } from "../fields";

export default async function NewNoticePage({ searchParams }: { searchParams: Promise<{ matterId?: string; clientId?: string }> }) {
  const user = await requirePermission("matters", "create");
  const t = await getTranslations();
  const sp = await searchParams;
  return (
    <>
      <PageHeader title={t("notices.new")} />
      <Section>
        <EntityForm
          fields={await noticeFields(user)}
          schema="notice"
          action={createNotice}
          defaultValues={{ direction: "OUTGOING", status: "DRAFT", method: "NOTARY", matterId: sp.matterId, clientId: sp.clientId, assigneeId: user.id }}
          redirectTo="/notices/:id"
        />
      </Section>
    </>
  );
}
