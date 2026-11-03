import { z } from "zod";
import { zBool, zDate, zFile, zInt, zMoney, zOptText, zText } from "../common";

export const officeSchema = z.object({
  nameAr: zText(),
  nameEn: zText(),
  trn: z.preprocess((v) => (v === "" ? undefined : v), z.string().regex(/^\d{15}$/, "v.trn").optional()),
  addressAr: zOptText(500),
  addressEn: zOptText(500),
  phone: zOptText(30),
  email: zOptText(100),
  currency: zText(3),
  vatRate: zMoney(),
  defaultHourlyRate: zMoney(),
  showHijri: zBool(),
  reminderDaysBefore: zInt(0),
  wpsEmployerId: zOptText(13),
  wpsBankCode: zOptText(9),
});

export const courtSchema = z.object({ nameAr: zText(), nameEn: zText(), emirate: zOptText(60), isActive: zBool() });

export const matterTypeSchema = z.object({
  key: z.string().trim().regex(/^[A-Z0-9_]+$/, "v.slugUpper"),
  nameAr: zText(),
  nameEn: zText(),
  isActive: zBool(),
});

export const holidaySchema = z.object({ date: zDate(), nameAr: zText(), nameEn: zText() });

export const sequenceSchema = z.object({ prefix: zText(10), padding: zInt(1), next: zInt(1), yearly: zBool() });

export const presetSchema = z.object({
  key: z.string().trim().regex(/^[A-Z0-9_]+$/, "v.slugUpper"),
  nameAr: zText(),
  nameEn: zText(),
  days: zInt(1),
});

export const emailTemplateSchema = z.object({ subjectAr: zText(), subjectEn: zText(), bodyAr: zText(5000), bodyEn: zText(5000) });

/** PNG or JPEG only: react-pdf cannot embed SVG or WebP. */
export const logoSchema = z.object({
  file: zFile().refine((f) => /^image\/(png|jpe?g)$/.test(f.type) || /\.(png|jpe?g)$/i.test(f.name), "v.imageOnly"),
});
