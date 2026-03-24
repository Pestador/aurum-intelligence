import { clamp, mean, round, safeDiv, toNumber } from "./numeric.js";

export function makeRange(low, high, options = {}) {
  const normalizedLow = Math.min(toNumber(low, 0), toNumber(high, 0));
  const normalizedHigh = Math.max(toNumber(low, 0), toNumber(high, 0));
  return {
    low: round(normalizedLow, options.decimals ?? 2),
    high: round(normalizedHigh, options.decimals ?? 2),
    confidence: clamp(toNumber(options.confidence, 0), 0, 1),
    source: options.source ?? "range",
    note: options.note ?? ""
  };
}

export function rangeWidth(range) {
  return round(toNumber(range.high, 0) - toNumber(range.low, 0), 2);
}

export function rangeMidpoint(range) {
  return round((toNumber(range.high, 0) + toNumber(range.low, 0)) / 2, 2);
}

export function rangeContains(range, price) {
  const value = toNumber(price, 0);
  return value >= toNumber(range.low, 0) && value <= toNumber(range.high, 0);
}

export function rangeOverlap(rangeA, rangeB) {
  const low = Math.max(toNumber(rangeA.low, 0), toNumber(rangeB.low, 0));
  const high = Math.min(toNumber(rangeA.high, 0), toNumber(rangeB.high, 0));
  if (high < low) return null;
  return makeRange(low, high, { source: "overlap" });
}

export function rangePosition(range, price, fallback = 0) {
  const low = toNumber(range.low, 0);
  const high = toNumber(range.high, 0);
  if (high === low) return fallback;
  return clamp((toNumber(price, 0) - low) / (high - low), 0, 1);
}

export function breakoutDirection(range, price, buffer = 0) {
  const value = toNumber(price, 0);
  if (value > toNumber(range.high, 0) + buffer) return "up";
  if (value < toNumber(range.low, 0) - buffer) return "down";
  return "inside";
}

export function compressionScore(range, atr, fallback = 0) {
  const width = rangeWidth(range);
  const normalized = safeDiv(width, Math.max(atr, 1), fallback);
  return round(clamp(1 - clamp(normalized, 0, 3) / 3, 0, 1), 3);
}

export function buildTradeRange(levelA, levelB, padding = 0.25) {
  const low = Math.min(toNumber(levelA, 0), toNumber(levelB, 0)) - padding;
  const high = Math.max(toNumber(levelA, 0), toNumber(levelB, 0)) + padding;
  return makeRange(low, high, { source: "trade" });
}

export function distanceToRange(range, price) {
  const value = toNumber(price, 0);
  if (rangeContains(range, value)) return 0;
  if (value < toNumber(range.low, 0)) return toNumber(range.low, 0) - value;
  return value - toNumber(range.high, 0);
}

export function summarizeRanges(ranges = []) {
  if (!ranges.length) return { count: 0, low: 0, high: 0, width: 0, confidence: 0 };
  const lows = ranges.map((range) => toNumber(range.low, 0));
  const highs = ranges.map((range) => toNumber(range.high, 0));
  return {
    count: ranges.length,
    low: Math.min(...lows),
    high: Math.max(...highs),
    width: Math.max(...highs) - Math.min(...lows),
    confidence: mean(ranges.map((range) => toNumber(range.confidence, 0)), 0)
  };
}
