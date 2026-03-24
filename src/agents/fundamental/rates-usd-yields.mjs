import { buildEvidence, scoreBand } from "../signal/contracts.mjs";

const AGENT_ID = "rates-usd-yields";

export const ratesUsdYieldsAgent = {
  id: AGENT_ID,
  name: "Rates, USD, and Yields Agent",
  persona: "correlation-aware rate specialist",
  systemPrompt: `You are the Rates, USD, and Yields Agent.
You evaluate how real yields, nominal yields, and the dollar are interacting with gold right now.
You must avoid simplistic one-factor reasoning and should explicitly flag broken correlations or mixed signals.`,
  async analyze(input = {}) {
    const snapshot = input.marketSnapshot ?? {};
    const rates = snapshot.rates ?? {};

    const support = [];
    const risks = [];
    let score = 50;

    if (["soft", "bearish"].includes(rates.usdTrend)) {
      score += 10;
      support.push("Dollar tone is soft, which is supportive for gold.");
    } else if (["strong", "bullish"].includes(rates.usdTrend)) {
      score -= 12;
      risks.push("Dollar tone is firm, which can pressure gold.");
    }

    if (["lower", "falling"].includes(rates.realYieldTrend)) {
      score += 14;
      support.push("Real yields are easing, which tends to support gold.");
    } else if (["higher", "rising"].includes(rates.realYieldTrend)) {
      score -= 14;
      risks.push("Real yields are rising, which is a headwind for gold.");
    }

    if (["lower", "falling"].includes(rates.nominalYieldTrend)) {
      score += 6;
      support.push("Nominal yields are easing.");
    }

    if (rates.correlationState === "broken") {
      score -= 6;
      risks.push("Gold correlation with rates/USD is broken, lowering conviction.");
    }

    const normalized = Math.max(0, Math.min(100, score));
    const direction = normalized >= 65 ? "supportive" : normalized <= 35 ? "contradictory" : "mixed";
    const confidence = Math.min(0.95, 0.4 + (support.length + risks.length) * 0.06);

    return buildEvidence({
      id: `${AGENT_ID}:${snapshot.symbol ?? "xau-usd"}`,
      agent: AGENT_ID,
      domain: "fundamental",
      status: scoreBand(normalized),
      direction,
      confidence,
      summary: `Rates/USD/yields context is ${direction} for gold.`,
      support,
      risks,
      caveats: [
        "Correlation context should be interpreted alongside structure and event risk.",
      ],
      metrics: {
        ratesScore: normalized,
        direction,
      },
    });
  },
};
