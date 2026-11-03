import { getTranslations } from "next-intl/server";
import { requireStaff } from "@/lib/session";
import { PageHeader } from "@/components/page";
import { ProfilePanel } from "@/components/profile-panel";

export default async function ProfilePage() {
  const user = await requireStaff();
  const t = await getTranslations();
  return (
    <>
      <PageHeader title={t("profile.title")} subtitle={user.email} />
      <ProfilePanel user={user} />
    </>
  );
}
