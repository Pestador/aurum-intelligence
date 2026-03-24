import { goldBullishRetestFixture } from "../fixtures/gold-bullish-retest.mjs";
import { goldEventBlockedFixture } from "../fixtures/gold-event-blocked.mjs";

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function isoMinutesBefore(anchorIso, minutesBefore) {
  const anchor = new Date(anchorIso).getTime();
  return new Date(anchor - minutesBefore * 60_000).toISOString();
}

function generateTrendCandles({
  endTimeIso,
  count,
  intervalMinutes,
  startPrice,
  trendStep,
  wavePattern,
  wickSize = 0.6,
}) {
  const candles = [];
  let previousClose = startPrice;

  for (let index = 0; index < count; index += 1) {
    const pattern = wavePattern[index % wavePattern.length];
    const close = previousClose + trendStep + pattern;
    const open = previousClose + pattern * 0.25;
    const high = Math.max(open, close) + wickSize + Math.abs(pattern) * 0.2;
    const low = Math.min(open, close) - wickSize * 0.75 - Math.abs(pattern) * 0.1;
    const minutesBefore = (count - 1 - index) * intervalMinutes;
    candles.push({
      timestamp: isoMinutesBefore(endTimeIso, minutesBefore),
      open: round(open),
      high: round(high),
      low: round(low),
      close: round(close),
    });
    previousClose = close;
  }

  return candles;
}

function generateBullishIntradayCandles(endTimeIso) {
  const base = generateTrendCandles({
    endTimeIso,
    count: 28,
    intervalMinutes: 15,
    startPrice: 2314.2,
    trendStep: 0.38,
    wavePattern: [0.55, -0.22, 0.42, -0.18, 0.3, -0.52, 0.65, -0.2],
    wickSize: 0.52,
  });

  const tailored = [
    { open: 2323.6, high: 2325.2, low: 2322.9, close: 2324.8 },
    { open: 2324.9, high: 2326.2, low: 2324.4, close: 2325.8 },
    { open: 2325.8, high: 2327.0, low: 2325.0, close: 2326.4 },
    { open: 2326.3, high: 2327.4, low: 2325.3, close: 2325.7 },
    { open: 2325.6, high: 2326.0, low: 2324.8, close: 2325.1 },
    { open: 2325.0, high: 2326.4, low: 2324.9, close: 2326.2 },
    { open: 2326.2, high: 2327.1, low: 2325.8, close: 2326.8 },
    { open: 2326.7, high: 2327.8, low: 2326.2, close: 2327.4 },
  ].map((candle, index) => ({
    ...candle,
    timestamp: isoMinutesBefore(endTimeIso, (7 - index) * 15),
  }));

  return [...base.slice(0, -8), ...tailored];
}

function generateEventBlockedIntradayCandles(endTimeIso) {
  const base = generateTrendCandles({
    endTimeIso,
    count: 28,
    intervalMinutes: 15,
    startPrice: 2325.4,
    trendStep: 0.21,
    wavePattern: [0.4, -0.28, 0.35, -0.32, 0.18, -0.41, 0.24, -0.36],
    wickSize: 0.65,
  });

  const tailored = [
    { open: 2331.6, high: 2334.0, low: 2330.8, close: 2333.4 },
    { open: 2333.4, high: 2335.1, low: 2332.7, close: 2334.3 },
    { open: 2334.2, high: 2335.2, low: 2332.8, close: 2333.0 },
    { open: 2333.1, high: 2334.0, low: 2331.8, close: 2332.2 },
    { open: 2332.1, high: 2333.8, low: 2331.5, close: 2333.5 },
    { open: 2333.5, high: 2334.4, low: 2332.4, close: 2333.0 },
    { open: 2333.0, high: 2334.1, low: 2332.2, close: 2333.7 },
    { open: 2333.7, high: 2335.0, low: 2333.1, close: 2334.9 },
  ].map((candle, index) => ({
    ...candle,
    timestamp: isoMinutesBefore(endTimeIso, (7 - index) * 15),
  }));

  return [...base.slice(0, -8), ...tailored];
}

function buildSnapshot(baseFixture, timeframes) {
  const snapshot = structuredClone(baseFixture.marketSnapshot);
  snapshot.lastPrice = snapshot.price.current;
  snapshot.timeframes = timeframes;
  snapshot.status = "ok";
  snapshot.health = {
    ok: true,
    freshnessScore: 0.98,
    agreementScore: 0.95,
  };
  return snapshot;
}

export function createFixtureLibrary() {
  const bullish4h = generateTrendCandles({
    endTimeIso: goldBullishRetestFixture.marketSnapshot.timestampUtc,
    count: 52,
    intervalMinutes: 240,
    startPrice: 2226.4,
    trendStep: 2.0,
    wavePattern: [1.8, -1.1, 1.4, -0.6, 1.9, -1.4, 1.5, -0.8],
    wickSize: 2.1,
  });
  const bullish1h = generateTrendCandles({
    endTimeIso: goldBullishRetestFixture.marketSnapshot.timestampUtc,
    count: 56,
    intervalMinutes: 60,
    startPrice: 2291.5,
    trendStep: 0.72,
    wavePattern: [0.55, -0.48, 0.62, -0.3, 0.46, -0.62, 0.58, -0.24],
    wickSize: 0.95,
  });
  const bullish15m = generateBullishIntradayCandles(goldBullishRetestFixture.marketSnapshot.timestampUtc);

  const blocked4h = generateTrendCandles({
    endTimeIso: goldEventBlockedFixture.marketSnapshot.timestampUtc,
    count: 52,
    intervalMinutes: 240,
    startPrice: 2238.8,
    trendStep: 1.65,
    wavePattern: [1.6, -1.35, 1.0, -0.85, 1.5, -1.2, 1.2, -0.72],
    wickSize: 2.0,
  });
  const blocked1h = generateTrendCandles({
    endTimeIso: goldEventBlockedFixture.marketSnapshot.timestampUtc,
    count: 56,
    intervalMinutes: 60,
    startPrice: 2304.4,
    trendStep: 0.54,
    wavePattern: [0.4, -0.52, 0.48, -0.44, 0.3, -0.58, 0.35, -0.41],
    wickSize: 1.05,
  });
  const blocked15m = generateEventBlockedIntradayCandles(goldEventBlockedFixture.marketSnapshot.timestampUtc);

  return {
    bullishRetest: {
      name: "bullishRetest",
      description: "Bullish London-session retest with supportive macro backdrop.",
      workflowId: goldBullishRetestFixture.workflowId,
      userProfile: structuredClone(goldBullishRetestFixture.userProfile),
      marketSnapshot: buildSnapshot(goldBullishRetestFixture, {
        "15m": { candles: bullish15m },
        "1h": { candles: bullish1h },
        "4h": { candles: bullish4h },
      }),
    },
    eventBlocked: {
      name: "eventBlocked",
      description: "Technically active market suppressed by imminent high-impact event risk.",
      workflowId: goldEventBlockedFixture.workflowId,
      userProfile: structuredClone(goldEventBlockedFixture.userProfile),
      marketSnapshot: buildSnapshot(goldEventBlockedFixture, {
        "15m": { candles: blocked15m },
        "1h": { candles: blocked1h },
        "4h": { candles: blocked4h },
      }),
    },
  };
}

export function getFixtureByName(name = "bullishRetest") {
  const fixtures = createFixtureLibrary();
  return fixtures[name] || fixtures.bullishRetest;
}
