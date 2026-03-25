import test from "node:test";
import assert from "node:assert/strict";

import { createLiveGoldProvider } from "../src/providers/live-gold-provider.js";

function buildJsonResponse(body) {
  return {
    ok: true,
    async json() {
      return body;
    },
  };
}

test("live gold provider returns a structured snapshot when spot/history/intraday data are available", async () => {
  const originalFetch = global.fetch;

  global.fetch = async (url) => {
    const parsed = new URL(url);
    const fn = parsed.searchParams.get("function");
    const interval = parsed.searchParams.get("interval");

    if (fn === "GOLD_SILVER_SPOT") {
      return buildJsonResponse({
        symbol: "XAU",
        price: "3021.45",
        timestamp: "2026-03-25T09:30:00Z",
      });
    }

    if (fn === "GOLD_SILVER_HISTORY") {
      return buildJsonResponse({
        data: [
          { date: "2026-03-20", price: "2995.10" },
          { date: "2026-03-21", price: "3002.40" },
          { date: "2026-03-22", price: "3010.25" },
          { date: "2026-03-23", price: "3016.10" },
          { date: "2026-03-24", price: "3019.75" },
        ],
      });
    }

    if (fn === "FX_INTRADAY" && interval === "15min") {
      return buildJsonResponse({
        "Time Series FX (15min)": {
          "2026-03-25 08:15:00": { "1. open": "3018.20", "2. high": "3020.10", "3. low": "3017.80", "4. close": "3019.90" },
          "2026-03-25 08:30:00": { "1. open": "3019.90", "2. high": "3021.60", "3. low": "3019.40", "4. close": "3021.20" },
          "2026-03-25 08:45:00": { "1. open": "3021.20", "2. high": "3022.10", "3. low": "3020.50", "4. close": "3021.70" },
          "2026-03-25 09:00:00": { "1. open": "3021.70", "2. high": "3022.45", "3. low": "3021.10", "4. close": "3021.95" },
          "2026-03-25 09:15:00": { "1. open": "3021.95", "2. high": "3022.90", "3. low": "3021.20", "4. close": "3022.10" },
          "2026-03-25 09:30:00": { "1. open": "3022.10", "2. high": "3022.80", "3. low": "3021.60", "4. close": "3022.35" },
          "2026-03-25 09:45:00": { "1. open": "3022.35", "2. high": "3023.20", "3. low": "3021.90", "4. close": "3022.80" },
          "2026-03-25 10:00:00": { "1. open": "3022.80", "2. high": "3023.60", "3. low": "3022.20", "4. close": "3023.10" },
        },
      });
    }

    if (fn === "FX_INTRADAY" && interval === "60min") {
      return buildJsonResponse({
        "Time Series FX (60min)": {
          "2026-03-25 06:00:00": { "1. open": "3012.40", "2. high": "3016.80", "3. low": "3011.90", "4. close": "3015.60" },
          "2026-03-25 07:00:00": { "1. open": "3015.60", "2. high": "3019.40", "3. low": "3014.80", "4. close": "3018.70" },
          "2026-03-25 08:00:00": { "1. open": "3018.70", "2. high": "3022.20", "3. low": "3018.10", "4. close": "3021.10" },
          "2026-03-25 09:00:00": { "1. open": "3021.10", "2. high": "3023.80", "3. low": "3020.80", "4. close": "3023.15" },
        },
      });
    }

    return buildJsonResponse({ Note: `Unexpected endpoint: ${url}` });
  };

  try {
    const provider = createLiveGoldProvider({ apiKey: "test-key" });
    const snapshot = await provider.getSnapshot({ symbol: "XAU/USD" });

    assert.equal(snapshot.status, "ok");
    assert.equal(snapshot.symbol, "XAU/USD");
    assert.equal(snapshot.source, "live-alpha-vantage");
    assert.equal(snapshot.liveData.mode, "live");
    assert.equal(snapshot.health.ok, true);
    assert.ok(snapshot.timeframes["15m"].candles.length >= 8);
    assert.ok(snapshot.timeframes["1h"].candles.length >= 4);
    assert.ok(snapshot.timeframes["1d"].candles.length >= 5);
    assert.ok(Number.isFinite(snapshot.price.current));
  } finally {
    global.fetch = originalFetch;
  }
});

test("live gold provider returns an error snapshot when the API key is missing", async () => {
  const provider = createLiveGoldProvider({ apiKey: "" });
  const snapshot = await provider.getSnapshot({ symbol: "XAU/USD" });

  assert.equal(snapshot.status, "error");
  assert.equal(snapshot.health.ok, false);
  assert.equal(snapshot.health.missingApiKey, true);
});
