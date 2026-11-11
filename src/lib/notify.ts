import { prisma } from "./prisma";
import { sendMail } from "./mailer";
import { renderTemplate } from "./templates";
import { getEmailTemplates } from "./settings";
import { sendWhatsApp } from "./whatsapp";

export type NotificationPrefs = { emailOff?: string[]; whatsapp?: boolean };

/** Base type for preferences: "poa:abc" → "poa". */
export const baseType = (type: string) => type.split(":")[0];

/**
 * Creates an in-app notification and delivers it by email and (when the user opted in and WhatsApp is
 * configured) WhatsApp, in the user's language, honouring their per-type email preferences. Each channel's
 * outcome is stored on the notification.
 */
export async function notify(input: {
  userId: string;
  type: string;
  template?: string;
  vars?: Record<string, string>;
  title?: string;
  body?: string;
  link?: string;
}) {
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user || !user.isActive || user.deletedAt) return;
  let title = input.title ?? "";
  let body = input.body ?? "";
  if (input.template) {
    const tpl = (await getEmailTemplates())[input.template];
    if (tpl) {
      const ar = user.locale !== "en";
      title = renderTemplate(ar ? tpl.subjectAr : tpl.subjectEn, input.vars ?? {});
      body = renderTemplate(ar ? tpl.bodyAr : tpl.bodyEn, input.vars ?? {});
    }
  }
  const prefs = (user.notificationPrefs ?? {}) as NotificationPrefs;
  const errors: string[] = [];

  let emailStatus: string;
  if (prefs.emailOff?.includes(baseType(input.type))) emailStatus = "OFF";
  else {
    try {
      emailStatus = await sendMail(user.email, title, body);
    } catch (e) {
      emailStatus = "FAILED";
      errors.push(`email: ${e instanceof Error ? e.message : "error"}`);
    }
  }

  let whatsappStatus: string | null = null;
  if (prefs.whatsapp) {
    const r = await sendWhatsApp(user.phone, `${title}\n${body}`.trim(), user.locale);
    whatsappStatus = r.status;
    if (r.error && r.status === "FAILED") errors.push(`whatsapp: ${r.error}`);
  }

  await prisma.notification.create({
    data: { userId: user.id, type: input.type, title, body, link: input.link, emailStatus, whatsappStatus, deliveryError: errors.join("; ").slice(0, 500) || null },
  });
}
