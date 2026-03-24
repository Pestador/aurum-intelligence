import { buildNoTrade, buildTradeCandidate, clamp } from "./contracts.mjs";

const AGENT_ID = "precision-trade-construction";

function pickDirection(technicalContext, confluence) {
  if (technicalContext?.directionBias === "bullish" || confluence?.regime === "trend-long") return "long";
  if (technicalContext?.directionBias === "bearish" || confluence?.regime === "trend-short") return "short";
  return "neutral";
}

function deriveRR(direction, entryZone, stopLoss, targets = []) {
  const entry = direction === "long" ? entryZone.high : entryZone.low;
  const stop = stopLoss.price;
  const risk = direction === "long" ? entry - stop : stop - entry;
  if (!(risk > 0)) return { primary: 0, ladder: [] };

  const ladder = targets
    .map((target) => {
      const reward = direction === "long" ? target.price - entry : entry - target.price;
      return {
        price: target.price,
        reward: Math.round(reward * 100) / 100,
        rr: Math.round((reward / risk) * 10) / 10,
      };
    })
    .filter((item) => item.reward > 0);

  return {
    primary: ladder[0]?.rr ?? 0,
    ladder,
  };
}

export const precisionTradeConstructionAgent = {
  id: AGENT_ID,
  name: "Precision Trade Construction Agent",
  persona: "surgical entry architect",
  systemPrompt: `You are the Precision Trade Construction Agent.
You turn a qualified market thesis into a precise, executable trade candidate with exact entry, stop, target, invalidation, and cancel rules.
You must prefer no-trade over forcing a candidate. Vague entry language is a failure.`,
  async analyze(input = {}) {
    const technical = input.technicalContext ?? input.marketSnapshot?.technicalContext ?? {};
    const confluence = input.confluence ?? {};
    const fundamental = input.fundamentalEvidence ?? {};
    const snapshot = input.marketSnapshot ?? {};

    if (confluence.regime === "no-trade" || confluence.combinedScore < 60) {
      return buildNoTrade({
        id: `${AGENT_ID}:${snapshot.symbol ?? "xau-usd"}`,
        reasons: ["Confluence is not strong enough to construct a trade candidate."],
        failedGates: ["confluence"],
        whatWouldChange: ["A cleaner regime, stronger trigger, and better macro alignment."],
        confidence: 0.91,
      });
    }

    const direction = pickDirection(technical, confluence);
    const supportedDirection = fundamental.macro?.direction ?? fundamental.rates?.direction ?? "mixed";
    if (
      direction === "neutral" ||
      (supportedDirection !== "mixed" && direction === "long" && supportedDirection === "contradictory") ||
      (supportedDirection !== "mixed" && direction === "short" && supportedDirection === "supportive")
    ) {
      return buildNoTrade({
        id: `${AGENT_ID}:${snapshot.symbol ?? "xau-usd"}`,
        reasons: ["Direction is not cleanly aligned across the analysis stack."],
        failedGates: ["directional-alignment"],
        whatWouldChange: ["A cleaner technical bias and less contradictory fundamental context."],
        confidence: 0.84,
      });
    }

    const entryZone = technical.entryZone ?? technical.breakoutZone ?? { low: 0, high: 0 };
    const stopLoss = technical.stopLoss ?? { price: 0, reason: "undefined" };
    const targets = technical.targets ?? [];
    const rrProfile = deriveRR(direction, entryZone, stopLoss, targets);
    const bestSession = technical.bestSession ?? snapshot.session?.name ?? "unknown";
    const confidence = clamp((confluence.combinedScore / 100) * 0.9 + 0.05, 0, 0.98);
    const runways = technical.runwayScore ?? rrProfile.primary;

    if (!(entryZone.low < entryZone.high) || !(stopLoss.price > 0) || rrProfile.primary < 6 || runways < 6) {
      return buildNoTrade({
        id: `${AGENT_ID}:${snapshot.symbol ?? "xau-usd"}`,
        reasons: [
          "Entry zone, stop logic, or target runway does not support a high-quality signal.",
        ],
        failedGates: ["entry-quality", "rr-quality"],
        whatWouldChange: ["A wider but still precise path to at least 1:6 reward-to-risk with a defensible stop."],
        confidence: 0.89,
      });
    }

    return buildTradeCandidate({
      id: `${AGENT_ID}:${snapshot.symbol ?? "xau-usd"}`,
      direction,
      status: "candidate",
      entryZone,
      triggerType: technical.triggerType ?? "retest",
      confirmationRules: technical.confirmationRules ?? ["Price must hold the retest zone before entry."],
      cancelBeforeEntry: technical.cancelBeforeEntry ?? ["If price accepts back inside the invalidation area, stand down."],
      stopLoss,
      takeProfitLevels: targets,
      rrProfile: {
        primary: rrProfile.primary,
        ladder: rrProfile.ladder,
      },
      invalidation: technical.invalidation ?? stopLoss.reason,
      bestSession,
      confidence,
      evidenceRefs: [
        ...(technical.evidenceRefs ?? []),
        ...(fundamental.evidenceRefs ?? []),
        ...(confluence.id ? [confluence.id] : []),
      ],
      thesis: technical.thesis ?? `High-confluence ${direction} setup in gold.`,
      notes: [
        `Confluence score ${confluence.combinedScore.toFixed(1)}.`,
        `Fundamental bias is ${fundamental.macro?.direction ?? "mixed"}.`,
      ],
    });
  },
};
