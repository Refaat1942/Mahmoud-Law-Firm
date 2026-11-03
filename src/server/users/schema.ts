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
