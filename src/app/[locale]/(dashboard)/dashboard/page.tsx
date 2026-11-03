import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/session";
import { PageHeader } from "@/components/page";

export default async function DashboardPage() {
  await requirePermission("dashboard");
  const t = await getTranslations();
  return <PageHeader title={t("nav.dashboard")} />;
}
