import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { can, requirePermission } from "@/lib/session";
import { plain } from "@/lib/plain";
import { EntityForm } from "@/components/entity-form";
import { ActionButton } from "@/components/action-button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Section } from "@/components/page";
import { deleteUser, resetTotp, unlockUser, updateUser } from "@/server/users/actions";
import { userFields } from "../fields";

export default async function UserPage({ params }: { params: Promise<{ id: string; locale: string }> }) {
  const me = await requirePermission("users");
  const { id, locale } = await params;
  const t = await getTranslations();
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!user) notFound();
  const locked = user.lockedUntil && user.lockedUntil > new Date();

  return (
    <>
      <PageHeader
        title={locale === "en" ? user.nameEn : user.nameAr}
        subtitle={
          <span className="flex gap-2">
            {user.email}
            {locked && <Badge tone="danger">{t("users.locked")}</Badge>}
            {user.totpEnabled && <Badge tone="success">{t("users.twoFactor")}</Badge>}
          </span>
        }
        actions={
          can(me, "users", "update") && (
            <>
              {locked && (
                <ActionButton variant="outline" action={unlockUser.bind(null, id)}>
                  {t("users.unlock")}
                </ActionButton>
              )}
              {user.totpEnabled && (
                <ActionButton variant="outline" action={resetTotp.bind(null, id)} confirm={t("common.confirm")}>
                  {t("users.resetTwoFactor")}
                </ActionButton>
              )}
              {can(me, "users", "delete") && me.id !== id && (
                <ActionButton variant="destructive" action={deleteUser.bind(null, id)} confirm={t("common.confirmDelete")} redirectTo="/users">
                  {t("common.delete")}
                </ActionButton>
              )}
            </>
          )
        }
      />
      <Section>
        <EntityForm fields={await userFields("update")} schema="userUpdate" action={updateUser.bind(null, id)} defaultValues={plain({
            nameAr: user.nameAr,
            nameEn: user.nameEn,
            email: user.email,
            phone: user.phone,
            roleId: user.roleId,
            clientId: user.clientId,
            isActive: user.isActive,
          })}
        />
      </Section>
    </>
  );
}
