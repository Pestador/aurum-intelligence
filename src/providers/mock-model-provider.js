import { createProviderInterface, createProviderHealth, wrapProviderCall } from "./interfaces.js";

export function createMockModelProvider(overrides = {}) {
  const provider = createProviderInterface("model", {
    async generate({ prompt = "", context = {} } = {}) {
      return {
        status: "ok",
        source: "mock-model",
        promptLength: prompt.length,
        context,
        text: "Mock model output. Replace with a real provider when integrating.",
        health: createProviderHealth({ ok: true, status: "mock" }),
      };
    },
  });

  return {
    ...provider,
    ...overrides,
    generate: wrapProviderCall("model", "generate", overrides.generate || provider.generate),
  };
}
