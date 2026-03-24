import { buildEvidence, scoreBand } from "../signal/contracts.mjs";

const AGENT_ID = "positioning-geopolitics-intermarket";

export const positioningGeopoliticsIntermarketAgent = {
  id: AGENT_ID,
  name: "Positioning, Geopolitics, and Intermarket Agent",
  persona: "contextual pressure analyst",
  systemPrompt: `You are the Positioning, Geopolitics, and Intermarket Agent.
You assess crowding, safe-haven context, and cross-market support or contradiction for gold.
You must not overstate soft sentiment data and must clearly state when positioning is stale or only indirectly inferred.`,
  async analyze(input = {}) {
    const snapshot = input.marketSnapshot ?? {};
    const positioning = snapshot.positioning ?? {};

    const support = [];
    const risks = [];
    let score = 50;

    if (positioning.geopolitics === "elevated") {
      score += 10;
      support.push("Geopolitical stress is elevated and can support safe-haven demand.");
    }

    if (positioning.intermarket === "bullish") {
      score += 8;
      support.push("Intermarket context is supportive for gold.");
    } else if (positioning.intermarket === "bearish") {
      score -= 8;
      risks.push("Intermarket context is not supportive for gold.");
    }

    if (positioning.futuresCrowding === "extremeLong") {
      score -= 12;
      risks.push("Crowding is elevated and increases unwind risk.");
    } else if (positioning.futuresCrowding === "extremeShort") {
      score += 10;
      support.push("Crowding is bearish and may support short-covering upside.");
    }

    if (positioning.etfFlow === "outflow") {
      score -= 6;
      risks.push("ETF flows are negative for gold demand.");
    } else if (positioning.etfFlow === "inflow") {
      score += 6;
      support.push("ETF flows are supportive for gold demand.");
    }

    const normalized = Math.max(0, Math.min(100, score));
    const direction = normalized >= 65 ? "supportive" : normalized <= 35 ? "contradictory" : "mixed";
    const confidence = Math.min(0.92, 0.42 + support.length * 0.08 + risks.length * 0.04);

    return buildEvidence({
      id: `${AGENT_ID}:${snapshot.symbol ?? "xau-usd"}`,
      agent: AGENT_ID,
      domain: "fundamental",
      status: scoreBand(normalized),
      direction,
      confidence,
      summary: `Positioning and intermarket context are ${direction} for gold.`,
      support,
      risks,
      caveats: [
        "Positioning evidence should be used as supporting context, not a primary trigger.",
      ],
      metrics: {
        positioningScore: normalized,
        direction,
      },
    });
  },
};
