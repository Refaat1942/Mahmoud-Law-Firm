import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { can, requirePermission } from "@/lib/session";
import { localized } from "@/lib/utils";
import { ACTIONS, MODULES } from "@/lib/rbac";
import { EntityForm } from "@/components/entity-form";
import { ActionButton } from "@/components/action-button";
import { PageHeader, Section } from "@/components/page";
import { deleteRole, saveRolePermissions, updateRole } from "@/server/users/actions";
import { roleFields } from "../../role-fields";
import { PermissionMatrix } from "./permission-matrix";

export default async function RolePage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePermission("users");
  const { id } = await params;
  const t = await getTranslations();
  const locale = await getLocale();
  const role = await prisma.role.findUnique({ where: { id }, include: { permissions: true, _count: { select: { users: true } } } });
  if (!role) notFound();

  return (
    <>
      <PageHeader
        title={localized(role, locale)}
        subtitle={t("users.roleUsers", { count: role._count.users })}
        actions={
          can(me, "users", "delete") &&
          !role.isSystem && (
            <ActionButton variant="destructive" action={deleteRole.bind(null, id)} confirm={t("common.confirmDelete")} redirectTo="/users?tab=roles">
              {t("common.delete")}
            </ActionButton>
          )
        }
      />
      <div className="space-y-5">
        <Section title={t("common.details")}>
          <EntityForm
            fields={await roleFields()}
            schema="role"
            action={updateRole.bind(null, id)}
            defaultValues={{ key: role.key, nameAr: role.nameAr, nameEn: role.nameEn, scopeAll: role.scopeAll }}
          />
        </Section>
        <Section title={t("users.permissions")}>
          <PermissionMatrix
            modules={[...MODULES]}
            actions={[...ACTIONS]}
            initial={role.permissions.map((p) => `${p.module}:${p.action}`)}
            save={saveRolePermissions.bind(null, id)}
            readOnly={!can(me, "users", "update") || role.key === "client"}
          />
        </Section>
      </div>
    </>
  );
}
