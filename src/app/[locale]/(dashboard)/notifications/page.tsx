import { getTranslations } from "next-intl/server";
import { requireStaff } from "@/lib/session";
import { PageHeader } from "@/components/page";
import { NotificationsList } from "@/components/notifications-list";

export default async function NotificationsPage() {
  const user = await requireStaff();
  const t = await getTranslations();
  return (
    <>
      <PageHeader title={t("notifications.title")} />
      <NotificationsList userId={user.id} />
    </>
  );
}
