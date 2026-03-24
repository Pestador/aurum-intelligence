import { clamp, mean, round, safeDiv, sign, toNumber } from "./numeric.js";
import { closeSeries, highestHigh, lowestLow, priceRange, recentWindow } from "./series.js";

export function detectSwings(candles = [], lookback = 2) {
  const swings = [];
  if (candles.length < lookback * 2 + 1) return swings;
  for (let index = lookback; index < candles.length - lookback; index += 1) {
    const current = candles[index];
    const high = toNumber(current.high, 0);
    const low = toNumber(current.low, 0);
    const left = candles.slice(index - lookback, index);
    const right = candles.slice(index + 1, index + lookback + 1);
    if (left.every((candle) => high >= toNumber(candle.high, 0)) && right.every((candle) => high >= toNumber(candle.high, 0))) {
      swings.push({ index, type: "swing_high", price: high, timestamp: current.timestamp ?? null });
    }
    if (left.every((candle) => low <= toNumber(candle.low, 0)) && right.every((candle) => low <= toNumber(candle.low, 0))) {
      swings.push({ index, type: "swing_low", price: low, timestamp: current.timestamp ?? null });
    }
  }
  return swings;
}

export function linearSlope(values = []) {
  const points = values.map((value) => toNumber(value, 0));
  const n = points.length;
  if (n < 2) return 0;
  const xMean = (n - 1) / 2;
  const yMean = mean(points, 0);
  let numerator = 0;
  let denominator = 0;
  for (let index = 0; index < n; index += 1) {
    const x = index;
    const y = points[index];
    numerator += (x - xMean) * (y - yMean);
    denominator += (x - xMean) ** 2;
  }
  return safeDiv(numerator, denominator, 0);
}

function directionalPressure(candles, mode) {
  let score = 0;
  for (const candle of candles) {
    const open = toNumber(candle.open, 0);
    const close = toNumber(candle.close, 0);
    const high = toNumber(candle.high, 0);
    const low = toNumber(candle.low, 0);
    if (mode === "bullish" && close > open && close >= high - (high - low) * 0.3) score += 1;
    if (mode === "bearish" && close < open && close <= low + (high - low) * 0.3) score += 1;
  }
  return score;
}

export function classifyTrend(candles = [], options = {}) {
  const window = recentWindow(candles, options.window ?? 24);
  if (window.length < 5) {
    return { trend: "insufficient_data", direction: "neutral", strength: 0, slope: 0, netChange: 0, range: 0, confidence: 0 };
  }
  const closes = closeSeries(window);
  const slope = linearSlope(closes);
  const range = priceRange(window, 0);
  const start = closes[0];
  const end = closes[closes.length - 1];
  const netChange = safeDiv(end - start, Math.max(1, Math.abs(start)), 0);
  const direction = sign(slope || netChange);
  const swingBalance = safeDiv(directionalPressure(window, "bullish") - directionalPressure(window, "bearish"), Math.max(1, window.length), 0);
  const strength = clamp(mean([
    clamp(Math.abs(slope) / Math.max(1, range / Math.max(1, window.length)), 0, 1),
    clamp(Math.abs(netChange) * 5, 0, 1),
    clamp(Math.abs(swingBalance) * 2, 0, 1)
  ]), 0, 1);
  let trend = "range";
  if (strength < 0.25) trend = "range";
  else if (direction > 0) trend = "bullish";
  else if (direction < 0) trend = "bearish";
  if (strength < 0.45 && Math.abs(netChange) < 0.01) trend = "compression";
  return {
    trend,
    direction: direction > 0 ? "bullish" : direction < 0 ? "bearish" : "neutral",
    strength: round(strength, 3),
    slope: round(slope, 5),
    netChange: round(netChange, 5),
    range: round(range, 2),
    confidence: round(clamp(strength, 0, 1), 3)
  };
}

export function classifyStructure(candles = [], options = {}) {
  const window = recentWindow(candles, options.window ?? 30);
  const trend = classifyTrend(window, options);
  const swings = detectSwings(window, options.swingLookback ?? 2);
  const highs = swings.filter((swing) => swing.type === "swing_high").map((swing) => swing.price);
  const lows = swings.filter((swing) => swing.type === "swing_low").map((swing) => swing.price);
  const range = priceRange(window, 0);
  const compression = range > 0 ? clamp(1 - safeDiv(highestHigh(window, 0) - lowestLow(window, 0), Math.max(1, range * 1.5), 0), 0, 1) : 0;
  const structure = determineStructureState(trend, highs, lows, compression);
  return {
    structure,
    trend: trend.trend,
    direction: trend.direction,
    strength: trend.strength,
    swings,
    highs,
    lows,
    compression: round(compression, 3),
    range: round(range, 2),
    confidence: round(clamp(mean([trend.confidence, compression]), 0, 1), 3)
  };
}

function determineStructureState(trend, highs, lows, compression) {
  if (trend.trend === "insufficient_data") return "insufficient_data";
  if (compression > 0.72) return "compression";
  if (highs.length >= 2 && lows.length >= 2) {
    const higherHighs = highs[highs.length - 1] > highs[0];
    const higherLows = lows[lows.length - 1] > lows[0];
    const lowerHighs = highs[highs.length - 1] < highs[0];
    const lowerLows = lows[lows.length - 1] < lows[0];
    if (higherHighs && higherLows) return "bullish_structure";
    if (lowerHighs && lowerLows) return "bearish_structure";
    return "range_structure";
  }
  if (trend.trend === "bullish") return "bullish_structure";
  if (trend.trend === "bearish") return "bearish_structure";
  return "range_structure";
}

export function classifyBias(structure) {
  if (structure === "bullish_structure") return "bullish";
  if (structure === "bearish_structure") return "bearish";
  if (structure === "compression" || structure === "range_structure") return "neutral";
  return "unknown";
}
