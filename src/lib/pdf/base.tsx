import path from "node:path";
import type { ReactNode } from "react";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { OfficeSettings } from "@/lib/settings";
import { getFileBuffer } from "@/lib/storage";

const FONT_DIR = path.join(process.cwd(), "public", "fonts");
let registered = false;

function registerFonts() {
  if (registered) return;
  Font.register({
    family: "Plex",
    fonts: [
      { src: path.join(FONT_DIR, "IBMPlexSansArabic-Regular.ttf") },
      { src: path.join(FONT_DIR, "IBMPlexSansArabic-Bold.ttf"), fontWeight: "bold" },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}

export const NAVY = "#1b2a4a";
export const GOLD = "#c9a24b";

export const s = StyleSheet.create({
  page: { fontFamily: "Plex", fontSize: 10, paddingTop: 32, paddingBottom: 48, paddingHorizontal: 32, color: "#111" },
  header: { borderBottomWidth: 2, borderBottomColor: GOLD, paddingBottom: 8, marginBottom: 14, alignItems: "center" },
  officeName: { fontSize: 14, fontWeight: "bold", color: NAVY },
  muted: { color: "#666", fontSize: 9 },
  title: { fontSize: 15, fontWeight: "bold", color: NAVY, marginBottom: 8, textAlign: "center" },
  table: { borderWidth: 1, borderColor: "#ddd" },
  tr: { borderBottomWidth: 1, borderBottomColor: "#eee", minHeight: 20, alignItems: "center" },
  th: { backgroundColor: NAVY, color: "#fff", fontWeight: "bold" },
  td: { paddingHorizontal: 4, paddingVertical: 3, fontSize: 9 },
  footer: { position: "absolute", bottom: 20, left: 32, right: 32, fontSize: 8, color: "#888", textAlign: "center" },
  bold: { fontWeight: "bold" },
});

export type Dir = { rtl: boolean };

/** Flex row that flows right-to-left for Arabic documents. */
export function row(rtl: boolean) {
  return { flexDirection: rtl ? ("row-reverse" as const) : ("row" as const) };
}

export function align(rtl: boolean) {
  return { textAlign: rtl ? ("right" as const) : ("left" as const) };
}

export function PdfShell({
  office,
  locale,
  title,
  subtitle,
  logo,
  landscape,
  children,
}: {
  office: OfficeSettings;
  locale: string;
  title?: string;
  subtitle?: string;
  logo?: Buffer | null;
  landscape?: boolean;
  children: ReactNode;
}) {
  const rtl = locale === "ar";
  return (
    <Document title={title} author={office.nameEn}>
      <Page size="A4" orientation={landscape ? "landscape" : "portrait"} style={s.page}>
        <View style={s.header} fixed>
          {logo && <Image src={logo} style={{ height: 40, marginBottom: 4, objectFit: "contain" }} />}
          <Text style={s.officeName}>{rtl ? office.nameAr : office.nameEn}</Text>
          <Text style={s.muted}>{[rtl ? office.addressAr : office.addressEn, office.phone, office.email].filter(Boolean).join("  |  ")}</Text>
          {office.trn && <Text style={s.muted}>TRN: {office.trn}</Text>}
        </View>
        {title && <Text style={s.title}>{title}</Text>}
        {subtitle && <Text style={[s.muted, { textAlign: "center", marginBottom: 10 }]}>{subtitle}</Text>}
        {children}
        <Text style={s.footer} fixed render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </Page>
    </Document>
  );
}

export type PdfColumn<T> = { label: string; width: number; value: (row: T) => string; align?: "start" | "end" | "center" };

export function PdfTable<T>({ columns, rows, rtl }: { columns: PdfColumn<T>[]; rows: T[]; rtl: boolean }) {
  const cellAlign = (a?: "start" | "end" | "center") =>
    a === "center" ? "center" : a === "end" ? (rtl ? "left" : "right") : rtl ? "right" : "left";
  return (
    <View style={s.table}>
      <View style={[s.tr, s.th, row(rtl)]} fixed>
        {columns.map((c, i) => (
          <Text key={i} style={[s.td, { width: `${c.width}%`, textAlign: cellAlign(c.align) }]}>
            {c.label}
          </Text>
        ))}
      </View>
      {rows.map((r, ri) => (
        <View key={ri} style={[s.tr, row(rtl), ri % 2 ? { backgroundColor: "#fafafa" } : {}]} wrap={false}>
          {columns.map((c, i) => (
            <Text key={i} style={[s.td, { width: `${c.width}%`, textAlign: cellAlign(c.align) }]}>
              {c.value(r)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

/** PNG/JPEG logo only; react-pdf cannot embed SVG or WebP images. */
export async function loadLogo(office: OfficeSettings) {
  if (!office.logoKey || !/\.(png|jpe?g)$/i.test(office.logoKey)) return null;
  try {
    return await getFileBuffer(office.logoKey);
  } catch {
    return null;
  }
}

export async function renderPdf(doc: React.ReactElement): Promise<Buffer> {
  registerFonts();
  return renderToBuffer(doc as Parameters<typeof renderToBuffer>[0]);
}

export function pdfResponse(buf: Buffer, fileName: string, inline = true) {
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}

export function fmtDate(d: Date | string | null | undefined, locale: string, withTime = false) {
  if (!d) return "";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-AE-u-nu-latn" : "en-GB", {
    timeZone: "Asia/Dubai",
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
  }).format(new Date(d));
}

export function fmtMoney(v: unknown, currency = "AED", locale = "en") {
  return `${new Intl.NumberFormat(locale === "ar" ? "ar-AE-u-nu-latn" : "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v ?? 0))} ${currency}`;
}
