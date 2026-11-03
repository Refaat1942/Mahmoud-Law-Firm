import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/session";
import { localized } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { StatCard } from "@/components/page";
import type { TabProps } from "./types";

export async function TimeTab({ matterId, user, locale }: TabProps) {
  const t = await getTranslations();
  const entries = await prisma.timeEntry.findMany({
    where: { matterId, deletedAt: null, ...(can(user, "time", "approve") ? {} : { userId: user.id }) },
    include: { user: true },
    orderBy: { date: "desc" },
  });
  const total = entries.reduce((a, e) => a + e.minutes, 0);
  const billable = entries.filter((e) => e.billable).reduce((a, e) => a + e.minutes, 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-4">
        <div className="grid flex-1 grid-cols-2 gap-4 md:max-w-md">
          <StatCard label={t("time.totalHours")} value={(total / 60).toFixed(2)} />
          <StatCard label={t("time.billableHours")} value={(billable / 60).toFixed(2)} />
        </div>
        {can(user, "time", "create") && (
          <Link href={`/time/new?matterId=${matterId}`} className={buttonVariants()}>
            <Plus /> {t("time.new")}
          </Link>
        )}
      </div>
      <DataTable
        columns={[
          { key: "date", label: t("f.date"), type: "date" },
          { key: "user", label: t("f.lawyer") },
          { key: "description", label: t("f.description") },
          { key: "minutes", label: t("f.hours"), type: "hours" },
          { key: "billable", label: t("f.billable"), type: "bool" },
          { key: "amount", label: t("f.amount"), type: "money" },
          { key: "status", label: t("f.status"), type: "badge", enumKey: "TimeStatus" },
        ]}
        rows={entries.map((e) => ({
          id: e.id,
          date: e.date.toISOString(),
          user: localized(e.user, locale),
          description: e.description,
          minutes: e.minutes,
          billable: e.billable,
          amount: e.billable ? e.rate.times(e.minutes).dividedBy(60).toFixed(2) : "0",
          status: e.status,
        }))}
      />
    </div>
  );
}
