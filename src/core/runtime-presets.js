import { createPromptedAgent, createRuleBasedAgent } from "./agent-factory.js";
import { createSignalWorkflowSet } from "./workflows.js";

function buildEvidenceStub(agentName, context) {
  return [
    {
      source: agentName,
      workflowId: context.workflowId,
      stageName: context.stageName || null,
    },
  ];
}

export function createDefaultAurumAgents() {
  return [
    createRuleBasedAgent({
      name: "market-data",
      personaKey: "orchestrator",
      run: async (context, runtime) => {
        const snapshot = await runtime.providers.market.getSnapshot({
          symbol: context.userRequest?.symbol || "XAU/USD",
        });
        return {
          status: snapshot.status === "ok" ? "completed" : "rejected",
          summary: `Market snapshot loaded for ${snapshot.symbol}`,
          evidence: [snapshot],
          confidence: snapshot.health?.ok ? 0.9 : 0.4,
          metadata: snapshot,
        };
      },
    }),
    createPromptedAgent({ name: "technical-htf", personaKey: "technical", promptKey: "technicalAnalysis" }),
    createPromptedAgent({ name: "technical-trigger", personaKey: "technical", promptKey: "technicalAnalysis" }),
    createPromptedAgent({ name: "technical-liquidity", personaKey: "technical", promptKey: "technicalAnalysis" }),
    createPromptedAgent({ name: "technical-momentum", personaKey: "technical", promptKey: "technicalAnalysis" }),
    createPromptedAgent({ name: "macro-driver", personaKey: "fundamental", promptKey: "fundamentalAnalysis" }),
    createPromptedAgent({ name: "rates-usd-yields", personaKey: "fundamental", promptKey: "fundamentalAnalysis" }),
    createPromptedAgent({ name: "central-bank-event-risk", personaKey: "fundamental", promptKey: "fundamentalAnalysis" }),
    createPromptedAgent({ name: "positioning-intermarket", personaKey: "fundamental", promptKey: "fundamentalAnalysis" }),
    createPromptedAgent({ name: "regime-confluence", personaKey: "entry", promptKey: "precisionEntry" }),
    createPromptedAgent({ name: "precision-entry", personaKey: "entry", promptKey: "precisionEntry" }),
    createPromptedAgent({ name: "risk-qualification", personaKey: "risk", promptKey: "riskQualification" }),
    createPromptedAgent({ name: "critic-challenge", personaKey: "critic", promptKey: "critic" }),
    createPromptedAgent({ name: "report-writer", personaKey: "reporter", promptKey: "reportWriter" }),
  ];
}

export function registerDefaultAurumAgents(orchestrator) {
  const agents = createDefaultAurumAgents();
  agents.forEach((agent) => orchestrator.registerAgent(agent));
  return agents.map((agent) => agent.name);
}

export function createDefaultAurumWorkflows() {
  return createSignalWorkflowSet();
}

export function createDefaultPromptVariables(context) {
  return {
    workflowId: context.workflowId,
    stageName: context.stageName || "",
    symbol: context.userRequest?.symbol || "XAU/USD",
    profileName: context.profile?.name || "default",
    notes: JSON.stringify(buildEvidenceStub("prompt", context)),
  };
}
