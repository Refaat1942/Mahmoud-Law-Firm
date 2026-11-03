import { resolveBaseUrl, type AiSettings } from "./providers";

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

export type ToolSpec = { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } };

export class AiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const TIMEOUT_MS = 90_000;

async function call(settings: AiSettings, apiKey: string, path: string, init: RequestInit = {}) {
  const base = resolveBaseUrl(settings);
  if (!base) throw new AiError(0, "No API endpoint configured");
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    throw new AiError(0, e instanceof Error ? e.message : "Network error");
  }
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    const err = (body as { error?: { message?: string } } | { error?: { message?: string } }[] | null) ?? null;
    const msg = (Array.isArray(err) ? err[0]?.error?.message : err?.error?.message) ?? text.slice(0, 300);
    throw new AiError(res.status, msg || res.statusText);
  }
  return body;
}

/** One OpenAI-compatible chat-completions round; returns the assistant message. */
export async function chatCompletion(settings: AiSettings, apiKey: string, messages: ChatMessage[], tools?: ToolSpec[]) {
  const body = (await call(settings, apiKey, "/chat/completions", {
    method: "POST",
    body: JSON.stringify({ model: settings.model, messages, ...(tools?.length ? { tools, tool_choice: "auto" } : {}) }),
  })) as { choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[] };
  const msg = body?.choices?.[0]?.message;
  if (!msg) throw new AiError(502, "Empty response from the AI provider");
  return { content: msg.content ?? null, tool_calls: msg.tool_calls?.filter((c) => c.type === "function") ?? [] };
}

/** Model ids the key can use (to check the connection and help pick a model). */
export async function listModels(settings: AiSettings, apiKey: string) {
  const body = (await call(settings, apiKey, "/models")) as { data?: { id?: string }[] };
  return (body?.data ?? []).map((m) => (m.id ?? "").replace(/^models\//, "")).filter(Boolean).sort();
}
