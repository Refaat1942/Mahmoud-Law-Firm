import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can, requirePermission } from "@/lib/session";
import { sum } from "@/lib/money";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page";
import { AccountingNav } from "../nav";

const SOURCES = ["manual", "invoice", "payment", "creditNote", "trust", "expense", "payroll"] as const;

export default async function JournalPage() {
  const user = await requirePermission("accounting");
  const t = await getTranslations();
  const entries = await prisma.journalEntry.findMany({ include: { lines: true }, orderBy: [{ date: "desc" }, { number: "desc" }], take: 3000 });
  return (
    <>
      <PageHeader
        title={t("nav.accounting")}
        actions={
          can(user, "accounting", "create") && (
            <Link href="/accounting/journal/new" className={buttonVariants()}>
              <Plus /> {t("accounting.newJournal")}
            </Link>
          )
        }
      />
      <AccountingNav active="journal" />
      <DataTable
        exportName="journal"
        filters={[{ key: "source", label: t("accounting.source"), options: SOURCES.map((s) => ({ value: t(`accounting.sources.${s}`), label: t(`accounting.sources.${s}`) })) }]}
        columns={[
          { key: "number", label: t("f.number"), href: "/accounting/journal/:id" },
          { key: "date", label: t("f.date"), type: "date" },
          { key: "description", label: t("f.description") },
          { key: "source", label: t("accounting.source") },
          { key: "amount", label: t("f.amount"), type: "money" },
        ]}
        rows={entries.map((e) => ({
          id: e.id,
          number: e.number,
          date: e.date.toISOString(),
          description: e.description,
          source: t(`accounting.sources.${(SOURCES as readonly string[]).includes(e.sourceType ?? "manual") ? (e.sourceType ?? "manual") : "manual"}`),
          amount: sum(e.lines.map((l) => l.debit)).toString(),
        }))}
      />
    </>
  );
}
