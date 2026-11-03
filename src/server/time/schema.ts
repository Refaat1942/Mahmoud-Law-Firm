import { z } from "zod";
import { zBool, zDate, zId, zMoney, zOptId, zText } from "../common";

export const timeEntrySchema = z.object({
  matterId: zId(),
  date: zDate(),
  hours: z.preprocess((v) => (v === "" ? undefined : Number(v)), z.number({ errorMap: () => ({ message: "v.number" }) }).gt(0, "v.min0").max(24, "v.number")),
  description: zText(2000),
  billable: zBool(),
});

export const rateSchema = z
  .object({ userId: zOptId(), clientId: zOptId(), amount: zMoney() })
  .refine((r) => !!r.userId || !!r.clientId, { message: "v.required", path: ["userId"] });
