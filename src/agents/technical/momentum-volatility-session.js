import { TechnicalAgent, getPrice, getSymbol, getTimeframeCandles, getTimestamp } from "./base.js";
import { createEvidence } from "../../domain/evidence.js";
import { atr, bodyRatio, trueRanges } from "../../domain/series.js";
import { compressionScore, makeRange } from "../../domain/ranges.js";
import { confidenceFromSignals } from "../../domain/scoring.js";
import { clamp, mean, round, toNumber } from "../../domain/numeric.js";

export class MomentumVolatilitySessionAgent extends TechnicalAgent {
  constructor(config = {}) {
    super({
      name: "technical-momentum",
      timeframe: "15m",
      description: "Assesses momentum quality, volatility regime, and session suitability.",
      persona: {
        style: "practical, timing-aware, risk-sensitive",
        focus: "momentum quality, volatility state, session suitability"
      },
      ...config
    });
  }

  async run(context = {}) {
    const candles = getTimeframeCandles(context, this.timeframe);
    const price = toNumber(getPrice(context, candles.at(-1)?.close ?? 0), 0);
    const symbol = getSymbol(context);
    const atrValue = atr(candles, context.atrPeriod ?? 14, 0);
    const momentum = this.calculateMomentum(candles);
    const volatility = this.calculateVolatility(candles, atrValue);
    const session = this.detectSession(candles, getTimestamp(context));
    const tradeability = this.determineTradeability(momentum, volatility, session);
    const confidence = confidenceFromSignals([momentum.confidence, volatility.confidence, session.confidence], [
      tradeability.state === "avoid" ? 0.3 : 0
    ]);

    const evidence = createEvidence({
      domain: "technical",
      agent: this.name,
      symbol,
      timeframe: this.timeframe,
      direction: momentum.direction,
      confidence,
      summary: `${momentum.label} momentum with ${volatility.label} volatility during ${session.label} session conditions.`,
      thesis: this.buildThesis(price, momentum, volatility, session, tradeability),
      signals: [
        { kind: "momentum_state", value: momentum.label, confidence: momentum.confidence },
        { kind: "volatility_state", value: volatility.label, confidence: volatility.confidence },
        { kind: "session_state", value: session.label, confidence: session.confidence },
        { kind: "tradeability", value: tradeability.state, confidence: tradeability.confidence }
      ],
      ranges: volatility.range ? [volatility.range] : [],
      disqualifiers: tradeability.reasons,
      caveats: tradeability.caveats,
      score: confidence,
      source: {
        candles: candles.length,
        atr: round(atrValue, 2),
        session: session.label
      }
    });

    return this.wrapResult({
      summary: evidence.summary,
      evidence: [evidence],
      confidence,
      metadata: {
        momentum: momentum.label,
        volatility: volatility.label,
        session: session.label,
        tradeability: tradeability.state
      }
    });
  }

  calculateMomentum(candles) {
    if (candles.length < 4) return { label: "insufficient_data", direction: "neutral", confidence: 0.2 };
    const window = candles.slice(-8);
    const bodyScores = window.map((candle) => bodyRatio(candle));
    const closes = window.map((candle) => toNumber(candle.close, 0));
    const net = closes.at(-1) - closes[0];
    const positive = window.filter((candle) => toNumber(candle.close, 0) > toNumber(candle.open, 0)).length;
    const negative = window.filter((candle) => toNumber(candle.close, 0) < toNumber(candle.open, 0)).length;
    const averageBody = mean(bodyScores, 0);
    const directionalStrength = clamp(Math.abs(net) / Math.max(1, Math.abs(closes[0]) * 0.005), 0, 1);
    let label = "balanced";
    let direction = "neutral";
    if (positive > negative + 1 && net > 0) {
      label = "bullish_impulse";
      direction = "bullish";
    } else if (negative > positive + 1 && net < 0) {
      label = "bearish_impulse";
      direction = "bearish";
    } else if (averageBody < 0.32) {
      label = "choppy";
    } else if (Math.abs(net) < Math.max(1, Math.abs(closes[0]) * 0.0015)) {
      label = "mean_reverting";
    }
    return {
      label,
      direction,
      confidence: round(clamp(mean([averageBody, directionalStrength]), 0, 1), 3)
    };
  }

  calculateVolatility(candles, atrValue) {
    if (candles.length < 4) return { label: "insufficient_data", confidence: 0.2, range: null };
    const window = candles.slice(-12);
    const ranges = trueRanges(window);
    const medianRange = [...ranges].sort((a, b) => a - b)[Math.floor(ranges.length / 2)] ?? 0;
    const range = makeRange(Math.min(...window.map((candle) => toNumber(candle.low, 0))), Math.max(...window.map((candle) => toNumber(candle.high, 0))), { source: "intraday_range" });
    const compression = compressionScore(range, Math.max(atrValue, medianRange || 1));
    let label = "normal";
    if (compression > 0.7) label = "compressed";
    else if (atrValue > (medianRange || 1) * 1.4) label = "expanded";
    return {
      label,
      confidence: round(clamp(mean([1 - compression, atrValue > 0 ? 0.6 : 0.2]), 0, 1), 3),
      range
    };
  }

  detectSession(candles, timestampUtc) {
    const timestamp = timestampUtc ? new Date(timestampUtc) : candles.at(-1)?.timestamp ? new Date(candles.at(-1).timestamp) : new Date();
    const hour = timestamp.getUTCHours();
    if (hour >= 22 || hour < 2) return { label: "asia", confidence: 0.75 };
    if (hour >= 7 && hour < 13) return { label: "london", confidence: 0.85 };
    if (hour >= 13 && hour < 18) return { label: "new_york", confidence: 0.85 };
    if (hour >= 20 && hour < 22) return { label: "rollover", confidence: 0.7 };
    return { label: "off_hours", confidence: 0.6 };
  }

  determineTradeability(momentum, volatility, session) {
    const reasons = [];
    const caveats = [];
    let state = "tradeable";
    if (session.label === "rollover" || session.label === "off_hours") {
      state = "avoid";
      reasons.push("Session timing is poor for new execution.");
    }
    if (momentum.label === "choppy" || momentum.label === "mean_reverting") {
      state = state === "avoid" ? "avoid" : "caution";
      reasons.push("Momentum quality is weak or mixed.");
    }
    if (volatility.label === "compressed") {
      state = state === "avoid" ? "avoid" : "caution";
      caveats.push("Compression can make entries precise but follow-through uncertain.");
    }
    if (volatility.label === "expanded") {
      caveats.push("Expansion can improve reach but increases stop-sweep risk.");
    }
    return {
      state,
      confidence: state === "tradeable" ? 0.8 : state === "caution" ? 0.55 : 0.3,
      reasons,
      caveats
    };
  }

  buildThesis(price, momentum, volatility, session, tradeability) {
    return `Price near ${round(price, 2)} is in ${momentum.label} momentum, ${volatility.label} volatility, and ${session.label} session conditions. Tradeability is ${tradeability.state}.`;
  }
}
