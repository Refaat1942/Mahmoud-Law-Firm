import { getTranslations } from "next-intl/server";
import { Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { plain } from "@/lib/plain";
import { sum } from "@/lib/money";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { ActionButton } from "@/components/action-button";
import { EntityForm } from "@/components/entity-form";
import { DateText, Money } from "@/components/format";
import { Section } from "@/components/page";
import { addInstallment, deleteInstallment, saveFeeAgreement } from "@/server/matters/actions";
import { enumOptions } from "@/server/options";
import type { TabProps } from "./types";

export async function FeesTab({ matterId, canEdit }: TabProps) {
  const t = await getTranslations();
  const fa = await prisma.feeAgreement.findUnique({
    where: { matterId },
    include: { installments: { include: { invoice: true }, orderBy: { dueDate: "asc" } } },
  });

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Section title={t("cases.feeAgreement")}>
        {canEdit ? (
          <EntityForm
            schema="feeAgreement"
            action={saveFeeAgreement.bind(null, matterId)}
            defaultValues={fa ? plain(fa) : { type: "FIXED" }}
            fields={[
              { name: "type", label: t("f.feeType"), type: "select", options: await enumOptions("FeeType"), required: true },
              { name: "amount", label: t("f.feeAmount"), type: "money", showIf: { field: "type", values: ["FIXED", "INSTALLMENTS"] } },
              { name: "percentage", label: t("f.percentage"), type: "number", showIf: { field: "type", values: ["PERCENTAGE"] } },
              { name: "hourlyRate", label: t("f.hourlyRate"), type: "money", showIf: { field: "type", values: ["HOURLY"] } },
              { name: "signedAt", label: t("f.signedAt"), type: "date" },
              { name: "notes", label: t("f.notes"), type: "textarea" },
            ]}
          />
        ) : fa ? (
          <p>{t(`enum.FeeType.${fa.type}`)}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{t("common.empty")}</p>
        )}
      </Section>

      {fa && (
        <Section
          title={t("cases.installments")}
          actions={fa.installments.length > 0 && <Money value={sum(fa.installments.map((i) => i.amount)).toString()} />}
        >
          {fa.installments.length > 0 && (
            <Table className="mb-4">
              <thead>
                <tr>
                  <Th>{t("f.dueDate")}</Th>
                  <Th>{t("f.description")}</Th>
                  <Th>{t("f.amount")}</Th>
                  <Th>{t("f.invoice")}</Th>
                  {canEdit && <Th />}
                </tr>
              </thead>
              <tbody>
                {fa.installments.map((i) => (
                  <tr key={i.id}>
                    <Td>
                      <DateText value={i.dueDate} />
                    </Td>
                    <Td>{i.description}</Td>
                    <Td>
                      <Money value={i.amount.toString()} />
                    </Td>
                    <Td>
                      {i.invoice ? (
                        <Link href={`/billing/invoices/${i.invoice.id}`} className="text-primary hover:underline dark:text-accent">
                          {i.invoice.number}
                        </Link>
                      ) : (
                        <Badge tone="warning">{t("cases.notInvoiced")}</Badge>
                      )}
                    </Td>
                    {canEdit && (
                      <Td>
                        {!i.invoiceId && (
                          <ActionButton variant="ghost" size="icon" action={deleteInstallment.bind(null, i.id)} confirm={t("common.confirmDelete")} aria-label={t("common.delete")}>
                            <Trash2 />
                          </ActionButton>
                        )}
                      </Td>
                    )}
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          {canEdit && (
            <EntityForm
              compact
              schema="installment"
              action={addInstallment.bind(null, fa.id)}
              resetOnSuccess
              submitLabel={t("common.add")}
              fields={[
                { name: "dueDate", label: t("f.dueDate"), type: "date", required: true },
                { name: "amount", label: t("f.amount"), type: "money", required: true },
                { name: "description", label: t("f.description"), span: 2 },
              ]}
            />
          )}
        </Section>
      )}
    </div>
  );
}
