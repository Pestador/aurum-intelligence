import { max, mean, min, safeDiv, toNumber } from "./numeric.js";

export function normalizeCandle(candle) {
  if (!candle) return null;
  const open = toNumber(candle.open, NaN);
  const high = toNumber(candle.high, NaN);
  const low = toNumber(candle.low, NaN);
  const close = toNumber(candle.close, NaN);
  if (![open, high, low, close].every(Number.isFinite)) return null;
  return {
    timestamp: candle.timestamp ?? candle.time ?? candle.t ?? null,
    open,
    high,
    low,
    close,
    volume: toNumber(candle.volume, 0)
  };
}

export function normalizeCandles(candles = []) {
  return candles.map(normalizeCandle).filter(Boolean);
}

export function recentWindow(candles = [], size = 20) {
  return candles.slice(Math.max(0, candles.length - size));
}

export function closeSeries(candles = []) {
  return candles.map((candle) => toNumber(candle.close, 0));
}

export function highSeries(candles = []) {
  return candles.map((candle) => toNumber(candle.high, 0));
}

export function lowSeries(candles = []) {
  return candles.map((candle) => toNumber(candle.low, 0));
}

export function highestHigh(candles = [], fallback = 0) {
  if (!candles.length) return fallback;
  return max(highSeries(candles), fallback);
}

export function lowestLow(candles = [], fallback = 0) {
  if (!candles.length) return fallback;
  return min(lowSeries(candles), fallback);
}

export function priceRange(candles = [], fallback = 0) {
  if (!candles.length) return fallback;
  return highestHigh(candles, fallback) - lowestLow(candles, fallback);
}

export function trueRanges(candles = []) {
  if (!candles.length) return [];
  const ranges = [];
  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index];
    const high = toNumber(candle.high, 0);
    const low = toNumber(candle.low, 0);
    if (index === 0) {
      ranges.push(high - low);
      continue;
    }
    const previousClose = toNumber(candles[index - 1].close, 0);
    ranges.push(Math.max(high - low, Math.abs(high - previousClose), Math.abs(low - previousClose)));
  }
  return ranges;
}

export function atr(candles = [], period = 14, fallback = 0) {
  const ranges = trueRanges(candles);
  if (!ranges.length) return fallback;
  return mean(ranges.slice(-Math.max(1, period)), fallback);
}

export function bodySize(candle) {
  return Math.abs(toNumber(candle.close, 0) - toNumber(candle.open, 0));
}

export function candleRange(candle) {
  return toNumber(candle.high, 0) - toNumber(candle.low, 0);
}

export function bodyRatio(candle) {
  const range = candleRange(candle);
  if (range === 0) return 0;
  return safeDiv(bodySize(candle), range, 0);
}

export function wickRatios(candle) {
  const high = toNumber(candle.high, 0);
  const low = toNumber(candle.low, 0);
  const open = toNumber(candle.open, 0);
  const close = toNumber(candle.close, 0);
  const range = high - low;
  if (range === 0) return { upper: 0, lower: 0 };
  const top = Math.max(open, close);
  const bottom = Math.min(open, close);
  return {
    upper: safeDiv(high - top, range, 0),
    lower: safeDiv(bottom - low, range, 0)
  };
}
