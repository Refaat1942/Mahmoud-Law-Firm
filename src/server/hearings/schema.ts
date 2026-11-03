import { z } from "zod";
import { zDate, zEnum, zId, zInt, zOptDate, zOptId, zOptText, zText } from "../common";

export const hearingSchema = z.object({
  matterId: zId(),
  date: zDate(),
  courtId: zOptId(),
  room: zOptText(60),
  lawyerId: zOptId(),
  purpose: zOptText(300),
  notes: zOptText(),
});

export const decisionSchema = z.object({
  status: zEnum(["HELD", "POSTPONED", "CANCELLED"]),
  decision: zOptText(),
  nextDate: zOptDate(),
  nextPurpose: zOptText(300),
});

/** Title and days may be left empty to take them from the selected preset. */
export const deadlineSchema = z
  .object({
    title: zOptText(300),
    kind: zText(40),
    startDate: zDate(),
    days: z.preprocess((v) => (v === "" || v === null ? undefined : v), zInt(1).optional()),
    assigneeId: zOptId(),
  })
  .refine((d) => d.kind !== "CUSTOM" || (!!d.title && !!d.days), { message: "v.required", path: ["days"] });
