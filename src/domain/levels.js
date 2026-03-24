import { clamp, max, mean, min, round, safeDiv, toNumber } from "./numeric.js";

export function makeLevel(price, type, options = {}) {
  return {
    price: round(toNumber(price, 0), options.decimals ?? 2),
    type,
    strength: clamp(toNumber(options.strength, 0), 0, 1),
    touches: Math.max(0, Math.trunc(toNumber(options.touches, 0))),
    recency: clamp(toNumber(options.recency, 0), 0, 1),
    source: options.source ?? "structure",
    note: options.note ?? ""
  };
}

export function sortLevels(levels = [], direction = "asc") {
  return [...levels].sort((a, b) => (direction === "desc" ? -1 : 1) * (toNumber(a.price, 0) - toNumber(b.price, 0)));
}

export function dedupeLevels(levels = [], tolerance = 0.15) {
  const sorted = sortLevels(levels);
  const merged = [];
  for (const level of sorted) {
    const last = merged[merged.length - 1];
    if (!last || Math.abs(toNumber(level.price, 0) - toNumber(last.price, 0)) > tolerance) {
      merged.push({ ...level });
      continue;
    }
    const touches = toNumber(last.touches, 0) + toNumber(level.touches, 0);
    merged[merged.length - 1] = {
      ...last,
      price: round(safeDiv(toNumber(last.price, 0) * toNumber(last.touches, 0) + toNumber(level.price, 0) * toNumber(level.touches, 0), touches, toNumber(last.price, 0)), 2),
      strength: clamp(mean([toNumber(last.strength, 0), toNumber(level.strength, 0)]), 0, 1),
      touches,
      recency: clamp(mean([toNumber(last.recency, 0), toNumber(level.recency, 0)]), 0, 1),
      note: [last.note, level.note].filter(Boolean).join(" | ")
    };
  }
  return merged;
}

export function clusterLevels(levels = [], tolerance = 0.35) {
  const sorted = sortLevels(levels);
  const clusters = [];
  for (const level of sorted) {
    const cluster = clusters[clusters.length - 1];
    if (!cluster || Math.abs(toNumber(level.price, 0) - cluster.anchor) > tolerance) {
      clusters.push({ anchor: toNumber(level.price, 0), levels: [{ ...level }] });
      continue;
    }
    cluster.levels.push({ ...level });
    cluster.anchor = mean(cluster.levels.map((item) => toNumber(item.price, 0)));
  }
  return clusters.map((cluster) => {
    const prices = cluster.levels.map((item) => toNumber(item.price, 0));
    return {
      price: round(mean(prices), 2),
      low: round(min(prices), 2),
      high: round(max(prices), 2),
      count: cluster.levels.length,
      touches: cluster.levels.reduce((sum, item) => sum + toNumber(item.touches, 0), 0),
      strength: clamp(mean(cluster.levels.map((item) => toNumber(item.strength, 0))), 0, 1),
      source: [...new Set(cluster.levels.map((item) => item.source))],
      note: cluster.levels.map((item) => item.note).filter(Boolean).join(" | ")
    };
  });
}

export function nearestLevel(levels = [], price, direction = "nearest") {
  if (!levels.length) return null;
  const target = toNumber(price, 0);
  const ranked = [...levels].sort((a, b) => Math.abs(toNumber(a.price, 0) - target) - Math.abs(toNumber(b.price, 0) - target));
  if (direction === "above") return ranked.find((level) => toNumber(level.price, 0) >= target) ?? ranked[0];
  if (direction === "below") return ranked.find((level) => toNumber(level.price, 0) <= target) ?? ranked[0];
  return ranked[0];
}

export function buildZone(level, width = 0.75) {
  const price = toNumber(level.price, level);
  return {
    price,
    low: round(price - width / 2, 2),
    high: round(price + width / 2, 2),
    width: round(width, 2),
    type: level.type ?? "zone"
  };
}

export function scoreLevel(level, context = {}) {
  const touches = clamp(toNumber(level.touches, 0) / 5, 0, 1);
  const strength = clamp(toNumber(level.strength, 0), 0, 1);
  const recency = clamp(toNumber(level.recency, 0), 0, 1);
  const distance = context.price == null || context.atr == null ? 0.5 : 1 - clamp(Math.abs(toNumber(level.price, 0) - toNumber(context.price, 0)) / Math.max(1, toNumber(context.atr, 1) * 2), 0, 1);
  return round(clamp(mean([touches, strength, recency, distance]), 0, 1), 3);
}
