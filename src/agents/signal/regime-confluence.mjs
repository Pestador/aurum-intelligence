import { buildConfluence, weightedAverage } from "./contracts.mjs";

const AGENT_ID = "regime-confluence";

export const regimeConfluenceAgent = {
  id: AGENT_ID,
  name: "Regime and Confluence Agent",
  persona: "disciplined synthesis gate",
  systemPrompt: `You are the Regime and Confluence Agent.
You combine technical and fundamental evidence into a trading regime and decide whether signal construction is allowed.
You must be selective, weight contradictions honestly, and block trade construction when the environment is not good enough.`,
  async analyze(input = {}) {
    const technical = input.technicalContext ?? input.marketSnapshot?.technicalContext ?? {};
    const fundamental = input.fundamentalEvidence ?? {};
    const marketSnapshot = input.marketSnapshot ?? {};

    const technicalScore = weightedAverage([
      { value: technical.structureScore ?? 0, weight: 0.4 },
      { value: technical.triggerScore ?? 0, weight: 0.3 },
      { value: technical.liquidityScore ?? 0, weight: 0.15 },
      { value: technical.volatilityScore ?? 0, weight: 0.1 },
      { value: technical.sessionScore ?? 0, weight: 0.05 },
    ]);

    const eventState = fundamental.eventRisk?.metrics?.eventRiskState ?? "clear";
    const fundamentalScore = weightedAverage([
      { value: fundamental.macro?.metrics?.macroScore ?? 0, weight: 0.35 },
      { value: fundamental.rates?.metrics?.ratesScore ?? 0, weight: 0.25 },
      { value: eventState === "blocked" ? 15 : eventState === "caution" ? 45 : 78, weight: 0.2 },
      { value: fundamental.positioning?.metrics?.positioningScore ?? 0, weight: 0.2 },
    ]);

    const blockedReasons = [];
    if (eventState === "blocked") {
      blockedReasons.push("High-impact event risk is blocked.");
    }
    if (technicalScore < 55) {
      blockedReasons.push("Technical quality is below threshold.");
    }
    if (fundamentalScore < 45) {
      blockedReasons.push("Fundamental context is below threshold.");
    }
    if (!["bullish", "bearish"].includes(technical.directionBias ?? "")) {
      blockedReasons.push("Technical direction is not clean enough for trade construction.");
    }

    const combinedScore = Math.max(
      0,
      Math.min(100, technicalScore * 0.55 + fundamentalScore * 0.35 + (eventState === "clear" ? 12 : eventState === "caution" ? -8 : -30))
    );
    const technicalBias = technical.directionBias ?? "neutral";
    const fundamentalBias = [fundamental.macro?.direction, fundamental.rates?.direction, fundamental.positioning?.direction]
      .filter(Boolean)
      .reduce((bias, value) => {
        if (!bias) return value;
        if (bias !== value) return "mixed";
        return bias;
      }, "") || "neutral";

    const regime = blockedReasons.length > 0
      ? "no-trade"
      : combinedScore >= 75
        ? technicalBias === "bullish" ? "trend-long" : "trend-short"
        : combinedScore >= 60
          ? "rotation"
          : "transition";

    const allowedStrategies = regime.startsWith("trend")
      ? ["retest", "breakout-confirmation", "pullback-entry"]
      : regime === "rotation"
        ? ["mean-reversion", "range-edge-reaction"]
        : [];

    return buildConfluence({
      id: `${AGENT_ID}:${marketSnapshot.symbol ?? "xau-usd"}`,
      regime,
      technicalScore,
      fundamentalScore,
      executionScore: technical.sessionScore ?? 0,
      combinedScore,
      allowedStrategies,
      blockedReasons,
      technicalBias,
      fundamentalBias,
    });
  },
};
