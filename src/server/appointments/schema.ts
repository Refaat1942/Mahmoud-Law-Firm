import { z } from "zod";
import { zDate, zEnum, zOptDate, zOptId, zOptText, zText } from "../common";

const ids = () => z.preprocess((v) => (v === undefined || v === null || v === "" ? [] : Array.isArray(v) ? v : [v]), z.array(z.string()).max(50));

export const appointmentSchema = z
  .object({
    title: zText(),
    kind: zEnum(["CLIENT_MEETING", "INTERNAL_MEETING", "CONSULTATION", "COURT_VISIT", "OTHER"]),
    status: zEnum(["SCHEDULED", "DONE", "CANCELLED"]),
    startAt: zDate(),
    endAt: zOptDate(),
    location: zOptText(300),
    onlineLink: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().url("v.url").max(500).optional()),
    clientId: zOptId(),
    matterId: zOptId(),
    attendeeIds: ids(),
    language: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["ar", "en"]).optional()),
    contactPreference: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["IN_PERSON", "PHONE", "WHATSAPP", "EMAIL", "VIDEO"]).optional()),
    notes: zOptText(),
    outcome: zOptText(),
  })
  .refine((a) => !a.endAt || a.endAt > a.startAt, { message: "v.dateOrder", path: ["endAt"] });
