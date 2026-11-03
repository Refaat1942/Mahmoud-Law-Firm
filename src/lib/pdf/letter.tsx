import { Text, View } from "@react-pdf/renderer";
import type { OfficeSettings } from "@/lib/settings";
import { PdfShell, renderPdf, s } from "./base";

// react-pdf lays lines out with a left-to-right base, so trailing punctuation of an Arabic line jumps
// to the start; ending each line with an RLM (which it consumes without drawing) keeps it at the end.
const RLM = "\u200F";

/** A letter-style document on the office letterhead: one paragraph per line of text. */
export async function renderLetterPdf(input: { office: OfficeSettings; locale: string; title: string; body: string; logo: Buffer | null }) {
  const rtl = input.locale === "ar";
  return renderPdf(
    <PdfShell office={input.office} locale={input.locale} logo={input.logo} title={input.title}>
      <View style={{ gap: 6 }}>
        {input.body.split(/\r?\n/).map((line, i) => (
          <Text key={i} style={{ fontSize: 11, lineHeight: 1.6, textAlign: rtl ? "right" : "left", minHeight: 8 }}>
            {rtl && line ? line + RLM : line}
          </Text>
        ))}
      </View>
      <Text style={[s.muted, { marginTop: 24 }]}> </Text>
    </PdfShell>,
  );
}
