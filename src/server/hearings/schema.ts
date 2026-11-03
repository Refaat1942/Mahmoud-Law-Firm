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

export const deadlineSchema = z.object({
  title: zText(),
  kind: zText(40),
  startDate: zDate(),
  days: zInt(1),
  assigneeId: zOptId(),
});
