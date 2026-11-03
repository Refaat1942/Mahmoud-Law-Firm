import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { localizedTitle } from "@/lib/utils";
import { EntityForm } from "@/components/entity-form";
import { MessageThread } from "@/components/message-thread";
import { PageHeader, Section } from "@/components/page";
import { sendClientMessage } from "@/server/portal/actions";

export default async function PortalMessagesPage() {
  const user = await requireUser();
  const t = await getTranslations();
  const locale = await getLocale();
  const clientId = user.clientId!;
  const matters = await prisma.matter.findMany({ where: { clientId, deletedAt: null }, orderBy: { openedAt: "desc" } });
  await prisma.notification.updateMany({ where: { userId: user.id, type: "message", readAt: null }, data: { readAt: new Date() } });
  return (
    <>
      <PageHeader title={t("portal.messages")} subtitle={t("portal.messagesHelp")} />
      <div className="grid gap-5 lg:grid-cols-3">
        <Section className="lg:col-span-2">
          <MessageThread clientId={clientId} side="client" />
        </Section>
        <Section title={t("portal.newMessage")}>
          <EntityForm
            schema="message"
            action={sendClientMessage}
            columns={1}
            resetOnSuccess
            submitLabel={t("portal.send")}
            fields={[
              { name: "matterId", label: t("f.matter"), type: "select", options: matters.map((m) => ({ value: m.id, label: `${m.fileNo} — ${localizedTitle(m, locale)}` })), placeholder: t("portal.general") },
              { name: "body", label: t("f.message"), type: "textarea", required: true },
            ]}
          />
        </Section>
      </div>
    </>
  );
}
