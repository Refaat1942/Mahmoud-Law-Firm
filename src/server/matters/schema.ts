import { z } from "zod";
import { zDate, zEnum, zId, zMoney, zOptDate, zOptId, zOptMoney, zOptText, zText } from "../common";

export const matterSchema = z.object({
  titleAr: zText(),
  titleEn: zOptText(300),
  clientId: zId(),
  clientRole: zOptText(100),
  typeId: zOptId(),
  level: zEnum(["FIRST_INSTANCE", "APPEAL", "CASSATION", "EXECUTION", "ARBITRATION", "CONSULTATION"]),
  courtId: zOptId(),
  courtCaseNo: zOptText(60),
  status: zEnum(["OPEN", "ON_HOLD", "CLOSED"]),
  outcome: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["WON", "LOST", "SETTLED", "PARTIAL"]).optional()),
  stage: zOptText(200),
  claimAmount: zOptMoney(),
  openedAt: zDate(),
  closedAt: zOptDate(),
  parentId: zOptId(),
  responsibleId: zOptId(),
  description: zOptText(),
});

export const matterPartySchema = z.object({
  partyId: zOptId(),
  newPartyName: zOptText(300),
  role: zEnum(["OPPONENT", "OPPONENT_LAWYER", "EXPERT", "WITNESS", "OTHER"]),
  notes: zOptText(500),
}).refine((v) => !!v.partyId || !!v.newPartyName, { message: "v.required", path: ["partyId"] });

export const memberSchema = z.object({ userId: zId(), role: zEnum(["LEAD", "MEMBER"]) });

export const eventSchema = z.object({ title: zText(), details: zOptText() });

export const feeAgreementSchema = z.object({
  type: zEnum(["FIXED", "HOURLY", "PERCENTAGE", "INSTALLMENTS"]),
  amount: zOptMoney(),
  percentage: zOptMoney(),
  hourlyRate: zOptMoney(),
  signedAt: zOptDate(),
  notes: zOptText(),
});

export const installmentSchema = z.object({ dueDate: zDate(), amount: zMoney(), description: zOptText(300) });
