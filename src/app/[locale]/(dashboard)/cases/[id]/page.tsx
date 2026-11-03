import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { GitBranchPlus, Pencil, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can, matterScope, requirePermission } from "@/lib/session";
import { localized, localizedTitle } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { Badge, STATUS_TONES } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ActionButton } from "@/components/action-button";
import { PageHeader, Tabs } from "@/components/page";
import { deleteMatter } from "@/server/matters/actions";
import { OverviewTab } from "./tabs/overview";
import { PartiesTab } from "./tabs/parties";
import { TeamTab } from "./tabs/team";
import { HearingsTab } from "./tabs/hearings";
import { DeadlinesTab } from "./tabs/deadlines";
import { TasksTab } from "./tabs/tasks";
import { DocumentsTab } from "./tabs/documents";
import { TimeTab } from "./tabs/time";
import { FeesTab } from "./tabs/fees";
import { FinanceTab } from "./tabs/finance";

export default async function CasePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const user = await requirePermission("matters");
  const { id } = await params;
  const tab = (await searchParams).tab ?? "overview";
  const t = await getTranslations();
  const locale = await getLocale();
  const matter = await prisma.matter.findFirst({
    where: { AND: [matterScope(user), { id }] },
    include: { client: true, court: true, type: true, responsible: true, parent: true, children: { where: { deletedAt: null } } },
  });
  if (!matter) notFound();
  const canEdit = can(user, "matters", "update");

  const tabs = [
    { key: "overview", label: t("common.overview") },
    { key: "parties", label: t("cases.parties") },
    { key: "team", label: t("cases.team") },
    ...(can(user, "hearings") ? [{ key: "hearings", label: t("nav.hearings") }, { key: "deadlines", label: t("cases.deadlines") }] : []),
    ...(can(user, "tasks") ? [{ key: "tasks", label: t("nav.tasks") }] : []),
    ...(can(user, "documents") ? [{ key: "documents", label: t("nav.documents") }] : []),
    ...(can(user, "time") ? [{ key: "time", label: t("nav.time") }] : []),
    { key: "fees", label: t("cases.fees") },
    ...(can(user, "billing") ? [{ key: "finance", label: t("cases.finance") }] : []),
  ];

  const props = { matterId: id, user, canEdit, locale };
  const content =
    {
      parties: <PartiesTab {...props} />,
      team: <TeamTab {...props} />,
      hearings: <HearingsTab {...props} />,
      deadlines: <DeadlinesTab {...props} />,
      tasks: <TasksTab {...props} />,
      documents: <DocumentsTab {...props} />,
      time: <TimeTab {...props} />,
      fees: <FeesTab {...props} />,
      finance: <FinanceTab {...props} />,
    }[tab] ?? <OverviewTab {...props} matter={matter} />;

  return (
    <>
      <PageHeader
        title={localizedTitle(matter, locale)}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>{matter.fileNo}</span>
            {matter.courtCaseNo && <span dir="ltr">· {matter.courtCaseNo}</span>}
            <span>·</span>
            <Link href={`/clients/${matter.clientId}`} className="text-primary hover:underline dark:text-accent">
              {localized(matter.client, locale)}
            </Link>
            <Badge tone={STATUS_TONES[matter.status]}>{t(`enum.MatterStatus.${matter.status}`)}</Badge>
            <Badge tone="accent">{t(`enum.MatterLevel.${matter.level}`)}</Badge>
            {matter.outcome && <Badge tone={STATUS_TONES[matter.outcome]}>{t(`enum.MatterOutcome.${matter.outcome}`)}</Badge>}
          </span>
        }
        actions={
          <>
            {can(user, "matters", "create") && (
              <Link href={`/cases/new?clientId=${matter.clientId}&parentId=${id}`} className={buttonVariants({ variant: "outline" })}>
                <GitBranchPlus /> {t("cases.newLinked")}
              </Link>
            )}
            {canEdit && (
              <Link href={`/cases/${id}/edit`} className={buttonVariants({ variant: "outline" })}>
                <Pencil /> {t("common.edit")}
              </Link>
            )}
            {can(user, "matters", "delete") && (
              <ActionButton variant="destructive" action={deleteMatter.bind(null, id)} confirm={t("common.confirmDelete")} redirectTo="/cases">
                <Trash2 /> {t("common.delete")}
              </ActionButton>
            )}
          </>
        }
      />
      <Tabs tabs={tabs} active={tab} base={`/cases/${id}`} />
      {content}
    </>
  );
}
