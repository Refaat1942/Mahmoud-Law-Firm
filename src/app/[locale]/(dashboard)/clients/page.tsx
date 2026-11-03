import { getLocale, getTranslations } from "next-intl/server";
import { Plus, SearchCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can, requirePermission } from "@/lib/session";
import { localized } from "@/lib/utils";
import { daysUntil } from "@/lib/deadlines";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { PageHeader, Tabs } from "@/components/page";
import { enumOptions } from "@/server/options";

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requirePermission("clients");
  const t = await getTranslations();
  const locale = await getLocale();
  const tab = (await searchParams).tab ?? "clients";

  let content: React.ReactNode;
  if (tab === "parties") {
    const parties = await prisma.party.findMany({ where: { deletedAt: null }, include: { _count: { select: { matters: true } } }, orderBy: { nameAr: "asc" } });
    content = (
      <DataTable
        exportName="parties"
        columns={[
          { key: "nameAr", label: t("f.nameAr"), href: "/clients/parties/:id" },
          { key: "nameEn", label: t("f.nameEn") },
          { key: "type", label: t("f.clientType"), type: "badge", enumKey: "PartyType" },
          { key: "idNumber", label: t("f.idNumber") },
          { key: "matters", label: t("nav.cases"), type: "number" },
        ]}
        rows={parties.map((p) => ({ id: p.id, nameAr: p.nameAr, nameEn: p.nameEn ?? "", type: p.type, idNumber: p.idNumber ?? "", matters: p._count.matters }))}
      />
    );
  } else if (tab === "poa") {
    const powers = await prisma.powerOfAttorney.findMany({ where: { deletedAt: null, client: { deletedAt: null } }, include: { client: true }, orderBy: { expiresAt: "asc" } });
    content = (
      <DataTable
        exportName="powers-of-attorney"
        columns={[
          { key: "number", label: t("f.poaNumber") },
          { key: "client", label: t("f.client"), href: "/clients/:clientId" },
          { key: "issuedAt", label: t("f.issuedAt"), type: "date" },
          { key: "expiresAt", label: t("f.expiresAt"), type: "date" },
          { key: "state", label: t("f.status"), type: "badge", enumKey: "ExpiryState" },
        ]}
        rows={powers.map((p) => ({
          id: p.id,
          clientId: p.clientId,
          number: p.number,
          client: localized(p.client, locale),
          issuedAt: p.issuedAt?.toISOString() ?? "",
          expiresAt: p.expiresAt?.toISOString() ?? "",
          state: !p.expiresAt ? "VALID" : daysUntil(p.expiresAt) < 0 ? "EXPIRED" : daysUntil(p.expiresAt) <= 30 ? "EXPIRING" : "VALID",
        }))}
      />
    );
  } else {
    const clients = await prisma.client.findMany({
      where: { deletedAt: null },
      include: { _count: { select: { matters: { where: { deletedAt: null, status: { not: "CLOSED" } } } } } },
      orderBy: { createdAt: "desc" },
    });
    content = (
      <DataTable
        exportName="clients"
        filters={[{ key: "type", label: t("f.clientType"), options: await enumOptions("PartyType") }]}
        columns={[
          { key: "code", label: t("f.code"), href: "/clients/:id" },
          { key: "name", label: t("f.name"), href: "/clients/:id" },
          { key: "type", label: t("f.clientType"), type: "badge", enumKey: "PartyType" },
          { key: "idNo", label: t("f.idNumber") },
          { key: "phone", label: t("f.phone") },
          { key: "email", label: t("f.email") },
          { key: "openMatters", label: t("clients.openMatters"), type: "number" },
          { key: "createdAt", label: t("f.createdAt"), type: "date" },
        ]}
        rows={clients.map((c) => ({
          id: c.id,
          code: c.code,
          name: localized(c, locale),
          type: c.type,
          idNo: c.type === "COMPANY" ? (c.tradeLicenseNo ?? "") : (c.emiratesId ?? c.passportNo ?? ""),
          phone: c.phone ?? "",
          email: c.email ?? "",
          openMatters: c._count.matters,
          createdAt: c.createdAt.toISOString(),
        }))}
      />
    );
  }

  return (
    <>
      <PageHeader
        title={t("clients.title")}
        actions={
          <>
            <Link href="/clients/conflict-check" className={buttonVariants({ variant: "outline" })}>
              <SearchCheck /> {t("clients.conflictCheck")}
            </Link>
            {can(user, "clients", "create") && (
              <Link href={tab === "parties" ? "/clients/parties/new" : "/clients/new"} className={buttonVariants()}>
                <Plus /> {tab === "parties" ? t("clients.newParty") : t("clients.new")}
              </Link>
            )}
          </>
        }
      />
      <Tabs
        base="/clients"
        active={tab}
        tabs={[
          { key: "clients", label: t("clients.title") },
          { key: "parties", label: t("clients.parties") },
          { key: "poa", label: t("clients.powers") },
        ]}
      />
      {content}
    </>
  );
}
