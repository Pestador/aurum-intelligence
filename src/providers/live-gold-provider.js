const DEFAULT_URL = "https://www.alphavantage.co/query";

function nowIso() {
  return new Date().toISOString();
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toNumber(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildUrl(baseUrl, params) {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Live provider HTTP ${response.status}`);
  }
  return response.json();
}

function alphaError(data) {
  return data?.["Error Message"] || data?.Information || data?.Note || null;
}

function normalizeTimestamp(value, fallback = nowIso()) {
  if (!value) return fallback;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct.toISOString();
  const withUtc = new Date(`${value} UTC`);
  if (!Number.isNaN(withUtc.getTime())) return withUtc.toISOString();
  return fallback;
}

function detectSession(timestampUtc = nowIso()) {
  const timestamp = new Date(timestampUtc);
  const hour = timestamp.getUTCHours();
  if (hour >= 22 || hour < 2) return { name: "asia", minutesToTransition: hour >= 22 ? (26 - hour) * 60 : (2 - hour) * 60 };
  if (hour >= 7 && hour < 13) return { name: "london", minutesToTransition: (13 - hour) * 60 };
  if (hour >= 13 && hour < 18) return { name: "new_york", minutesToTransition: (18 - hour) * 60 };
  if (hour >= 20 && hour < 22) return { name: "rollover", minutesToTransition: (22 - hour) * 60 };
  return { name: "off_hours", minutesToTransition: null };
}

function extractArrayLikeData(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.prices)) return payload.prices;
  if (Array.isArray(payload?.items)) return payload.items;
  return null;
}

function extractSeriesObject(payload) {
  if (!payload || typeof payload !== "object") return null;
  const seriesKey = Object.keys(payload).find((key) => /Time Series|FX|data/i.test(key));
  return seriesKey ? payload[seriesKey] : null;
}

function parseSpotPayload(payload) {
  const candidates = [
    payload,
    payload?.data?.[0],
    payload?.items?.[0],
    payload?.prices?.[0],
  ].filter(Boolean);

  for (const candidate of candidates) {
    const price = toNumber(candidate?.price ?? candidate?.value ?? candidate?.close ?? candidate?.["5. Exchange Rate"], null);
    if (price == null) continue;
    return {
      price,
      timestampUtc: normalizeTimestamp(
        candidate?.timestamp
          || candidate?.updatedAt
          || candidate?.date
          || candidate?.["6. Last Refreshed"],
      ),
      raw: candidate,
    };
  }

  return null;
}

function historyEntryToCandle(entry, previousClose) {
  const timestampUtc = normalizeTimestamp(entry?.timestamp || entry?.date || entry?.time);
  const close = toNumber(entry?.close ?? entry?.price ?? entry?.value, null);
  if (close == null) return null;
  const open = toNumber(entry?.open, previousClose ?? close);
  const high = toNumber(entry?.high, Math.max(open, close));
  const low = toNumber(entry?.low, Math.min(open, close));
  return {
    timestamp: timestampUtc,
    open: round(open),
    high: round(high),
    low: round(low),
    close: round(close),
  };
}

function parseHistoryPayload(payload) {
  const directRows = extractArrayLikeData(payload);
  if (directRows) {
    const sortedRows = [...directRows]
      .filter(Boolean)
      .sort((a, b) => new Date(a.date || a.timestamp || a.time || 0).getTime() - new Date(b.date || b.timestamp || b.time || 0).getTime());
    const candles = [];
    let previousClose = null;
    for (const row of sortedRows) {
      const candle = historyEntryToCandle(row, previousClose);
      if (!candle) continue;
      candles.push(candle);
      previousClose = candle.close;
    }
    return candles;
  }

  const series = extractSeriesObject(payload);
  if (series && typeof series === "object") {
    const rows = Object.entries(series)
      .map(([timestamp, values]) => ({
        timestamp,
        open: values?.["1. open"] ?? values?.open,
        high: values?.["2. high"] ?? values?.high,
        low: values?.["3. low"] ?? values?.low,
        close: values?.["4. close"] ?? values?.["5. price"] ?? values?.close ?? values?.value,
      }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const candles = [];
    let previousClose = null;
    for (const row of rows) {
      const candle = historyEntryToCandle(row, previousClose);
      if (!candle) continue;
      candles.push(candle);
      previousClose = candle.close;
    }
    return candles;
  }

  return [];
}

function parseIntradayPayload(payload) {
  const candles = parseHistoryPayload(payload);
  return candles.slice(-120);
}

function groupCandles(candles = [], groupSize = 4) {
  const groups = [];
  for (let index = 0; index < candles.length; index += groupSize) {
    const group = candles.slice(index, index + groupSize);
    if (group.length < groupSize) continue;
    groups.push(group);
  }
  return groups;
}

function aggregateCandles(candles = [], groupSize = 4) {
  return groupCandles(candles, groupSize).map((group) => ({
    timestamp: group.at(-1)?.timestamp ?? nowIso(),
    open: round(group[0].open),
    high: round(Math.max(...group.map((candle) => candle.high))),
    low: round(Math.min(...group.map((candle) => candle.low))),
    close: round(group.at(-1).close),
  }));
}

function pickPriceFromCandles(candles = [], key = "close", fallback = 0) {
  const values = candles.map((candle) => toNumber(candle?.[key], null)).filter(Number.isFinite);
  if (!values.length) return fallback;
  return values.at(-1);
}

function summarizeCoverage({ intraday15m, intraday60m, daily }) {
  const notes = [];
  if (intraday15m.length) {
    notes.push("15-minute intraday candles available.");
  } else {
    notes.push("15-minute intraday candles unavailable; trigger-quality analysis will be limited.");
  }

  if (intraday60m.length) {
    notes.push("60-minute intraday candles available.");
  } else {
    notes.push("60-minute intraday candles unavailable; liquidity/session analysis may degrade.");
  }

  if (daily.length) {
    notes.push("Daily history available for higher-timeframe context.");
  } else {
    notes.push("Daily history unavailable; higher-timeframe structure will degrade.");
  }

  return notes;
}

function buildSnapshot({
  symbol,
  spot,
  dailyCandles,
  intraday15m,
  intraday60m,
}) {
  const timestampUtc = spot?.timestampUtc || intraday15m.at(-1)?.timestamp || intraday60m.at(-1)?.timestamp || dailyCandles.at(-1)?.timestamp || nowIso();
  const currentPrice = round(
    spot?.price
      ?? pickPriceFromCandles(intraday15m)
      ?? pickPriceFromCandles(intraday60m)
      ?? pickPriceFromCandles(dailyCandles),
  );
  const latest15m = intraday15m.slice(-96);
  const latest1h = intraday60m.length ? intraday60m.slice(-72) : aggregateCandles(latest15m, 4).slice(-72);
  const latest4h = latest1h.length ? aggregateCandles(latest1h, 4).slice(-52) : [];
  const currentSessionCandles = latest15m.slice(-24);
  const priceHigh = currentSessionCandles.length
    ? Math.max(...currentSessionCandles.map((candle) => candle.high))
    : currentPrice;
  const priceLow = currentSessionCandles.length
    ? Math.min(...currentSessionCandles.map((candle) => candle.low))
    : currentPrice;

  const dataNotes = summarizeCoverage({
    intraday15m: latest15m,
    intraday60m: latest1h,
    daily: dailyCandles,
  });

  const degraded = !latest15m.length || !latest1h.length || !dailyCandles.length;
  const healthScore = clamp(
    (latest15m.length ? 0.4 : 0.05)
      + (latest1h.length ? 0.25 : 0.05)
      + (dailyCandles.length ? 0.25 : 0.05)
      + (spot?.price ? 0.1 : 0),
    0,
    1,
  );

  return {
    status: "ok",
    symbol,
    timestampUtc,
    lastPrice: currentPrice,
    preferredHigherTimeframe: "1d",
    session: detectSession(timestampUtc),
    price: {
      current: currentPrice,
      sessionOpen: currentSessionCandles[0]?.open ?? currentPrice,
      dayHigh: round(priceHigh),
      dayLow: round(priceLow),
    },
    rates: {
      usdTrend: "unknown",
      realYieldTrend: "unknown",
      nominalYieldTrend: "unknown",
      correlationState: "unknown",
    },
    macro: {
      inflationSurprise: "unknown",
      fedTone: "unknown",
      safeHavenDemand: "unknown",
      riskSentiment: "unknown",
      summary: "Live gold pricing is loaded, but macro overlays are still neutral unless separate macro providers are configured.",
    },
    calendar: {
      nextHighImpactMinutes: 9999,
      policyTone: "unknown",
      nextEvents: [],
    },
    positioning: {
      futuresCrowding: "unknown",
      etfFlow: "unknown",
      geopolitics: "unknown",
      intermarket: "unknown",
    },
    timeframes: {
      "15m": { candles: latest15m },
      "1h": { candles: latest1h },
      "4h": { candles: latest4h },
      "1d": { candles: dailyCandles.slice(-120) },
    },
    liveData: {
      mode: "live",
      provider: "alpha-vantage",
      degraded,
      notes: dataNotes,
      coverage: {
        spot: Boolean(spot?.price),
        intraday15m: latest15m.length,
        intraday1h: latest1h.length,
        higherTimeframeDaily: dailyCandles.length,
      },
    },
    health: {
      ok: true,
      degraded,
      freshnessScore: round(healthScore, 2),
      agreementScore: spot?.price && latest15m.length ? 0.92 : 0.55,
      source: "alpha-vantage",
    },
    source: "live-alpha-vantage",
  };
}

function buildErrorSnapshot(symbol, reason, details = {}) {
  return {
    status: "error",
    symbol,
    timestampUtc: nowIso(),
    source: "live-alpha-vantage",
    liveData: {
      mode: "live",
      degraded: true,
      notes: [reason],
      coverage: {
        spot: false,
        intraday15m: 0,
        intraday1h: 0,
        higherTimeframeDaily: 0,
      },
    },
    health: {
      ok: false,
      degraded: true,
      freshnessScore: 0,
      agreementScore: 0,
      reason,
      ...details,
    },
  };
}

async function fetchAlphaSeries(baseUrl, params, optional = false) {
  const data = await fetchJson(buildUrl(baseUrl, params));
  const error = alphaError(data);
  if (error) {
    if (optional) return { ok: false, error, data };
    throw new Error(error);
  }
  return { ok: true, data };
}

export function createLiveGoldProvider({
  apiKey = process.env.ALPHAVANTAGE_KEY,
  baseUrl = process.env.ALPHAVANTAGE_URL || DEFAULT_URL,
  spotSymbol = process.env.AURUM_ALPHA_GOLD_SYMBOL || "XAU",
  intradayFromCurrency = process.env.AURUM_ALPHA_INTRADAY_FROM || "XAU",
  intradayToCurrency = process.env.AURUM_ALPHA_INTRADAY_TO || "USD",
} = {}) {
  return {
    async getSnapshot({ symbol = "XAU/USD" } = {}) {
      if (!apiKey) {
        return buildErrorSnapshot(symbol, "ALPHAVANTAGE_KEY missing", { missingApiKey: true });
      }

      try {
        const [spotResult, dailyHistoryResult, intraday15mResult, intraday60mResult] = await Promise.all([
          fetchAlphaSeries(baseUrl, {
            function: "GOLD_SILVER_SPOT",
            symbol: spotSymbol,
            apikey: apiKey,
          }),
          fetchAlphaSeries(baseUrl, {
            function: "GOLD_SILVER_HISTORY",
            symbol: spotSymbol,
            interval: "daily",
            apikey: apiKey,
          }, true),
          fetchAlphaSeries(baseUrl, {
            function: "FX_INTRADAY",
            from_symbol: intradayFromCurrency,
            to_symbol: intradayToCurrency,
            interval: "15min",
            outputsize: "compact",
            apikey: apiKey,
          }, true),
          fetchAlphaSeries(baseUrl, {
            function: "FX_INTRADAY",
            from_symbol: intradayFromCurrency,
            to_symbol: intradayToCurrency,
            interval: "60min",
            outputsize: "compact",
            apikey: apiKey,
          }, true),
        ]);

        const spot = parseSpotPayload(spotResult.data);
        if (!spot) {
          return buildErrorSnapshot(symbol, "Live gold spot quote could not be parsed.");
        }

        const dailyCandles = dailyHistoryResult.ok ? parseHistoryPayload(dailyHistoryResult.data) : [];
        const intraday15m = intraday15mResult.ok ? parseIntradayPayload(intraday15mResult.data) : [];
        const intraday60m = intraday60mResult.ok ? parseIntradayPayload(intraday60mResult.data) : [];

        return buildSnapshot({
          symbol,
          spot,
          dailyCandles,
          intraday15m,
          intraday60m,
        });
      } catch (error) {
        return buildErrorSnapshot(symbol, error.message || "Live provider fetch failed", {
          fetchError: true,
        });
      }
    },
  };
}
