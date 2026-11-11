import { z } from "zod";
import { COURT_UPDATE_KINDS, EXECUTION_TYPES } from "@/lib/courts";
import { zBool, zDate, zEnum, zFile, zId, zOptDate, zOptId, zOptMoney, zOptText, zText } from "../common";

export const filingSchema = z.object({
  kind: zEnum(["REQUEST", "COMMUNICATION"]),
  direction: zEnum(["SUBMITTED", "RECEIVED"]),
  matterId: zId(),
  title: zText(),
  reference: zOptText(100),
  status: zEnum(["PENDING", "SUBMITTED", "UNDER_REVIEW", "ACCEPTED", "REJECTED", "ANSWERED", "CLOSED"]),
  submittedAt: zOptDate(),
  responseDueAt: zOptDate(),
  respondedAt: zOptDate(),
  followUpAt: zOptDate(),
  response: zOptText(),
  assigneeId: zOptId(),
  notes: zOptText(),
});

export const executionActionSchema = z.object({
  type: zEnum(EXECUTION_TYPES),
  date: zDate(),
  title: zText(),
  details: zOptText(),
  amount: zOptMoney(),
});

export const courtUpdateSchema = z
  .object({
    courtSystem: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["ADJD", "DUBAI", "MOJ", "OTHER"]).optional()),
    courtCaseNo: zText(100),
    matterId: zOptId(),
    kind: zEnum(COURT_UPDATE_KINDS),
    executionType: z.preprocess((v) => (v === "" ? undefined : v), z.enum(EXECUTION_TYPES).optional()),
    occurredAt: zDate(),
    title: zText(),
    details: zOptText(),
    amount: zOptMoney(),
    nextHearingAt: zOptDate(),
  })
  .refine((u) => u.kind !== "EXECUTION" || !!u.executionType, { message: "v.required", path: ["executionType"] });

export const applyUpdateSchema = z
  .object({
    matterId: zId(),
    createTask: zBool(),
    taskTitle: zOptText(300),
    taskDueDate: zOptDate(),
  })
  .refine((a) => !a.createTask || (!!a.taskTitle && !!a.taskDueDate), { message: "v.required", path: ["taskTitle"] });

export const updatesCsvSchema = z.object({ file: zFile() });
