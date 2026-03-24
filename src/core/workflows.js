export function createWorkflowDefinition({
  name,
  stages,
  timeoutMs = 0,
  metadata = {},
} = {}) {
  return {
    name,
    stages,
    timeoutMs,
    metadata,
  };
}

export function createSignalWorkflowSet() {
  return {
    morningBriefing: createWorkflowDefinition({
      name: "morning-briefing",
      stages: [
        { name: "data", agentNames: ["market-data"], stopOnFailure: true },
        { name: "technical", agentNames: ["technical-htf", "technical-trigger", "technical-liquidity", "technical-momentum"], stopOnFailure: true },
        { name: "fundamental", agentNames: ["macro-driver", "rates-usd-yields", "central-bank-event-risk", "positioning-intermarket"], stopOnFailure: true },
        { name: "synthesis", agentNames: ["regime-confluence", "precision-entry", "risk-qualification", "critic-challenge"], stopOnFailure: true },
        { name: "reporting", agentNames: ["report-writer"], stopOnFailure: true },
      ],
    }),
    intradayScan: createWorkflowDefinition({
      name: "intraday-scan",
      stages: [
        { name: "data", agentNames: ["market-data"], stopOnFailure: true },
        { name: "technical", agentNames: ["technical-htf", "technical-trigger", "technical-liquidity", "technical-momentum"], stopOnFailure: true },
        { name: "fundamental", agentNames: ["macro-driver", "rates-usd-yields", "central-bank-event-risk", "positioning-intermarket"], stopOnFailure: true },
        { name: "synthesis", agentNames: ["regime-confluence", "precision-entry", "risk-qualification", "critic-challenge"], stopOnFailure: true },
        { name: "reporting", agentNames: ["report-writer"], stopOnFailure: true },
      ],
    }),
    tradeValidation: createWorkflowDefinition({
      name: "trade-validation",
      stages: [
        { name: "data", agentNames: ["market-data"], stopOnFailure: true },
        { name: "technical", agentNames: ["technical-htf", "technical-trigger", "technical-liquidity", "technical-momentum"], stopOnFailure: true },
        { name: "fundamental", agentNames: ["macro-driver", "rates-usd-yields", "central-bank-event-risk", "positioning-intermarket"], stopOnFailure: true },
        { name: "synthesis", agentNames: ["regime-confluence", "precision-entry", "risk-qualification", "critic-challenge"], stopOnFailure: true },
        { name: "reporting", agentNames: ["report-writer"], stopOnFailure: true },
      ],
    }),
  };
}
