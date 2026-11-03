import { prisma } from "./prisma";
import { sendMail } from "./mailer";
import { renderTemplate } from "./templates";
import { getEmailTemplates } from "./settings";

/** Creates an in-app notification and sends the matching email template in the user's language. */
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
  if (!user || !user.isActive) return;
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
  await prisma.notification.create({ data: { userId: user.id, type: input.type, title, body, link: input.link } });
  await sendMail(user.email, title, body);
}
