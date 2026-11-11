import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import { EntityForm } from "./entity-form";
import { Section } from "./page";
import { TwoFactorSetup } from "./two-factor-setup";
import { changePassword, updateNotificationPrefs, updateProfile } from "@/server/users/actions";
import { NOTIFICATION_TYPES } from "@/server/users/schema";

export async function ProfilePanel({ user }: { user: CurrentUser }) {
  const t = await getTranslations();
  const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Section title={t("profile.details")}>
        <EntityForm
          schema="profile"
          action={updateProfile}
          columns={1}
          defaultValues={{ nameAr: row.nameAr, nameEn: row.nameEn, phone: row.phone, locale: row.locale }}
          fields={[
            { name: "nameAr", label: t("f.nameAr"), required: true },
            { name: "nameEn", label: t("f.nameEn"), required: true, dir: "ltr" },
            { name: "phone", label: t("f.phone"), type: "tel" },
            {
              name: "locale",
              label: t("f.language"),
              type: "select",
              required: true,
              options: [
                { value: "ar", label: "العربية" },
                { value: "en", label: "English" },
              ],
              help: t("profile.languageHelp"),
            },
          ]}
        />
      </Section>
      <div className="space-y-5">
        <Section title={t("profile.notifications")}>
          <EntityForm
            schema="notificationPrefs"
            action={updateNotificationPrefs}
            columns={1}
            defaultValues={{ whatsapp: false, emailOff: [], ...((row.notificationPrefs ?? {}) as object) }}
            fields={[
              { name: "whatsapp", label: t("profile.whatsappOptIn"), type: "checkbox", help: t("profile.whatsappHelp") },
              { name: "emailOff", label: t("profile.emailOff"), type: "multiselect", options: NOTIFICATION_TYPES.map((v) => ({ value: v, label: t(`profile.types.${v}`) })), help: t("profile.emailOffHelp") },
            ]}
          />
        </Section>
        <Section title={t("profile.password")}>
          <EntityForm
            schema="passwordChange"
            action={changePassword}
            columns={1}
            resetOnSuccess
            fields={[
              { name: "current", label: t("f.currentPassword"), type: "password", required: true },
              { name: "next", label: t("f.newPassword"), type: "password", required: true },
              { name: "confirm", label: t("f.confirmPassword"), type: "password", required: true },
            ]}
          />
        </Section>
        <Section title={t("users.twoFactor")}>
          <TwoFactorSetup enabled={row.totpEnabled} />
        </Section>
      </div>
    </div>
  );
}
