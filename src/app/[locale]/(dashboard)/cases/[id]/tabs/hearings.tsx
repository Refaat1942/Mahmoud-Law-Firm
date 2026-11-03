import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/session";
import { localized } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import type { TabProps } from "./types";

export async function HearingsTab({ matterId, user, locale }: TabProps) {
  const t = await getTranslations();
  const hearings = await prisma.hearing.findMany({ where: { matterId, deletedAt: null }, include: { court: true, lawyer: true }, orderBy: { date: "desc" } });
  return (
    <div className="space-y-3">
      {can(user, "hearings", "create") && (
        <Link href={`/hearings/new?matterId=${matterId}`} className={buttonVariants()}>
          <Plus /> {t("hearings.new")}
        </Link>
      )}
      <DataTable
        columns={[
          { key: "date", label: t("f.dateTime"), type: "datetime", href: "/hearings/:id" },
          { key: "court", label: t("f.court") },
          { key: "room", label: t("f.room") },
          { key: "lawyer", label: t("f.lawyer") },
          { key: "purpose", label: t("f.purpose") },
          { key: "decision", label: t("f.decision") },
          { key: "status", label: t("f.status"), type: "badge", enumKey: "HearingStatus" },
        ]}
        rows={hearings.map((h) => ({
          id: h.id,
          date: h.date.toISOString(),
          court: localized(h.court, locale),
          room: h.room ?? "",
          lawyer: localized(h.lawyer, locale),
          purpose: h.purpose ?? "",
          decision: h.decision ?? "",
          status: h.status,
        }))}
      />
    </div>
  );
}
