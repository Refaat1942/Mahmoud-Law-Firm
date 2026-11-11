import { z } from "zod";
import { zEnum, zId, zInt, zOptDate, zOptId, zOptText, zText } from "../common";

export const noticeSchema = z
  .object({
    title: zText(),
    direction: zEnum(["OUTGOING", "INCOMING"]),
    clientId: zId(),
    matterId: zOptId(),
    counterparty: zText(300),
    method: zEnum(["NOTARY", "COURT_BAILIFF", "COURIER", "REGISTERED_MAIL", "EMAIL", "WHATSAPP", "HAND_DELIVERY", "OTHER"]),
    status: zEnum(["DRAFT", "SENT", "DELIVERED", "REFUSED", "FAILED"]),
    reference: zOptText(100),
    sentAt: zOptDate(),
    servedAt: zOptDate(),
    acknowledgedAt: zOptDate(),
    graceDays: z.preprocess((v) => (v === "" || v === null ? undefined : v), zInt(1).optional()),
    assigneeId: zOptId(),
    notes: zOptText(),
  })
  .refine((n) => !n.servedAt || !n.sentAt || n.servedAt >= n.sentAt, { message: "v.dateOrder", path: ["servedAt"] });
