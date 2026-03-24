import { clamp, mean, round, safeDiv, toNumber } from "./numeric.js";

export function normalizeWeights(weights = {}) {
  const filtered = Object.entries(weights).filter(([, value]) => toNumber(value, 0) > 0);
  const total = filtered.reduce((sum, [, value]) => sum + toNumber(value, 0), 0);
  if (total === 0) return {};
  return Object.fromEntries(filtered.map(([key, value]) => [key, toNumber(value, 0) / total]));
}

export function weightedScore(values = {}, weights = {}) {
  const normalized = normalizeWeights(weights);
  let total = 0;
  for (const [key, weight] of Object.entries(normalized)) {
    total += clamp(toNumber(values[key], 0), 0, 1) * weight;
  }
  return round(clamp(total, 0, 1), 3);
}

export function confidenceFromSignals(signals = [], penalties = []) {
  if (!signals.length) return 0;
  const signalScore = mean(signals.map((signal) => clamp(toNumber(signal, 0), 0, 1)), 0);
  const penaltyScore = mean(penalties.map((penalty) => clamp(toNumber(penalty, 0), 0, 1)), 0);
  return round(clamp(signalScore - penaltyScore * 0.6, 0, 1), 3);
}

export function thresholdState(score, thresholds = { pass: 0.75, caution: 0.6 }) {
  const value = clamp(toNumber(score, 0), 0, 1);
  if (value >= thresholds.pass) return "pass";
  if (value >= thresholds.caution) return "caution";
  return "fail";
}

export function signalConfidence({ technical = 0, fundamental = 0, execution = 0, risk = 0, contradiction = 0 } = {}) {
  return round(clamp(mean([technical, fundamental, execution, risk], 0) - clamp(toNumber(contradiction, 0), 0, 1) * 0.5, 0, 1), 3);
}

export function rrScore(risk, reward, fallback = 0) {
  return round(safeDiv(reward, risk, fallback), 3);
}
