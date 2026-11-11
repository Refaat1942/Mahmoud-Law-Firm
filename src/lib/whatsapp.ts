import { decryptSecret } from "./crypto";
import { normalizePhone } from "./phone";
import { getSetting } from "./settings";

export type WhatsAppSettings = {
  enabled: boolean;
  /** WhatsApp Business Cloud API phone number ID (Meta Business Manager). */
  phoneNumberId: string;
  /** Permanent access token, encrypted with encryptSecret. */
  accessTokenEnc: string | null;
  /** Approved utility template with one body variable ({{1}}) that carries the notification text. */
  templateName: string;
  languageAr: string;
  languageEn: string;
  apiVersion: string;
};

export const DEFAULT_WHATSAPP: WhatsAppSettings = { enabled: false, phoneNumberId: "", accessTokenEnc: null, templateName: "", languageAr: "ar", languageEn: "en", apiVersion: "v21.0" };

export const getWhatsAppSettings = () => getSetting<WhatsAppSettings>("whatsapp", DEFAULT_WHATSAPP);

export type WhatsAppResult = { status: "SENT" | "FAILED" | "SKIPPED"; error?: string };

/**
 * Sends a business-initiated message through the official WhatsApp Business Cloud API using an approved
 * template (free-form text is only allowed inside a 24-hour customer window). Skipped when not configured.
 */
export async function sendWhatsApp(phone: string | null | undefined, text: string, locale: string, s?: WhatsAppSettings): Promise<WhatsAppResult> {
  const settings = s ?? (await getWhatsAppSettings());
  const token = decryptSecret(settings.accessTokenEnc);
  if (!settings.enabled || !token || !settings.phoneNumberId || !settings.templateName) return { status: "SKIPPED", error: "not_configured" };
  const to = normalizePhone(phone);
  if (!to) return { status: "SKIPPED", error: "no_phone" };
  try {
    const res = await fetch(`https://graph.facebook.com/${settings.apiVersion}/${settings.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: settings.templateName,
          language: { code: locale === "en" ? settings.languageEn : settings.languageAr },
          components: [{ type: "body", parameters: [{ type: "text", text: text.slice(0, 1000) }] }],
        },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (res.ok) return { status: "SENT" };
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    return { status: "FAILED", error: `${res.status} ${body?.error?.message ?? ""}`.trim().slice(0, 300) };
  } catch (e) {
    return { status: "FAILED", error: (e instanceof Error ? e.message : "network").slice(0, 300) };
  }
}
