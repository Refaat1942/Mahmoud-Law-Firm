import { z } from "zod";
import { zEnum, zOptDate, zOptEmail, zOptText, zText } from "../common";

export const clientSchema = z
  .object({
    type: zEnum(["INDIVIDUAL", "COMPANY"]),
    nameAr: zText(),
    nameEn: zText(),
    emiratesId: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z
        .string()
        .trim()
        .regex(/^784-?\d{4}-?\d{7}-?\d$/, "v.emiratesId")
        .optional(),
    ),
    passportNo: zOptText(30),
    nationality: zOptText(60),
    tradeLicenseNo: zOptText(50),
    trn: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().regex(/^\d{15}$/, "v.trn").optional()),
    email: zOptEmail(),
    phone: zOptText(30),
    address: zOptText(500),
    notes: zOptText(),
  })
  .refine((c) => c.type !== "COMPANY" || !!c.tradeLicenseNo, { message: "v.required", path: ["tradeLicenseNo"] });

export const contactSchema = z.object({
  name: zText(),
  position: zOptText(100),
  email: zOptEmail(),
  phone: zOptText(30),
});

export const poaSchema = z.object({
  number: zText(60),
  issuedAt: zOptDate(),
  expiresAt: zOptDate(),
  notary: zOptText(200),
  scope: zOptText(),
});

export const partySchema = z.object({
  type: zEnum(["INDIVIDUAL", "COMPANY"]),
  nameAr: zText(),
  nameEn: zOptText(300),
  idNumber: zOptText(50),
  phone: zOptText(30),
  notes: zOptText(),
});
