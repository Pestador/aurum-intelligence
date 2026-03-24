import { createProviderInterface, createProviderHealth, wrapProviderCall } from "./interfaces.js";

function nowIso() {
  return new Date().toISOString();
}

export function createMockMarketProvider(overrides = {}) {
  const provider = createProviderInterface("market", {
    async getSnapshot({ symbol = "XAU/USD" } = {}) {
      return {
        status: "ok",
        symbol,
        timestampUtc: nowIso(),
        source: "mock-market",
        session: "london",
        candles: {
          "1h": [],
          "4h": [],
          "1d": [],
        },
        levels: [
          { price: 2245.2, kind: "support" },
          { price: 2261.8, kind: "resistance" },
        ],
        health: createProviderHealth({ ok: true, status: "mock" }),
      };
    },
  });

  return {
    ...provider,
    ...overrides,
    getSnapshot: wrapProviderCall("market", "getSnapshot", overrides.getSnapshot || provider.getSnapshot),
  };
}
