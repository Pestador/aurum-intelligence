import { buildEvidence, scoreBand } from "../signal/contracts.mjs";

const AGENT_ID = "macro-driver-synthesis";

export const macroDriverSynthesisAgent = {
  id: AGENT_ID,
  name: "Macro Driver Synthesis Agent",
  persona: "measured macro strategist",
  systemPrompt: `You are the Macro Driver Synthesis Agent for a gold intelligence system.
You assess macro forces affecting XAU/USD with discipline and specificity.
You must separate facts from interpretation, weight only current evidence, and refuse to force a directional thesis when drivers conflict.
Return structured macro evidence with a clear bias, confidence, risks, and a compact explanation.`,
  async analyze(input = {}) {
    const snapshot = input.marketSnapshot ?? {};
    const macro = snapshot.macro ?? {};
    const rates = snapshot.rates ?? {};
    const positioning = snapshot.positioning ?? {};

    const support = [];
    const risks = [];
    let score = 50;

    if (["soft", "bearish"].includes(rates.usdTrend) || ["lower", "falling"].includes(rates.realYieldTrend)) {
      score += 12;
      support.push("USD and/or real yields are easing, which generally supports gold.");
    }

    if (["strong", "bullish"].includes(rates.usdTrend) || ["higher", "rising"].includes(rates.realYieldTrend)) {
      score -= 14;
      risks.push("USD and/or real yields are rising against gold.");
    }

    if (macro.safeHavenDemand === "elevated" || positioning.geopolitics === "elevated") {
      score += 10;
      support.push("Safe-haven demand or geopolitical stress supports gold demand.");
    }

    if (macro.inflationSurprise === "hot" || macro.fedTone === "hawkish") {
      score -= 10;
      risks.push("Inflation or policy tone is hawkish for gold.");
    }

    if (macro.inflationSurprise === "cooling" || macro.fedTone === "patient") {
      score += 6;
      support.push("Inflation and policy tone are not aggressively hostile to gold.");
    }

    if (positioning.futuresCrowding === "extremeLong") {
      score -= 8;
      risks.push("Crowded long positioning raises squeeze and unwind risk.");
    }

    const normalized = Math.max(0, Math.min(100, score));
    const bias = normalized >= 65 ? "bullish" : normalized <= 35 ? "bearish" : "neutral";
    const confidence = Math.min(0.95, 0.45 + support.length * 0.08 + (bias === "neutral" ? 0.05 : 0.1));

    return buildEvidence({
      id: `${AGENT_ID}:${snapshot.symbol ?? "xau-usd"}`,
      agent: AGENT_ID,
      domain: "fundamental",
      status: scoreBand(normalized),
      direction: bias,
      confidence,
      summary: `Macro view for gold is ${bias} with a quality score of ${normalized}.`,
      support,
      risks,
      caveats: [
        "This output is a synthesis layer, not a standalone trade signal.",
        "Confidence is intentionally capped when macro drivers conflict.",
      ],
      metrics: {
        macroScore: normalized,
        bias,
      },
    });
  },
};
