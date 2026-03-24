import { TechnicalAgent, getPrice, getSymbol, getTimeframeCandles } from "./base.js";
import { createEvidence } from "../../domain/evidence.js";
import { atr, bodyRatio, wickRatios } from "../../domain/series.js";
import { classifyStructure } from "../../domain/structure.js";
import { breakoutDirection, makeRange, rangeContains } from "../../domain/ranges.js";
import { confidenceFromSignals } from "../../domain/scoring.js";
import { clamp, round, toNumber } from "../../domain/numeric.js";

export class TriggerStructureAgent extends TechnicalAgent {
  constructor(config = {}) {
    super({
      name: "technical-trigger",
      timeframe: "15m",
      description: "Detects breakout, retest, and rejection triggers on the execution timeframe.",
      persona: {
        style: "surgical, conditional, timing-aware",
        focus: "entry trigger, confirmation, invalidation, cancellation"
      },
      ...config
    });
  }

  async run(context = {}) {
    const candles = getTimeframeCandles(context, this.timeframe);
    const price = toNumber(getPrice(context, candles.at(-1)?.close ?? 0), 0);
    const symbol = getSymbol(context);
    const htfLevels = Array.isArray(context.keyLevels) ? context.keyLevels : [];
    const structure = classifyStructure(candles, { window: context.structureWindow ?? 20, swingLookback: context.swingLookback ?? 2 });
    const atrValue = atr(candles, context.atrPeriod ?? 14, 0);
    const trigger = this.detectTrigger(candles, price, htfLevels, structure, atrValue);
    const confidence = confidenceFromSignals([trigger.confidence, structure.confidence, candles.length >= 10 ? 0.6 : 0.2], [
      trigger.type === "none" ? 0.35 : 0
    ]);

    const evidence = createEvidence({
      domain: "technical",
      agent: this.name,
      symbol,
      timeframe: this.timeframe,
      direction: trigger.direction,
      confidence,
      summary: trigger.summary,
      thesis: trigger.thesis,
      signals: trigger.signals,
      levels: trigger.levels,
      ranges: trigger.ranges,
      disqualifiers: trigger.disqualifiers,
      caveats: trigger.caveats,
      score: confidence,
      source: {
        candles: candles.length,
        atr: round(atrValue, 2),
        structure: structure.structure
      }
    });

    return this.wrapResult({
      summary: evidence.summary,
      evidence: [evidence],
      confidence,
      metadata: {
        triggerType: trigger.type,
        entryZone: trigger.entryZone,
        stop: trigger.stop,
        triggerPrice: trigger.triggerPrice
      }
    });
  }

  detectTrigger(candles, price, keyLevels, structure, atrValue) {
    if (candles.length < 5) return this.noTrigger("Insufficient candles to validate an execution trigger.");
    const breakout = this.detectBreakout(candles, price, keyLevels, atrValue);
    if (breakout.type !== "none") return breakout;
    const retest = this.detectRetest(candles, price, keyLevels, structure, atrValue);
    if (retest.type !== "none") return retest;
    const rejection = this.detectRejection(candles, price, keyLevels, atrValue);
    if (rejection.type !== "none") return rejection;
    return this.noTrigger("No clear breakout, retest, or rejection trigger is confirmed.");
  }

  detectBreakout(candles, price, keyLevels, atrValue) {
    const last = candles.at(-1);
    const previous = candles.at(-2);
    const localRange = keyLevels.length
      ? { low: keyLevels[0]?.low ?? previous.low, high: keyLevels[0]?.high ?? previous.high }
      : { low: previous.low, high: previous.high };
    const direction = breakoutDirection(localRange, price, Math.max(atrValue * 0.1, 0.25));
    if (direction === "inside") return { type: "none" };
    const body = bodyRatio(last);
    const wick = wickRatios(last);
    if (body < 0.45) return { type: "none" };
    const triggerPrice = round(last.close, 2);
    const stop = direction === "up"
      ? round(last.low - Math.max(atrValue * 0.15, 0.35), 2)
      : round(last.high + Math.max(atrValue * 0.15, 0.35), 2);
    const entryZone = direction === "up"
      ? makeRange(Math.min(triggerPrice, last.high - atrValue * 0.08), Math.max(triggerPrice, last.high), { source: "breakout_entry" })
      : makeRange(Math.min(last.low, triggerPrice), Math.max(triggerPrice, last.low + atrValue * 0.08), { source: "breakout_entry" });
    return this.buildTrigger({
      type: "breakout",
      direction: direction === "up" ? "bullish" : "bearish",
      summary: `Breakout trigger confirmed in the ${direction === "up" ? "bullish" : "bearish"} direction.`,
      thesis: `The latest candle closed beyond local structure with a strong body and acceptable wick profile.`,
      confidence: clamp((body + (direction === "up" ? wick.lower : wick.upper)) / 2, 0, 1),
      entryZone,
      stop,
      triggerPrice,
      levels: keyLevels.slice(0, 3),
      signals: [
        { kind: "breakout_direction", value: direction, confidence: 0.8 },
        { kind: "body_ratio", value: round(body, 3), confidence: body },
        { kind: "wick_quality", value: round(direction === "up" ? wick.lower : wick.upper, 3), confidence: clamp(direction === "up" ? wick.lower : wick.upper, 0, 1) }
      ]
    });
  }

