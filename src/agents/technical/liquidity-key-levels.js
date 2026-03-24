import { TechnicalAgent, getPrice, getSymbol, getTimeframeCandles } from "./base.js";
import { createEvidence } from "../../domain/evidence.js";
import { clusterLevels, makeLevel, nearestLevel, scoreLevel, sortLevels } from "../../domain/levels.js";
import { atr } from "../../domain/series.js";
import { classifyStructure } from "../../domain/structure.js";
import { confidenceFromSignals } from "../../domain/scoring.js";
import { clamp, round, toNumber } from "../../domain/numeric.js";

export class LiquidityKeyLevelsAgent extends TechnicalAgent {
  constructor(config = {}) {
    super({
      name: "technical-liquidity",
      timeframe: "1h",
      description: "Maps liquidity pools, sweep zones, and the most relevant reaction levels.",
      persona: {
        style: "precise, trap-aware, quiet",
        focus: "reaction zones, sweeps, trapped liquidity, stop placement"
      },
      ...config
    });
  }

  async run(context = {}) {
    const candles = getTimeframeCandles(context, this.timeframe).length ? getTimeframeCandles(context, this.timeframe) : getTimeframeCandles(context, "4h");
    const price = toNumber(getPrice(context, candles.at(-1)?.close ?? 0), 0);
    const symbol = getSymbol(context);
    const structure = classifyStructure(candles, { window: context.structureWindow ?? 30 });
    const levels = this.buildLiquidityLevels(candles, price, structure);
    const sweeps = this.buildSweepZones(levels, price, atr(candles, context.atrPeriod ?? 14, 0));
    const support = nearestLevel(levels.filter((level) => level.type === "support"), price, "below");
    const resistance = nearestLevel(levels.filter((level) => level.type === "resistance"), price, "above");
    const confidence = confidenceFromSignals([levels.length ? 0.7 : 0.2, structure.confidence, sweeps.length ? 0.6 : 0.4], [
      structure.structure === "insufficient_data" ? 0.5 : 0
    ]);

    const evidence = createEvidence({
      domain: "technical",
      agent: this.name,
      symbol,
      timeframe: this.timeframe,
      direction: structure.direction,
      confidence,
      summary: `Mapped ${levels.length} liquidity levels and ${sweeps.length} sweep zones around ${round(price, 2)}.`,
      thesis: this.buildThesis(price, levels, sweeps, support, resistance),
      signals: [
        { kind: "liquidity_levels", value: levels.length, confidence: clamp(levels.length / 8, 0, 1) },
        { kind: "sweep_zones", value: sweeps.length, confidence: sweeps.length ? 0.7 : 0.3 },
        { kind: "nearest_support", value: support?.price ?? null, confidence: support ? 0.8 : 0.2 },
        { kind: "nearest_resistance", value: resistance?.price ?? null, confidence: resistance ? 0.8 : 0.2 }
      ],
      levels,
      ranges: sweeps,
      disqualifiers: this.collectDisqualifiers(levels),
      caveats: this.collectCaveats(sweeps),
      score: confidence,
      source: {
        candles: candles.length,
        atr: round(atr(candles), 2)
      }
    });

    return this.wrapResult({
      summary: evidence.summary,
      evidence: [evidence],
      confidence,
      metadata: {
        sweepZones: sweeps.length,
        levels: levels.length
      }
    });
  }

  buildLiquidityLevels(candles, price, structure) {
    const swings = structure.swings ?? [];
    const raw = swings.map((swing, index) => makeLevel(swing.price, swing.type === "swing_low" ? "support" : "resistance", {
      strength: clamp(0.4 + index * 0.06, 0, 1),
      touches: 1 + index,
      recency: clamp(1 - index * 0.08, 0, 1),
      source: swing.type
    }));
    const sessionLevels = this.deriveSessionExtremes(candles);
    const clustered = clusterLevels([...raw, ...sessionLevels], 0.4);
    return sortLevels(clustered.map((level) => ({
      ...level,
      type: level.price <= price ? "support" : "resistance",
      score: scoreLevel(level, { price, atr: atr(candles, 14, 0) })
    })));
  }

  deriveSessionExtremes(candles) {
    const sessions = this.groupSessions(candles);
    const levels = [];
    for (const [session, items] of Object.entries(sessions)) {
      if (!items.length) continue;
      const highs = items.map((candle) => toNumber(candle.high, 0));
      const lows = items.map((candle) => toNumber(candle.low, 0));
      levels.push(makeLevel(Math.max(...highs), "resistance", { strength: 0.45, touches: items.length > 6 ? 2 : 1, recency: session === "current" ? 1 : 0.7, source: `${session}_high` }));
      levels.push(makeLevel(Math.min(...lows), "support", { strength: 0.45, touches: items.length > 6 ? 2 : 1, recency: session === "current" ? 1 : 0.7, source: `${session}_low` }));
    }
    return levels;
  }

  groupSessions(candles) {
    const groups = { asia: [], london: [], ny: [], current: [] };
    for (const candle of candles) {
      const timestamp = candle.timestamp ? new Date(candle.timestamp) : null;
      const hour = timestamp ? timestamp.getUTCHours() : null;
      const session = this.sessionFromHour(hour);
      if (session) groups[session].push(candle);
      groups.current.push(candle);
    }
    return groups;
  }

  sessionFromHour(hour) {
    if (hour == null || Number.isNaN(hour)) return null;
    if (hour >= 22 || hour < 2) return "asia";
    if (hour >= 7 && hour < 13) return "london";
    if (hour >= 13 && hour < 18) return "ny";
    return null;
  }

  buildSweepZones(levels, price, atrValue) {
    return levels
      .filter((level) => Math.abs(toNumber(level.price, 0) - price) <= Math.max(atrValue, 3))
      .map((level) => ({
        low: round(level.price - Math.max(atrValue * 0.25, 0.35), 2),
        high: round(level.price + Math.max(atrValue * 0.25, 0.35), 2),
        price: level.price,
        source: "sweep_zone",
        strength: clamp(toNumber(level.strength, 0) * 0.9, 0, 1),
        confidence: 0.65
      }));
  }

  buildThesis(price, levels, sweeps, support, resistance) {
    return `Liquidity map around ${round(price, 2)} shows ${levels.length} key levels. ${support ? `Nearest support is ${support.price}.` : "No clear support is defined."} ${resistance ? `Nearest resistance is ${resistance.price}.` : "No clear resistance is defined."} ${sweeps.length ? `There are ${sweeps.length} nearby sweep zones.` : "No obvious sweep zone cluster was detected."}`;
  }

  collectDisqualifiers(levels) {
    const issues = [];
    if (!levels.length) issues.push("No repeatable liquidity levels were derived.");
    return issues;
  }

  collectCaveats(sweeps) {
    const caveats = [];
    if (sweeps.length > 0) caveats.push("Stops inside sweep zones deserve extra caution.");
    return caveats;
  }
}
