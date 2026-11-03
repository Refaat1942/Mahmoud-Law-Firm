import { z } from "zod";
import { AI_PROVIDERS, type AiProvider } from "@/lib/ai/providers";

const bool = () => z.preprocess((v) => v === true || v === "true" || v === "on", z.boolean());

export const aiSettingsSchema = z.object({
  enabled: bool(),
  provider: z.enum(Object.keys(AI_PROVIDERS) as [AiProvider, ...AiProvider[]], { errorMap: () => ({ message: "v.required" }) }),
  baseUrl: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().url("v.url").max(300).optional()),
  model: z.preprocess((v) => v ?? "", z.string().trim().max(120)),
  /** Write-only: empty keeps the stored key. */
  apiKey: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().max(500).optional()),
  dailyBriefing: bool(),
  briefingHour: z.preprocess((v) => (v === "" || v === undefined ? 7 : Number(v)), z.number({ errorMap: () => ({ message: "v.number" }) }).int().min(0).max(23)),
});
