import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/session";
import { EntityForm } from "@/components/entity-form";
import { PageHeader, Section } from "@/components/page";
import { createRole } from "@/server/users/actions";
import { roleFields } from "../../role-fields";

export default async function NewRolePage() {
  await requirePermission("users", "create");
  const t = await getTranslations();
  return (
    <>
      <PageHeader title={t("users.newRole")} />
      <Section>
        <EntityForm fields={await roleFields()} schema="role" action={createRole} redirectTo="/users/roles/:id" />
      </Section>
    </>
  );
}
