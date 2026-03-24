import { buildExecutionPlan, buildNoTrade } from "./contracts.mjs";

const AGENT_ID = "execution-planner";

export const executionPlannerAgent = {
  id: AGENT_ID,
  name: "Execution Planner Agent",
  persona: "operational trade translator",
  systemPrompt: `You are the Execution Planner Agent.
You convert an approved trade candidate into a clear manual execution checklist.
You must not add new thesis logic or hidden discretion. Keep the plan exact, readable, and executable.`,
  async analyze(input = {}) {
    const candidate = input.candidate;
    if (!candidate || candidate.status === "no_trade") {
      return buildNoTrade({
        id: `${AGENT_ID}:none`,
        reasons: ["No approved candidate is available for execution planning."],
        failedGates: ["approval"],
        whatWouldChange: ["A fully approved trade candidate."],
        confidence: 0.98,
        evidenceRefs: candidate?.evidenceRefs ?? [],
      });
    }

    const entryPlan = `Enter only if price reacts inside ${candidate.entryZone.low} - ${candidate.entryZone.high} and confirms ${candidate.triggerType}.`;
    const stopPlan = `Use the structural invalidation at ${candidate.stopLoss.price}.`;
    const targetPlan = candidate.takeProfitLevels.map((level, index) => `TP${index + 1}: ${level.price} (${level.note ?? "management target"})`);

    return buildExecutionPlan({
      id: `${AGENT_ID}:${candidate.id}`,
      candidateId: candidate.id,
      status: "ready",
      entryPlan,
      stopPlan,
      targetPlan,
      managementNotes: [
        "Cancel the setup if price accepts beyond the invalidation area before entry.",
        "Only act during the preferred session window if liquidity remains clean.",
      ],
      confidence: 0.92,
    });
  },
};
