"use server";

import { getLocale } from "next-intl/server";
import { z } from "zod";
import { ActionError, defineAction } from "@/lib/action";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { AiError, chatCompletion, listModels, type ChatMessage } from "@/lib/ai/client";
import { aiReady } from "@/lib/ai/providers";
import { aiSettingsSchema } from "./schema";
import { getAiSettings, getOffice, setSetting } from "@/lib/settings";
import { systemPrompt } from "./prompt";
import { runTool, toolsFor, type AssistantAction } from "./tools";

const MAX_TOOL_ROUNDS = 6;
const MAX_HISTORY = 20;

const askSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) }))
    .min(1)
    .max(60),
});

const providerError = (e: unknown) => {
  if (e instanceof AiError) {
    if (e.status === 401 || e.status === 403) return "assistant.errors.auth";
    if (e.status === 404) return "assistant.errors.model";
    if (e.status === 429) return "assistant.errors.rate";
    return "assistant.errors.provider";
  }
  return "errors.unexpected";
};

/** One assistant turn: the model may call tools (scoped to the user) several times before answering. */
export const askAssistant = defineAction({ module: "dashboard", perm: "view", entity: "Assistant", schema: askSchema }, async ({ messages }, { user }) => {
  const settings = await getAiSettings();
  const apiKey = decryptSecret(settings.apiKeyEnc);
  if (!aiReady(settings, apiKey)) throw new ActionError("assistant.errors.notConfigured");
  const locale = await getLocale();
  const tools = toolsFor(user);
  const history: ChatMessage[] = [{ role: "system", content: systemPrompt(user, await getOffice(), locale) }, ...messages.slice(-MAX_HISTORY)];
  const actions: AssistantAction[] = [];
  const used: string[] = [];
  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const reply = await chatCompletion(settings, apiKey!, history, round < MAX_TOOL_ROUNDS ? tools : undefined);
      if (!reply.tool_calls.length) {
        return { data: { reply: reply.content ?? "", actions }, audit: { tools: used, chars: messages.at(-1)?.content.length } };
      }
      history.push({ role: "assistant", content: reply.content, tool_calls: reply.tool_calls });
      for (const call of reply.tool_calls) {
        used.push(call.function.name);
        history.push({ role: "tool", tool_call_id: call.id, content: await runTool(user, call.function.name, call.function.arguments, actions) });
      }
    }
  } catch (e) {
    if (e instanceof ActionError) throw e;
    console.error("[assistant]", e);
    throw new ActionError(providerError(e));
  }
  throw new ActionError("assistant.errors.provider");
});


/** Saves the AI settings; an empty key field keeps the stored key. The key is stored encrypted. */
export const saveAiSettings = defineAction({ module: "settings", perm: "update", entity: "Setting", schema: aiSettingsSchema }, async ({ apiKey, ...input }) => {
  const current = await getAiSettings();
  if (input.provider === "custom" && !input.baseUrl) throw new ActionError("assistant.errors.baseUrl");
  await setSetting("ai", { ...current, ...input, baseUrl: input.baseUrl ?? "", apiKeyEnc: apiKey ? encryptSecret(apiKey) : current.apiKeyEnc });
  return { id: "ai", audit: { ...input, keyChanged: !!apiKey } };
});

export const clearAiKey = defineAction({ module: "settings", perm: "update", entity: "Setting" }, async () => {
  await setSetting("ai", { ...(await getAiSettings()), apiKeyEnc: null, enabled: false });
  return { id: "ai" };
});

/** Checks the stored key against the provider and returns the models it can use. */
export const testAiConnection = defineAction({ module: "settings", perm: "update", entity: "Setting" }, async () => {
  const settings = await getAiSettings();
  const apiKey = decryptSecret(settings.apiKeyEnc);
  if (!apiKey) throw new ActionError("assistant.errors.noKey");
  try {
    const models = await listModels(settings, apiKey);
    return { id: "ai", data: { models: models.slice(0, 200), hasModel: !settings.model || models.includes(settings.model) } };
  } catch (e) {
    console.error("[assistant test]", e);
    throw new ActionError(providerError(e));
  }
});
