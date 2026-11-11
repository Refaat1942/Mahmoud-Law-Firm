import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { localized } from "@/lib/utils";
import { Money } from "@/components/format";
import { PaymentForm } from "@/components/payment-form";
import { PageHeader, Section } from "@/components/page";
import { allocatePayment } from "@/server/billing/actions";
import { openInvoices, paymentScope, unallocated } from "@/server/billing/queries";

export default async function AllocatePaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("billing", "update");
  const { id } = await params;
  const t = await getTranslations();
  const locale = await getLocale();
  const p = await prisma.payment.findFirst({ where: { AND: [paymentScope(user), { id }] }, include: { client: true } });
  if (!p || p.chequeStatus === "BOUNCED") notFound();
  const left = await unallocated(id);
  const open = await openInvoices(user, p.clientId);
  return (
    <>
      <PageHeader
        title={`${t("billing.allocateReceipt")} ${p.number}`}
        subtitle={
          <>
            {localized(p.client, locale)} · {t("billing.onAccountLeft")}: <Money value={left.toFixed(2)} />
          </>
        }
      />
      <Section>
        <PaymentForm
          mode="allocate"
          action={allocatePayment.bind(null, id)}
          clientId={p.clientId}
          available={left.toFixed(2)}
          invoices={open.map((i) => ({ id: i.id, number: i.number, due: i.due.toFixed(2), currency: i.currency, issueDate: i.issueDate.toISOString() }))}
          redirectTo="/billing/payments"
        />
      </Section>
    </>
  );
}
