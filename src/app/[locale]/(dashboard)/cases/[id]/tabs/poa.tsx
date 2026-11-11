import { getTranslations } from "next-intl/server";
import { Download, Unlink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { daysUntil } from "@/lib/deadlines";
import { startOfDay } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { ActionButton } from "@/components/action-button";
import { EntityForm } from "@/components/entity-form";
import { DateText } from "@/components/format";
import { Section } from "@/components/page";
import { linkPoa, unlinkPoa } from "@/server/matters/actions";
import type { TabProps } from "./types";

/** Powers of attorney the case relies on; only verified, unexpired PoAs of the client can be linked. */
export async function PoaTab({ matterId, canEdit }: TabProps) {
  const t = await getTranslations();
  const matter = await prisma.matter.findUniqueOrThrow({ where: { id: matterId }, select: { clientId: true } });
  const [linked, candidates] = await Promise.all([
    prisma.matterPoa.findMany({
      where: { matterId, poa: { deletedAt: null } },
      include: { poa: { include: { document: { include: { versions: { orderBy: { version: "desc" }, take: 1 } } } } } },
      orderBy: { linkedAt: "asc" },
    }),
    prisma.powerOfAttorney.findMany({ where: { clientId: matter.clientId, deletedAt: null, matters: { none: { matterId } } }, orderBy: { expiresAt: "desc" } }),
  ]);
  const today = startOfDay();
  const eligible = candidates.filter((p) => p.verified && (!p.expiresAt || p.expiresAt >= today));
  const blocked = candidates.length - eligible.length;

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Section title={t("cases.poaLinked")} className="lg:col-span-2">
        {linked.length === 0 ? (
          <p className="text-sm text-warning">{t("cases.noValidPoa")}</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t("f.poaNumber")}</Th>
                <Th>{t("f.notary")}</Th>
                <Th>{t("f.issuedAt")}</Th>
                <Th>{t("f.expiresAt")}</Th>
                <Th>{t("f.file")}</Th>
                {canEdit && <Th />}
              </tr>
            </thead>
            <tbody>
              {linked.map(({ poa: p }) => {
                const left = p.expiresAt ? daysUntil(p.expiresAt) : null;
                const v = p.document?.versions[0];
                return (
                  <tr key={p.id}>
                    <Td>
                      {p.number} {p.verified && <Badge tone="success">{t("clients.poaVerified")}</Badge>}
                    </Td>
                    <Td>{p.notary}</Td>
                    <Td>
                      <DateText value={p.issuedAt} />
                    </Td>
                    <Td>
                      <DateText value={p.expiresAt} />{" "}
                      {left !== null && left < 0 && <Badge tone="danger">{t("enum.ExpiryState.EXPIRED")}</Badge>}
                      {left !== null && left >= 0 && left <= 30 && <Badge tone="warning">{t("clients.daysLeft", { days: left })}</Badge>}
                    </Td>
                    <Td>
                      {v && (
                        <a href={`/api/documents/${v.id}`} className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label={t("common.download")}>
                          <Download />
                        </a>
                      )}
                    </Td>
                    {canEdit && (
                      <Td>
                        <ActionButton variant="ghost" size="icon" action={unlinkPoa.bind(null, matterId, p.id)} confirm={t("cases.confirmUnlinkPoa")} aria-label={t("cases.unlinkPoa")}>
                          <Unlink />
                        </ActionButton>
                      </Td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Section>
      {canEdit && (
        <Section title={t("cases.linkPoa")}>
          {eligible.length > 0 ? (
            <EntityForm
              schema="poaLink"
              action={linkPoa.bind(null, matterId)}
              columns={1}
              resetOnSuccess
              submitLabel={t("cases.linkPoa")}
              fields={[{ name: "poaId", label: t("f.poaNumber"), type: "select", required: true, options: eligible.map((p) => ({ value: p.id, label: p.number })) }]}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{t("cases.noEligiblePoa")}</p>
          )}
          {blocked > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              {t("cases.poaBlocked", { count: blocked })}{" "}
              <Link href={`/clients/${matter.clientId}`} className="text-primary underline dark:text-accent">
                {t("cases.openClient")}
              </Link>
            </p>
          )}
        </Section>
      )}
    </div>
  );
}
