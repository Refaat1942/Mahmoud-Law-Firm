import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, maskSecret } from "../../src/lib/crypto";
import { DEFAULT_AI, aiReady, resolveBaseUrl } from "../../src/lib/ai/providers";

describe("secret encryption", () => {
  it("round-trips and uses a fresh IV each time", () => {
    const a = encryptSecret("sk-test-1234567890", "secret-a");
    const b = encryptSecret("sk-test-1234567890", "secret-a");
    expect(a).not.toBe(b);
    expect(decryptSecret(a, "secret-a")).toBe("sk-test-1234567890");
  });

  it("rejects another secret, tampering and garbage", () => {
    const a = encryptSecret("sk-test", "secret-a");
    expect(decryptSecret(a, "secret-b")).toBeNull();
    const parts = a.split(":");
    parts[3] = Buffer.from("x").toString("base64");
    expect(decryptSecret(parts.join(":"), "secret-a")).toBeNull();
    expect(decryptSecret("nope", "secret-a")).toBeNull();
    expect(decryptSecret(null, "secret-a")).toBeNull();
  });

  it("masks keys for display", () => {
    expect(maskSecret("sk-abcdefghijkl")).toBe("sk-…ijkl");
    expect(maskSecret(null)).toBe("");
  });
});

describe("providers", () => {
  it("resolves the base URL", () => {
    expect(resolveBaseUrl({ provider: "openai", baseUrl: "" })).toBe("https://api.openai.com/v1");
    expect(resolveBaseUrl({ provider: "custom", baseUrl: "https://llm.example.ae/v1/" })).toBe("https://llm.example.ae/v1");
    expect(resolveBaseUrl({ provider: "custom", baseUrl: "" })).toBe("");
  });

  it("is ready only when enabled with a model and a key", () => {
    const s = { ...DEFAULT_AI, enabled: true, model: "m" };
    expect(aiReady(s, "k")).toBe(true);
    expect(aiReady({ ...s, enabled: false }, "k")).toBe(false);
    expect(aiReady({ ...s, model: "" }, "k")).toBe(false);
    expect(aiReady(s, null)).toBe(false);
  });
});
