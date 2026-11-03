import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/session";
import { EntityForm } from "@/components/entity-form";
import { PageHeader, Section } from "@/components/page";
import { createUser } from "@/server/users/actions";
import { userFields } from "../fields";

export default async function NewUserPage() {
  await requirePermission("users", "create");
  const t = await getTranslations();
  return (
    <>
      <PageHeader title={t("users.new")} />
      <Section>
        <EntityForm fields={await userFields("create")} schema="userCreate" action={createUser} defaultValues={{ isActive: true }} redirectTo="/users/:id" />
      </Section>
    </>
  );
}
