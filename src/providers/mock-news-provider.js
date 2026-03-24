import { createProviderInterface, createProviderHealth, wrapProviderCall } from "./interfaces.js";

function nowIso() {
  return new Date().toISOString();
}

export function createMockNewsProvider(overrides = {}) {
  const provider = createProviderInterface("news", {
    async getFeed() {
      return {
        status: "ok",
        timestampUtc: nowIso(),
        source: "mock-news",
        items: [
          {
            headline: "Mock macro headline for gold intelligence runtime",
            impact: "medium",
            timestampUtc: nowIso(),
          },
        ],
        health: createProviderHealth({ ok: true, status: "mock" }),
      };
    },
  });

  return {
    ...provider,
    ...overrides,
    getFeed: wrapProviderCall("news", "getFeed", overrides.getFeed || provider.getFeed),
  };
}
