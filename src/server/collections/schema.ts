import { z } from "zod";
import { zDate, zEnum, zOptDate, zOptId, zOptMoney, zText } from "../common";

export const COLLECTION_ACTIONS = ["CALL", "EMAIL", "WHATSAPP", "VISIT", "LETTER", "LEGAL_ACTION", "OTHER"] as const;

export const collectionNoteSchema = z
  .object({
    invoiceId: zOptId(),
    date: zDate(),
    action: zEnum(COLLECTION_ACTIONS),
    outcome: zText(2000),
    promisedAmount: zOptMoney(),
    promisedDate: zOptDate(),
    nextFollowUp: zOptDate(),
    assigneeId: zOptId(),
  })
  .refine((n) => !n.nextFollowUp || n.nextFollowUp >= n.date, { message: "v.dateOrder", path: ["nextFollowUp"] });
