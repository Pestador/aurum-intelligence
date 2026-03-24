import { TechnicalAgent, getPrice, getSymbol, getTimeframeCandles } from "./base.js";
import { createEvidence } from "../../domain/evidence.js";
import { clusterLevels, makeLevel, nearestLevel, scoreLevel, sortLevels } from "../../domain/levels.js";
import { atr, recentWindow } from "../../domain/series.js";
import { classifyBias, classifyStructure } from "../../domain/structure.js";
import { confidenceFromSignals, weightedScore } from "../../domain/scoring.js";
import { clamp, round, toNumber } from "../../domain/numeric.js";

export class HigherTimeframeStructureAgent extends TechnicalAgent {
  constructor(config = {}) {
    super({
      name: "technical-htf",
      timeframe: "4h",
      description: "Reads higher-timeframe structure for gold and sets the directional backbone.",
      persona: {
        style: "calm, structural, selective",
        focus: "trend backbone, range edges, key zones, invalidation"
      },
      ...config
    });
  }

  async run(context = {}) {
    const candles = this.selectCandles(context);
    const window = recentWindow(candles, context.window ?? 40);
    const price = toNumber(getPrice(context, window.at(-1)?.close ?? 0), 0);
    const symbol = getSymbol(context);
    const structure = classifyStructure(window, { window: context.structureWindow ?? 30, swingLookback: context.swingLookback ?? 2 });
    const atrValue = atr(window, context.atrPeriod ?? 14, 0);
    const levels = this.buildLevels(window, price);
    const support = nearestLevel(levels.filter((level) => level.type === "support"), price, "below");
    const resistance = nearestLevel(levels.filter((level) => level.type === "resistance"), price, "above");
    const bias = classifyBias(structure.structure);
    const quality = weightedScore({
      trend: structure.strength,
      compression: 1 - structure.compression,
      swings: clamp(structure.swings.length / 8, 0, 1)
    }, {
      trend: 0.45,
      compression: 0.25,
      swings: 0.3
    });
    const confidence = confidenceFromSignals([structure.confidence, quality, levels.length ? 0.65 : 0.3], [
      structure.structure === "insufficient_data" ? 0.7 : 0,
      structure.structure === "compression" ? 0.25 : 0
    ]);

    const evidence = createEvidence({
      domain: "technical",
      agent: this.name,
      symbol,
      timeframe: this.timeframe,
      direction: bias,
      confidence,
      summary: `${structure.structure} with ${bias} higher-timeframe bias.`,
      thesis: this.buildThesis(structure, bias, price, atrValue, support, resistance),
      signals: [
        { kind: "structure", value: structure.structure, confidence: structure.confidence },
        { kind: "trend", value: structure.trend, confidence: structure.strength },
        { kind: "support_distance", value: support ? round(Math.abs(price - support.price), 2) : null, confidence: support ? 0.7 : 0.2 },
        { kind: "resistance_distance", value: resistance ? round(Math.abs(resistance.price - price), 2) : null, confidence: resistance ? 0.7 : 0.2 }
      ],
      levels,
      disqualifiers: this.collectDisqualifiers(structure, levels),
      caveats: this.collectCaveats(structure, atrValue),
      score: confidence,
      source: {
        candles: window.length,
        atr: round(atrValue, 2),
        support: support?.price ?? null,
        resistance: resistance?.price ?? null
      }
    });

    return this.wrapResult({
      summary: evidence.summary,
      evidence: [evidence],
      confidence,
      metadata: {
        state: structure.structure,
        bias,
        levels: levels.length,
        atr: round(atrValue, 2)
      }
    });
  }

  selectCandles(context) {
    const direct = getTimeframeCandles(context, this.timeframe);
    if (direct.length) return direct;
    return getTimeframeCandles(context, context.preferredHigherTimeframe ?? "1d");
  }

  buildLevels(candles, price) {
    const structure = classifyStructure(candles, { window: 30, swingLookback: 2 });
    const raw = [
      ...structure.swings.filter((swing) => swing.type === "swing_low").map((swing, index) => makeLevel(swing.price, "support", {
        strength: clamp(0.45 + index * 0.08, 0, 1),
        touches: 1 + index,
        recency: clamp(1 - index * 0.08, 0, 1),
        source: "swing_low"
      })),
      ...structure.swings.filter((swing) => swing.type === "swing_high").map((swing, index) => makeLevel(swing.price, "resistance", {
        strength: clamp(0.45 + index * 0.08, 0, 1),
        touches: 1 + index,
        recency: clamp(1 - index * 0.08, 0, 1),
        source: "swing_high"
      }))
    ];
    const clustered = clusterLevels(raw, 0.45);
    return sortLevels(clustered.map((level) => ({
      ...level,
      type: level.price <= price ? "support" : "resistance",
      score: scoreLevel(level, { price, atr: atr(candles, 14, 0) })
    })));
  }

  buildThesis(structure, bias, price, atrValue, support, resistance) {
    const supportText = support ? `Nearest support is ${support.price}.` : "Support is not clearly defined.";
    const resistanceText = resistance ? `Nearest resistance is ${resistance.price}.` : "Resistance is not clearly defined.";
    return `${structure.structure.replaceAll("_", " ")} suggests ${bias} context near ${round(price, 2)}. ${supportText} ${resistanceText} ATR is ${round(atrValue, 2)}.`;
  }

  collectDisqualifiers(structure, levels) {
    const issues = [];
    if (structure.structure === "insufficient_data") issues.push("Not enough higher-timeframe candles to build a valid structure map.");
    if (!levels.length) issues.push("No repeatable HTF reaction levels were detected.");
    return issues;
  }

  collectCaveats(structure, atrValue) {
    const caveats = [];
    if (structure.structure === "range_structure") caveats.push("Range conditions need lower-timeframe confirmation before any directional bias.");
    if (structure.structure === "compression") caveats.push("Compression can break sharply; wait for confirmation.");
    if (atrValue > 0 && atrValue < 5) caveats.push("Low ATR reduces target room and stop tolerance.");
    return caveats;
  }
}
