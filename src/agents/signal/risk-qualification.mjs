import { buildNoTrade, buildRiskReview } from "./contracts.mjs";

const AGENT_ID = "risk-qualification";

export const riskQualificationAgent = {
  id: AGENT_ID,
  name: "Risk Qualification Agent",
  persona: "capital-preservation gatekeeper",
  systemPrompt: `You are the Risk Qualification Agent.
You decide whether a trade candidate deserves to survive based on stop integrity, target realism, event risk, and policy compliance.
You must be strict and reject any trade that relies on uncertain risk mechanics or unrealistic reward assumptions.`,
  async analyze(input = {}) {
    const candidate = input.candidate;
    const fundamental = input.fundamentalEvidence ?? {};
    const profile = input.userProfile ?? {};
    const eventRiskState = fundamental.eventRisk?.metrics?.eventRiskState ?? "clear";

    if (!candidate || candidate.status === "no_trade") {
      return buildRiskReview({
        id: `${AGENT_ID}:none`,
        candidateId: candidate?.id ?? "none",
        status: "fail",
        stopQuality: "weak",
        targetRealism: "implausible",
        eventRiskState,
        policyViolations: ["No candidate to qualify."],
        notes: ["Risk qualification cannot approve a missing candidate."],
        confidence: 0.99,
      });
    }

    const stopQuality = candidate.stopLoss?.price > 0 && candidate.invalidation ? "strong" : "weak";
    const targetRealism = candidate.rrProfile?.primary >= 6 ? "credible" : candidate.rrProfile?.primary >= 4 ? "stretched" : "implausible";
    const profileMinRR = Number.isFinite(profile.minRR) ? profile.minRR : 6;

    const violations = [];
    if (eventRiskState === "blocked") violations.push("High-impact event risk is blocked.");
    if (stopQuality === "weak") violations.push("Stop quality is weak.");
    if (targetRealism !== "credible") violations.push("Target realism is not strong enough.");
    if ((candidate.rrProfile?.primary ?? 0) < profileMinRR) violations.push("Reward-to-risk does not meet profile minimum.");

    const status = violations.length === 0 ? "pass" : violations.length === 1 && eventRiskState === "caution" ? "conditional" : "fail";
    const confidence = status === "pass" ? 0.91 : status === "conditional" ? 0.74 : 0.88;

    return buildRiskReview({
      id: `${AGENT_ID}:${candidate.id}`,
      candidateId: candidate.id,
      status,
      stopQuality,
      targetRealism,
      eventRiskState,
      policyViolations: violations,
      notes: [
        `Primary RR is ${candidate.rrProfile?.primary ?? 0}.`,
        `Profile minimum RR is ${profileMinRR}.`,
      ],
      confidence,
    });
  },
};

export function buildRiskBasedNoTrade(candidate, reasons = []) {
  return buildNoTrade({
    id: `${AGENT_ID}:${candidate?.id ?? "none"}`,
    reasons,
    failedGates: ["risk"],
    whatWouldChange: ["Improve stop integrity, target realism, or event clearance."],
    confidence: 0.9,
    evidenceRefs: candidate?.evidenceRefs ?? [],
  });
}