  detectRetest(candles, price, keyLevels, structure, atrValue) {
    const level = keyLevels[0];
    if (!level) return { type: "none" };
    const levelPrice = toNumber(level.price, null);
    if (levelPrice == null) return { type: "none" };
    const last = candles.at(-1);
    const prior = candles.at(-2);
    const proximity = Math.abs(toNumber(last.close, 0) - levelPrice);
    const tolerance = Math.max(atrValue * 0.18, 0.45);
    if (proximity > tolerance) return { type: "none" };
    const touched = rangeContains(makeRange(last.low, last.high), levelPrice);
    if (!touched) return { type: "none" };
    const direction = structure.direction === "bullish" ? "bullish" : structure.direction === "bearish" ? "bearish" : "neutral";
    if (direction === "neutral") return { type: "none" };
    const body = bodyRatio(last);
    if (body < 0.3) return { type: "none" };
    const stop = direction === "bullish"
      ? round(Math.min(last.low, prior.low) - Math.max(atrValue * 0.12, 0.3), 2)
      : round(Math.max(last.high, prior.high) + Math.max(atrValue * 0.12, 0.3), 2);
    const entryZone = direction === "bullish"
      ? makeRange(levelPrice - tolerance * 0.6, levelPrice + tolerance * 0.3, { source: "retest_entry" })
      : makeRange(levelPrice - tolerance * 0.3, levelPrice + tolerance * 0.6, { source: "retest_entry" });
    return this.buildTrigger({
      type: "retest",
      direction,
      summary: `Retest trigger confirmed near ${round(levelPrice, 2)}.`,
      thesis: `Price is respecting a meaningful structure level and confirming on the execution timeframe.`,
      confidence: clamp((body + structure.confidence + 0.5) / 3, 0, 1),
      entryZone,
      stop,
      triggerPrice: levelPrice,
      levels: [level],
      signals: [
        { kind: "retest_proximity", value: round(proximity, 3), confidence: clamp(1 - proximity / Math.max(1, tolerance), 0, 1) },
        { kind: "body_ratio", value: round(body, 3), confidence: body },
        { kind: "structure_direction", value: structure.direction, confidence: structure.confidence }
      ]
    });
  }

  detectRejection(candles, price, keyLevels, atrValue) {
    const level = keyLevels[0];
    if (!level) return { type: "none" };
    const current = candles.at(-1);
    const levelPrice = toNumber(level.price, null);
    if (levelPrice == null || !rangeContains(makeRange(current.low, current.high), levelPrice)) return { type: "none" };
    const body = bodyRatio(current);
    const wick = wickRatios(current);
    const upperDominant = wick.upper > 0.55 && body < 0.4;
    const lowerDominant = wick.lower > 0.55 && body < 0.4;
    if (!upperDominant && !lowerDominant) return { type: "none" };
    const direction = upperDominant ? "bearish" : "bullish";
    const stop = direction === "bullish"
      ? round(current.low - Math.max(atrValue * 0.1, 0.25), 2)
      : round(current.high + Math.max(atrValue * 0.1, 0.25), 2);
    const entryZone = direction === "bullish"
      ? makeRange(levelPrice - Math.max(atrValue * 0.12, 0.3), levelPrice + Math.max(atrValue * 0.18, 0.4), { source: "rejection_entry" })
      : makeRange(levelPrice - Math.max(atrValue * 0.18, 0.4), levelPrice + Math.max(atrValue * 0.12, 0.3), { source: "rejection_entry" });
    return this.buildTrigger({
      type: "rejection",
      direction,
      summary: `Rejection trigger confirmed off ${round(levelPrice, 2)}.`,
      thesis: `A wick-dominant candle rejected the level and failed to hold the opposite side.`,
      confidence: clamp((Math.max(wick.upper, wick.lower) + (1 - body)) / 2, 0, 1),
      entryZone,
      stop,
      triggerPrice: levelPrice,
      levels: [level],
      signals: [
        { kind: "wick_dominance", value: round(Math.max(wick.upper, wick.lower), 3), confidence: Math.max(wick.upper, wick.lower) },
        { kind: "body_ratio", value: round(body, 3), confidence: 1 - body }
      ]
    });
  }

  buildTrigger({
    type,
    direction,
    summary,
    thesis,
    confidence,
    entryZone,
    stop,
    triggerPrice,
    levels,
    signals
  }) {
    return {
      type,
      direction,
      summary,
      thesis,
      confidence: clamp(confidence, 0, 1),
      entryZone,
      stop,
      triggerPrice,
      signals,
      levels,
      ranges: entryZone ? [entryZone] : [],
      disqualifiers: [],
      caveats: [
        "Execution trigger should still be checked against session timing and event risk."
      ]
    };
  }

  noTrigger(reason) {
    return {
      type: "none",
      direction: "neutral",
      summary: "No execution trigger confirmed.",
      thesis: reason,
      confidence: 0.2,
      entryZone: null,
      stop: null,
      triggerPrice: null,
      signals: [{ kind: "trigger_state", value: "none", confidence: 0.2 }],
      levels: [],
      ranges: [],
      disqualifiers: [reason],
      caveats: []
    };
  }
}
