import { getLocale, getTranslations } from "next-intl/server";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { localized, localizedTitle } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { Badge, STATUS_TONES } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, Section } from "@/components/page";
import { conflictCheck } from "@/server/clients/queries";

export default async function ConflictCheckPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePermission("clients");
  const t = await getTranslations();
  const locale = await getLocale();
  const q = (await searchParams).q?.trim() ?? "";
  const result = q.length >= 2 ? await conflictCheck(q) : null;
  const hasConflict = !!result && result.parties.some((p) => p.matters.length > 0);

  return (
    <>
      <PageHeader title={t("clients.conflictCheck")} subtitle={t("clients.conflictHelp")} />
      <form className="mb-5 flex max-w-xl gap-2">
        <Input name="q" defaultValue={q} placeholder={t("clients.conflictPlaceholder")} autoFocus />
        <Button type="submit">{t("clients.check")}</Button>
      </form>

      {result && (
        <div className="space-y-5">
          <div
            className={`flex items-center gap-2 rounded-lg border p-4 text-sm font-medium ${
              hasConflict ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-success/40 bg-success/10 text-success"
            }`}
          >
            {hasConflict ? <TriangleAlert className="size-5" /> : <CircleCheck className="size-5" />}
            {hasConflict ? t("clients.conflictFound") : t("clients.noConflict")}
          </div>

          <Section title={`${t("clients.matchingClients")} (${result.clients.length})`}>
            {result.clients.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("common.empty")}</p>
            ) : (
              <ul className="divide-y">
                {result.clients.map((c) => (
                  <li key={c.id} className="py-2">
                    <Link href={`/clients/${c.id}`} className="font-medium text-primary hover:underline dark:text-accent">
                      {localized(c, locale)} ({c.code})
                    </Link>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {c.matters.map((m) => (
                        <Link key={m.id} href={`/cases/${m.id}`}>
                          <Badge tone={STATUS_TONES[m.status]}>
                            {m.fileNo} — {localizedTitle(m, locale)}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={`${t("clients.matchingParties")} (${result.parties.length})`}>
            {result.parties.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("common.empty")}</p>
            ) : (
              <ul className="divide-y">
                {result.parties.map((p) => (
                  <li key={p.id} className="py-2">
                    <Link href={`/clients/parties/${p.id}`} className="font-medium hover:underline">
                      {p.nameAr} {p.nameEn && `/ ${p.nameEn}`}
                    </Link>
                    <ul className="mt-1 space-y-1 text-sm">
                      {p.matters.map((mp) => (
                        <li key={mp.id} className="flex flex-wrap items-center gap-2">
                          <Badge tone="danger">{t(`enum.MatterPartyRole.${mp.role}`)}</Badge>
                          <Link href={`/cases/${mp.matter.id}`} className="text-primary hover:underline dark:text-accent">
                            {mp.matter.fileNo} — {localizedTitle(mp.matter, locale)}
                          </Link>
                          <span className="text-muted-foreground">
                            ({t("f.client")}: {localized(mp.matter.client, locale)})
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}
    </>
  );
}
