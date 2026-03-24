export function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function toNumber(value, fallback = 0) {
  const parsed = typeof value === "string" ? Number(value) : value;
  return isFiniteNumber(parsed) ? parsed : fallback;
}

export function clamp(value, min, max) {
  const n = toNumber(value, min);
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

export function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(toNumber(value, 0) * factor) / factor;
}

export function safeDiv(numerator, denominator, fallback = 0) {
  const a = toNumber(numerator, NaN);
  const b = toNumber(denominator, NaN);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return fallback;
  return a / b;
}

export function sum(values = []) {
  return values.reduce((acc, value) => acc + toNumber(value, 0), 0);
}

export function mean(values = [], fallback = 0) {
  if (!values.length) return fallback;
  return safeDiv(sum(values), values.length, fallback);
}

export function median(values = [], fallback = 0) {
  if (!values.length) return fallback;
  const sorted = [...values].map((value) => toNumber(value, 0)).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

export function min(values = [], fallback = 0) {
  if (!values.length) return fallback;
  return Math.min(...values.map((value) => toNumber(value, fallback)));
}

export function max(values = [], fallback = 0) {
  if (!values.length) return fallback;
  return Math.max(...values.map((value) => toNumber(value, fallback)));
}

export function standardDeviation(values = [], fallback = 0) {
  if (!values.length) return fallback;
  const avg = mean(values, fallback);
  const variance = mean(values.map((value) => {
    const delta = toNumber(value, 0) - avg;
    return delta * delta;
  }), fallback);
  return Math.sqrt(variance);
}

export function percentile(values = [], pct = 50, fallback = 0) {
  if (!values.length) return fallback;
  const sorted = [...values].map((value) => toNumber(value, 0)).sort((a, b) => a - b);
  const position = clamp(pct, 0, 100) / 100 * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  const weight = position - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * weight;
}

export function normalize(value, minValue, maxValue, fallback = 0) {
  if (!isFiniteNumber(value) || !isFiniteNumber(minValue) || !isFiniteNumber(maxValue) || minValue === maxValue) {
    return fallback;
  }
  return (value - minValue) / (maxValue - minValue);
}

export function sign(value) {
  const n = toNumber(value, 0);
  if (n > 0) return 1;
  if (n < 0) return -1;
  return 0;
}
