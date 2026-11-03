/** OpenAI-compatible chat-completions endpoints; "custom" takes any base URL (self-hosted or other vendors). */
export const AI_PROVIDERS = {
  openai: { baseUrl: "https://api.openai.com/v1" },
  gemini: { baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai" },
  deepseek: { baseUrl: "https://api.deepseek.com/v1" },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1" },
  custom: { baseUrl: "" },
} as const;

export type AiProvider = keyof typeof AI_PROVIDERS;

export type AiSettings = {
  enabled: boolean;
  provider: AiProvider;
  baseUrl: string;
  model: string;
  /** Encrypted with encryptSecret; never sent to the browser. */
  apiKeyEnc: string | null;
  dailyBriefing: boolean;
  /** Hour of the day (Asia/Dubai) for the morning briefing. */
  briefingHour: number;
};

export const DEFAULT_AI: AiSettings = { enabled: false, provider: "openai", baseUrl: "", model: "", apiKeyEnc: null, dailyBriefing: false, briefingHour: 7 };

/** Base URL without a trailing slash: the custom URL when set, otherwise the provider's. */
export function resolveBaseUrl(s: Pick<AiSettings, "provider" | "baseUrl">) {
  const url = (s.baseUrl || AI_PROVIDERS[s.provider]?.baseUrl || "").trim();
  return url.replace(/\/+$/, "");
}

/** Ready when enabled with an endpoint, a model and a key. */
export const aiReady = (s: AiSettings, apiKey: string | null) => s.enabled && !!resolveBaseUrl(s) && !!s.model && !!apiKey;
