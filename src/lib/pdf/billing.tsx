import { Text, View } from "@react-pdf/renderer";
import type { Prisma } from "@prisma/client";
import { PdfTable, fmtDate, fmtMoney, row, s } from "./base";

type Line = { type: string; description: string; quantity: Prisma.Decimal; unitPrice: Prisma.Decimal; vatRate: Prisma.Decimal; amount: Prisma.Decimal; vatAmount: Prisma.Decimal };
type Party = { name: string; trn?: string | null; address?: string | null; code?: string };

function KeyValues({ items, rtl }: { items: [string, string | null | undefined][]; rtl: boolean }) {
  return (
    <View style={{ gap: 2 }}>
      {items
        .filter(([, v]) => v)
        .map(([k, v]) => (
          <View key={k} style={[row(rtl), { gap: 4 }]}>
            <Text style={[s.muted, { fontSize: 9 }]}>{k}:</Text>
            <Text style={{ fontSize: 9 }}>{v}</Text>
          </View>
        ))}
    </View>
  );
}

/** Body of a tax invoice or quote: parties, line table and VAT totals (amounts in the document currency). */
export function BillingDocument({
  t,
  locale,
  client,
  meta,
  lines,
  totals,
  currency,
  notes,
}: {
  t: (key: string) => string;
  locale: string;
  client: Party;
  meta: [string, string | null | undefined][];
  lines: Line[];
  totals: [string, Prisma.Decimal | string, boolean?][];
  currency: string;
  notes?: string | null;
}) {
  const rtl = locale === "ar";
  const money = (v: Prisma.Decimal | string) => fmtMoney(v.toString(), currency, locale);
  return (
    <View>
      <View style={[row(rtl), { justifyContent: "space-between", marginBottom: 12, gap: 16 }]}>
        <View style={{ flex: 1, borderWidth: 1, borderColor: "#ddd", padding: 8 }}>
          <Text style={[s.bold, { fontSize: 10, marginBottom: 4 }]}>{t("billing.pdf.billTo")}</Text>
          <Text style={{ fontSize: 10 }}>{client.name}</Text>
          <KeyValues rtl={rtl} items={[[t("f.code"), client.code], [t("f.trn"), client.trn], [t("f.address"), client.address]]} />
        </View>
        <View style={{ flex: 1, borderWidth: 1, borderColor: "#ddd", padding: 8 }}>
          <KeyValues rtl={rtl} items={meta} />
        </View>
      </View>
      <PdfTable
        rtl={rtl}
        rows={lines}
        columns={[
          { label: "#", width: 5, value: (l) => String(lines.indexOf(l) + 1), align: "center" },
          { label: t("f.description"), width: 34, value: (l) => l.description },
          { label: t("f.quantity"), width: 7, value: (l) => l.quantity.toString(), align: "end" },
          { label: t("f.unitPrice"), width: 16, value: (l) => money(l.unitPrice), align: "end" },
          { label: t("f.vatRate"), width: 8, value: (l) => `${l.vatRate.toString()}%`, align: "end" },
          { label: t("f.vatAmount"), width: 14, value: (l) => money(l.vatAmount), align: "end" },
          { label: t("f.amount"), width: 16, value: (l) => money(l.amount.plus(l.vatAmount)), align: "end" },
        ]}
      />
      <View style={[row(rtl), { marginTop: 10 }]}>
        <View style={{ width: "45%", gap: 3 }}>
          {totals.map(([label, value, strong]) => (
            <View key={label} style={[row(rtl), { justifyContent: "space-between", borderTopWidth: strong ? 1 : 0, borderTopColor: "#999", paddingTop: strong ? 3 : 0 }]}>
              <Text style={strong ? s.bold : {}}>{label}</Text>
              <Text style={strong ? s.bold : {}}>{money(value)}</Text>
            </View>
          ))}
        </View>
      </View>
      {notes && (
        <View style={{ marginTop: 14 }}>
          <Text style={[s.bold, { marginBottom: 2 }]}>{t("f.notes")}</Text>
          <Text style={{ fontSize: 9 }}>{notes}</Text>
        </View>
      )}
    </View>
  );
}

export { fmtDate };
