import { getTranslations } from "next-intl/server";
import { SearchCheck } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { EntityForm } from "@/components/entity-form";
import { PageHeader, Section } from "@/components/page";
import { createClient } from "@/server/clients/actions";
import { clientFields } from "../fields";

export default async function NewClientPage() {
  await requirePermission("clients", "create");
  const t = await getTranslations();
  return (
    <>
      <PageHeader
        title={t("clients.new")}
        subtitle={t("clients.conflictReminder")}
        actions={
          <Link href="/clients/conflict-check" className={buttonVariants({ variant: "outline" })}>
            <SearchCheck /> {t("clients.conflictCheck")}
          </Link>
        }
      />
      <Section>
        <EntityForm fields={await clientFields()} schema="client" action={createClient} defaultValues={{ type: "INDIVIDUAL" }} redirectTo="/clients/:id" />
      </Section>
    </>
  );
}
