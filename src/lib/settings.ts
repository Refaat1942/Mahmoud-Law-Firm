import { prisma } from "./prisma";
import { DEFAULT_AI, type AiSettings } from "./ai/providers";

export type OfficeSettings = {
  nameAr: string;
  nameEn: string;
  trn: string;
  addressAr: string;
  addressEn: string;
  phone: string;
  email: string;
  logoKey: string | null;
  currency: string;
  vatRate: number;
  defaultHourlyRate: number;
  showHijri: boolean;
  reminderDaysBefore: number;
  wpsEmployerId: string;
  wpsBankCode: string;
};

export type DeadlinePreset = { key: string; nameAr: string; nameEn: string; days: number };

export type EmailTemplates = Record<string, { subjectAr: string; subjectEn: string; bodyAr: string; bodyEn: string }>;

export const DEFAULT_OFFICE: OfficeSettings = {
  nameAr: "مكتب المحاماة",
  nameEn: "Law Office",
  trn: "",
  addressAr: "",
  addressEn: "",
  phone: "",
  email: "",
  logoKey: null,
  currency: "AED",
  vatRate: 5,
  defaultHourlyRate: 1000,
  showHijri: false,
  reminderDaysBefore: 2,
  wpsEmployerId: "",
  wpsBankCode: "",
};

// Default statutory periods; offices should review and adjust them in Settings.
export const DEFAULT_DEADLINE_PRESETS: DeadlinePreset[] = [
  { key: "APPEAL", nameAr: "مهلة الاستئناف", nameEn: "Appeal period", days: 30 },
  { key: "CASSATION", nameAr: "مهلة الطعن بالتمييز / النقض", nameEn: "Cassation period", days: 60 },
  { key: "OBJECTION", nameAr: "مهلة التظلم / الاعتراض", nameEn: "Objection period", days: 15 },
  { key: "EXECUTION", nameAr: "مهلة التنفيذ", nameEn: "Execution period", days: 15 },
];

export const DEFAULT_EMAIL_TEMPLATES: EmailTemplates = {
  hearingReminder: {
    subjectAr: "تذكير بجلسة: {{matter}}",
    subjectEn: "Hearing reminder: {{matter}}",
    bodyAr: "لديك جلسة في القضية {{matter}} بتاريخ {{date}} أمام {{court}}.",
    bodyEn: "You have a hearing in {{matter}} on {{date}} at {{court}}.",
  },
  deadlineReminder: {
    subjectAr: "تذكير بموعد قانوني: {{title}}",
    subjectEn: "Deadline reminder: {{title}}",
    bodyAr: "الموعد القانوني {{title}} في القضية {{matter}} ينتهي بتاريخ {{date}}.",
    bodyEn: "The deadline {{title}} in {{matter}} is due on {{date}}.",
  },
  taskReminder: {
    subjectAr: "تذكير بمهمة: {{title}}",
    subjectEn: "Task reminder: {{title}}",
    bodyAr: "المهمة {{title}} مستحقة بتاريخ {{date}}.",
    bodyEn: "The task {{title}} is due on {{date}}.",
  },
  expiryReminder: {
    subjectAr: "تنبيه انتهاء: {{title}}",
    subjectEn: "Expiry notice: {{title}}",
    bodyAr: "{{title}} ينتهي بتاريخ {{date}}.",
    bodyEn: "{{title}} expires on {{date}}.",
  },
  appointmentReminder: {
    subjectAr: "تذكير بموعد: {{title}}",
    subjectEn: "Appointment reminder: {{title}}",
    bodyAr: "لديك موعد {{title}} بتاريخ {{date}} في {{location}}.",
    bodyEn: "You have {{title}} on {{date}} at {{location}}.",
  },
  noticeDeadline: {
    subjectAr: "مهلة إنذار: {{title}}",
    subjectEn: "Notice deadline: {{title}}",
    bodyAr: "تنتهي مهلة الإنذار {{title}} الموجّه إلى {{counterparty}} بتاريخ {{date}}.",
    bodyEn: "The notice {{title}} to {{counterparty}} expires on {{date}}.",
  },
  filingFollowUp: {
    subjectAr: "متابعة طلب لدى المحكمة: {{title}}",
    subjectEn: "Court filing follow-up: {{title}}",
    bodyAr: "موعد متابعة {{title}} في القضية {{matter}} بتاريخ {{date}}.",
    bodyEn: "Follow up {{title}} in {{matter}} on {{date}}.",
  },
  installmentDue: {
    subjectAr: "دفعة أتعاب مستحقة: {{matter}}",
    subjectEn: "Fee instalment due: {{matter}}",
    bodyAr: "دفعة أتعاب بقيمة {{amount}} في القضية {{matter}} مستحقة بتاريخ {{date}} ولم تُفوتر بعد.",
    bodyEn: "A fee instalment of {{amount}} on {{matter}} is due on {{date}} and is not invoiced yet.",
  },
  chequeDue: {
    subjectAr: "شيك مستحق للإيداع: {{number}}",
    subjectEn: "Cheque due for deposit: {{number}}",
    bodyAr: "الشيك رقم {{number}} من {{client}} بمبلغ {{amount}} يستحق بتاريخ {{date}}.",
    bodyEn: "Cheque {{number}} from {{client}} for {{amount}} is due on {{date}}.",
  },
  taskEscalation: {
    subjectAr: "مهمة متأخرة: {{title}}",
    subjectEn: "Overdue task: {{title}}",
    bodyAr: "المهمة {{title}} المسندة إلى {{assignee}} متأخرة منذ {{date}}.",
    bodyEn: "The task {{title}} assigned to {{assignee}} has been overdue since {{date}}.",
  },
  collectionFollowUp: {
    subjectAr: "متابعة تحصيل: {{client}}",
    subjectEn: "Collection follow-up: {{client}}",
    bodyAr: "موعد متابعة تحصيل مستحقات {{client}} بتاريخ {{date}}. آخر نتيجة: {{outcome}}",
    bodyEn: "Collection follow-up for {{client}} on {{date}}. Last outcome: {{outcome}}",
  },
  invoiceOverdue: {
    subjectAr: "فاتورة متأخرة: {{number}}",
    subjectEn: "Overdue invoice: {{number}}",
    bodyAr: "الفاتورة {{number}} للعميل {{client}} متأخرة السداد منذ {{date}}.",
    bodyEn: "Invoice {{number}} for {{client}} has been overdue since {{date}}.",
  },
};

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await prisma.setting.findUnique({ where: { key } });
  if (!row) return fallback;
  if (fallback && typeof fallback === "object" && !Array.isArray(fallback)) return { ...fallback, ...(row.value as object) } as T;
  return row.value as T;
}

export async function setSetting(key: string, value: unknown) {
  const json = JSON.parse(JSON.stringify(value));
  await prisma.setting.upsert({ where: { key }, create: { key, value: json }, update: { value: json } });
}

export const getOffice = () => getSetting<OfficeSettings>("office", DEFAULT_OFFICE);
export const getDeadlinePresets = () => getSetting<DeadlinePreset[]>("deadlinePresets", DEFAULT_DEADLINE_PRESETS);
export const getEmailTemplates = () => getSetting<EmailTemplates>("emailTemplates", DEFAULT_EMAIL_TEMPLATES);
export const getAiSettings = () => getSetting<AiSettings>("ai", DEFAULT_AI);
