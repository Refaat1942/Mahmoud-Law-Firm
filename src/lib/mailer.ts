import nodemailer from "nodemailer";

const transport = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    })
  : null;

/** Sends an email; returns SKIPPED (logged only) when SMTP is not configured. Throws on SMTP errors. */
export async function sendMail(to: string, subject: string, text: string): Promise<"SENT" | "SKIPPED"> {
  if (!transport) {
    console.info(`[mail] to=${to} subject=${subject}\n${text}`);
    return "SKIPPED";
  }
  await transport.sendMail({ from: process.env.SMTP_FROM, to, subject, text });
  return "SENT";
}
