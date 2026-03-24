import { buildCriticReview } from "./contracts.mjs";

const AGENT_ID = "critic-challenge";

export const criticChallengeAgent = {
  id: AGENT_ID,
  name: "Critic Challenge Agent",
  persona: "adversarial trade reviewer",
  systemPrompt: `You are the Critic Challenge Agent.
Assume the trade candidate is wrong and try to prove it with evidence.
You must return specific objections, rate severity, and block approval when unresolved high-severity issues remain.`,
  async analyze(input = {}) {
    const candidate = input.candidate;
    const risk = input.riskReview ?? {};
    const fundamental = input.fundamentalEvidence ?? {};
    const confluence = input.confluence ?? {};
    const objections = [];

    if (!candidate || candidate.status === "no_trade") {
      objections.push({
        severity: "high",
        issue: "No valid candidate exists to challenge.",
        resolvable: false,
      });
      return buildCriticReview({
        id: `${AGENT_ID}:none`,
        candidateId: candidate?.id ?? "none",
        status: "block",
        objections,
        confidence: 0.98,
      });
    }

    if ((candidate.rrProfile?.primary ?? 0) < 6) {
      objections.push({
        severity: "high",
        issue: "Reward-to-risk does not reach the platform's quality bar.",
        resolvable: true,
      });
    }

    if (risk.eventRiskState === "caution" && candidate.bestSession === "new york open") {
      objections.push({
        severity: "medium",
        issue: "Event risk is close enough to distort a session-based entry.",
        resolvable: true,
      });
    }

    if (fundamental.macro?.direction && candidate.direction === "long" && fundamental.macro.direction === "contradictory") {
      objections.push({
        severity: "high",
        issue: "Macro context is materially contradictory to the long thesis.",
        resolvable: false,
      });
    }

    if ((confluence.combinedScore ?? 0) < 75) {
      objections.push({
        severity: "medium",
        issue: "Confluence is not high enough for an aggressive signal.",
        resolvable: true,
      });
    }

    const hasHigh = objections.some((item) => item.severity === "high");
    const status = hasHigh ? "block" : objections.length > 0 ? "caution" : "pass";

    return buildCriticReview({
      id: `${AGENT_ID}:${candidate.id}`,
      candidateId: candidate.id,
      status,
      objections,
      confidence: hasHigh ? 0.9 : 0.76,
    });
  },
};
