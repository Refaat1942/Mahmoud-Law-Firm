import { z } from "zod";
import { zBool, zEmail, zId, zOptId, zOptText, zText } from "../common";

const password = () => z.string({ required_error: "v.required" }).min(8, "v.passwordMin");

export const userBase = z.object({
  email: zEmail(),
  nameAr: zText(),
  nameEn: zText(),
  phone: zOptText(30),
  roleId: zId(),
  clientId: zOptId(),
  isActive: zBool(),
});

export const userCreateSchema = userBase.extend({ password: password() });

export const userUpdateSchema = userBase.extend({
  password: z.preprocess((v) => (v === "" ? undefined : v), password().optional()),
});

export const roleSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2, "v.required")
    .regex(/^[a-z0-9_-]+$/, "v.slug"),
  nameAr: zText(),
  nameEn: zText(),
  scopeAll: zBool(),
});

export const profileSchema = z.object({
  nameAr: zText(),
  nameEn: zText(),
  phone: zOptText(30),
  locale: z.enum(["ar", "en"]),
});

export const passwordChangeSchema = z
  .object({ current: z.string().min(1, "v.required"), next: password(), confirm: z.string() })
  .refine((v) => v.next === v.confirm, { message: "v.passwordMatch", path: ["confirm"] });

export const totpSchema = z.object({ token: z.string().trim().regex(/^\d{6}$/, "v.otp") });

export const NOTIFICATION_TYPES = ["hearing", "deadline", "task", "appointment", "notice", "filing", "courtUpdate", "poa", "employeeDoc", "invoice", "installment", "cheque", "collection", "escalation", "approval", "message", "briefing"] as const;

export const notificationPrefsSchema = z.object({
  whatsapp: zBool(),
  emailOff: z.preprocess((v) => (v === undefined || v === null || v === "" ? [] : Array.isArray(v) ? v : [v]), z.array(z.enum(NOTIFICATION_TYPES))),
});

export const whatsappSettingsSchema = z.object({
  enabled: zBool(),
  phoneNumberId: z.preprocess((v) => v ?? "", z.string().trim().regex(/^\d*$/, "v.number").max(30)),
  accessToken: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().max(1000).optional()),
  templateName: z.preprocess((v) => v ?? "", z.string().trim().regex(/^[a-z0-9_]*$/, "v.slug").max(100)),
  languageAr: z.preprocess((v) => v || "ar", z.string().trim().max(10)),
  languageEn: z.preprocess((v) => v || "en", z.string().trim().max(10)),
});
