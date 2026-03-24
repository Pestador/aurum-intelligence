import { createAgentReport, createRuleBasedAgent, createWorkflowDefinition } from "./core/index.js";
import { createTechnicalAgents } from "./agents/technical/index.js";
import { macroDriverSynthesisAgent, ratesUsdYieldsAgent, centralBankInflationEventRiskAgent, positioningGeopoliticsIntermarketAgent } from "./agents/fundamental/index.mjs";
import { regimeConfluenceAgent, precisionTradeConstructionAgent, riskQualificationAgent, criticChallengeAgent, executionPlannerAgent } from "./agents/signal/index.mjs";
import { reportWriterAgent } from "./agents/reporting/index.mjs";

function ensureState(context) {
  context.runtime = context.runtime || {};
  context.runtime.state = context.runtime.state || {
    promptsUsed: {},
    technical: {},
    technicalEvidence: {},
    fundamentalEvidence: {},
  };
  return context.runtime.state;
}

function average(values = []) {
  const numbers = values.filter((value) => Number.isFinite(value));
  if (!numbers.length) return 0;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function normalizePrompt(tools, promptKey, context, fallbackSystemPrompt = "") {
  const rendered = tools.prompts?.render?.(promptKey, {
    symbol: context.userRequest?.symbol || "XAU/USD",
    workflowId: context.workflowId,
    stageName: context.stageName || "",
  });
  return {
    system: rendered?.system || fallbackSystemPrompt,
    persona: rendered?.persona || null,
  };
}

function uniqueLevels(levels = []) {
  const seen = new Set();
  return levels.filter((level) => {
    const price = round(Number(level?.price ?? 0), 2);
    if (!price || seen.has(price)) return false;
    seen.add(price);
    return true;
  });
}

function deriveTargetLevels(direction, entryZone, stopLoss, htfEvidence, liquidityEvidence) {
  const entry = direction === "long" ? entryZone.high : entryZone.low;
  const risk = direction === "long" ? entry - stopLoss.price : stopLoss.price - entry;
  const levels = uniqueLevels([
    ...(htfEvidence?.levels || []),
    ...(liquidityEvidence?.levels || []),
  ]);

  const directionalLevels = levels
    .filter((level) => direction === "long" ? level.price > entry : level.price < entry)
    .sort((a, b) => direction === "long" ? a.price - b.price : b.price - a.price);

  const targets = [];
  for (const level of directionalLevels.slice(0, 3)) {
    targets.push({
      price: round(level.price),
      note: `reaction level from ${level.source || "structure"}`,
    });
  }

  const extensionMultiples = [6, 8, 10];
  for (const multiple of extensionMultiples) {
    const extensionPrice = direction === "long"
      ? entry + risk * multiple
      : entry - risk * multiple;
    if (!targets.some((target) => Math.abs(target.price - extensionPrice) < risk * 0.4)) {
      targets.push({
        price: round(extensionPrice),
        note: `measured extension at ${multiple}R`,
      });
    }
    if (targets.length >= 3) break;
  }

  return targets.slice(0, 3);
}

function primaryRrFromTargets(direction, entryZone, stopLoss, targets) {
  if (!entryZone || !stopLoss || !Array.isArray(targets) || !targets.length) return 0;
  const entry = direction === "long" ? entryZone.high : entryZone.low;
  const risk = direction === "long" ? entry - stopLoss.price : stopLoss.price - entry;
  if (!(risk > 0)) return 0;
  const reward = direction === "long" ? targets[0].price - entry : entry - targets[0].price;
  if (!(reward > 0)) return 0;
  return reward / risk;
}

function buildTechnicalContext(state) {
  const seed = state.marketSnapshot?.technicalContext || {};
  const htfReport = state.technical["technical-htf"];
  const triggerReport = state.technical["technical-trigger"];
  const liquidityReport = state.technical["technical-liquidity"];
  const momentumReport = state.technical["technical-momentum"];

  const htfEvidence = htfReport?.evidence?.[0] || {};
  const triggerEvidence = triggerReport?.evidence?.[0] || {};
  const liquidityEvidence = liquidityReport?.evidence?.[0] || {};
  const momentumEvidence = momentumReport?.evidence?.[0] || {};

  const directionBias = triggerEvidence.direction && triggerEvidence.direction !== "neutral"
    ? triggerEvidence.direction
    : htfEvidence.direction || seed.directionBias || "neutral";
  const entryZone = triggerReport?.metadata?.entryZone || triggerEvidence?.ranges?.[0] || seed.entryZone || null;
  const stopPrice = triggerReport?.metadata?.stop || seed.stopLoss?.price || null;
  const stopLoss = stopPrice
    ? {
        price: round(stopPrice),
        reason: seed.stopLoss?.reason || `Beyond ${triggerReport?.metadata?.triggerType || "execution"} trigger invalidation.`,
      }
    : null;
  const bestSession = momentumReport?.metadata?.session || seed.bestSession || "unknown";
  const sessionScore = momentumReport?.metadata?.tradeability === "tradeable"
    ? 82
    : momentumReport?.metadata?.tradeability === "caution"
      ? 61
      : seed.sessionScore || 38;
  const derivedTargets = entryZone && stopLoss
    ? deriveTargetLevels(
        directionBias === "bullish" ? "long" : "short",
        entryZone,
        stopLoss,
        htfEvidence,
        liquidityEvidence,
      )
    : [];
  const preferredDirection = directionBias === "bullish" ? "long" : "short";
  const derivedPrimaryRr = primaryRrFromTargets(preferredDirection, entryZone, stopLoss, derivedTargets);
  const seedPrimaryRr = primaryRrFromTargets(preferredDirection, entryZone, stopLoss, seed.targets || []);
  const targets = derivedPrimaryRr >= 6 || seedPrimaryRr <= derivedPrimaryRr
    ? derivedTargets
    : (seed.targets || []);

  const entry = directionBias === "bearish" ? entryZone?.low : entryZone?.high;
  const risk = stopLoss && Number.isFinite(entry)
    ? Math.abs(entry - stopLoss.price)
    : 0;
  const primaryTarget = targets[0]?.price;
  const primaryReward = Number.isFinite(primaryTarget) && Number.isFinite(entry)
    ? Math.abs(primaryTarget - entry)
    : 0;
  const runwayScore = risk > 0 ? round(primaryReward / risk, 1) : 0;

  return {
    directionBias,
    regimeHint: htfReport?.metadata?.state || seed.regimeHint || "transition",
    structureScore: Math.max(Math.round((htfReport?.confidence || 0) * 100), seed.structureScore || 0),
    triggerScore: Math.max(Math.round((triggerReport?.confidence || 0) * 100), seed.triggerScore || 0),
    liquidityScore: Math.max(Math.round((liquidityReport?.confidence || 0) * 100), seed.liquidityScore || 0),
    volatilityScore: Math.max(Math.round((momentumReport?.confidence || 0) * 100), seed.volatilityScore || 0),
    sessionScore,
    entryZone,
    triggerType: triggerReport?.metadata?.triggerType && triggerReport.metadata.triggerType !== "none"
      ? triggerReport.metadata.triggerType
      : seed.triggerType || "conditional",
    confirmationRules: [
      ...(seed.confirmationRules || []),
      triggerEvidence.summary || "Wait for execution-timeframe confirmation at the entry zone.",
      momentumEvidence.summary || "Ensure session and volatility remain supportive.",
    ].filter(Boolean),
    cancelBeforeEntry: [
      ...(seed.cancelBeforeEntry || []),
      momentumReport?.metadata?.tradeability === "avoid" ? "Stand down if session quality degrades further." : "",
      stopLoss ? `Cancel if price accepts beyond ${stopLoss.price} before entry.` : "",
    ].filter(Boolean),
    stopLoss,
    targets,
    invalidation: seed.invalidation || (stopLoss ? `Acceptance beyond ${stopLoss.price} invalidates the setup.` : "Invalidation not available."),
    bestSession,
    runwayScore: Math.max(runwayScore, seed.runwayScore || 0),
    thesis: [
      seed.thesis,
      htfEvidence.summary,
      triggerEvidence.summary,
      liquidityEvidence.summary,
      momentumEvidence.summary,
    ].filter(Boolean).join(" "),
    evidenceRefs: [
      ...(seed.evidenceRefs || []),
      htfEvidence.evidenceId,
      triggerEvidence.evidenceId,
      liquidityEvidence.evidenceId,
      momentumEvidence.evidenceId,
    ].filter(Boolean),
  };
}

function determineFinalStatus(state) {
  if (!state.candidate || state.candidate.status === "no_trade") return "no_trade";
  if (state.riskReview?.status === "fail") return "no_trade";
  if (state.criticReview?.status === "block") return "rejected";
  if (state.riskReview?.status === "conditional" || state.criticReview?.status === "caution") return "conditional";
  return "approved";
}

function createMarketDataAgent() {
  return createRuleBasedAgent({
    name: "market-data",
    description: "Loads the current market snapshot and stores it for the workflow.",
    personaKey: "orchestrator",
    run: async (context, tools) => {
      const state = ensureState(context);
      const snapshot = await tools.providers.market.getSnapshot({
        symbol: context.userRequest?.symbol || "XAU/USD",
        fixtureName: context.userRequest?.fixtureName || "bullishRetest",
      });
      state.marketSnapshot = structuredClone(snapshot);
      state.promptsUsed["market-data"] = {
        system: "Load the snapshot, validate freshness, and hand off a normalized gold market state.",
        persona: { key: "orchestrator" },
      };

      return createAgentReport({
        agentName: "market-data",
        status: snapshot.health?.ok === false ? "rejected" : "completed",
        summary: `Loaded ${snapshot.symbol || "XAU/USD"} snapshot for ${context.userRequest?.fixtureName || "default"} scenario.`,
        evidence: [snapshot],
        confidence: snapshot.health?.ok === false ? 0.2 : 0.95,
        metadata: {
          source: snapshot.source || "fixture-market-provider",
          session: snapshot.session?.name || snapshot.session || "unknown",
          fixtureName: context.userRequest?.fixtureName || "bullishRetest",
        },
      });
    },
  });
}

function wrapTechnicalAgent(agentDefinition) {
  return createRuleBasedAgent({
    name: agentDefinition.name,
    description: agentDefinition.description,
    personaKey: "technical",
    run: async (context, tools) => {
      const state = ensureState(context);
      const prompt = normalizePrompt(tools, "technicalAnalysis", context, "Analyze gold structure with precision.");
      const input = {
        marketSnapshot: state.marketSnapshot,
        snapshot: state.marketSnapshot,
        keyLevels: state.technicalEvidence["technical-htf"]?.levels || [],
      };
      const result = await agentDefinition.run(input, tools);
      state.technical[agentDefinition.name] = structuredClone(result);
      state.technicalEvidence[agentDefinition.name] = structuredClone(result.evidence?.[0] || {});
      state.promptsUsed[agentDefinition.name] = prompt;

      return createAgentReport({
        agentName: agentDefinition.name,
        status: result.status || "completed",
        summary: result.summary,
        evidence: result.evidence || [],
        confidence: result.confidence || 0,
        metadata: {
          ...result.metadata,
          prompt,
        },
      });
    },
  });
}

function wrapAnalyzeAgent({
  name,
  personaKey,
  promptKey,
  systemPrompt,
  targetKey,
  buildInput,
  analyze,
  buildSummary,
  buildMetadata,
}) {
  return createRuleBasedAgent({
    name,
    description: `${name} wrapper`,
    personaKey,
    run: async (context, tools) => {
      const state = ensureState(context);
      const prompt = normalizePrompt(tools, promptKey, context, systemPrompt);
      const input = buildInput(context, state, tools);
      const result = await analyze(input);
      state[targetKey] = structuredClone(result);
      state.promptsUsed[name] = prompt;

      return createAgentReport({
        agentName: name,
        status: "completed",
        summary: buildSummary ? buildSummary(result) : result.summary || `${name} completed`,
        evidence: result.evidence ? [result] : [],
        confidence: result.confidence || 0,
        metadata: buildMetadata ? buildMetadata(result, prompt) : { prompt, id: result.id || null },
      });
    },
  });
}

function getFundamentalEvidence(state) {
  return {
    macro: state.macroEvidence,
    rates: state.ratesEvidence,
    eventRisk: state.eventRiskEvidence,
    positioning: state.positioningEvidence,
  };
}

function createFundamentalAgents() {
  return [
    wrapAnalyzeAgent({
      name: "macro-driver",
      personaKey: "fundamental",
      promptKey: "fundamentalAnalysis",
      systemPrompt: macroDriverSynthesisAgent.systemPrompt,
      targetKey: "macroEvidence",
      buildInput: (_, state) => ({ marketSnapshot: state.marketSnapshot }),
      analyze: macroDriverSynthesisAgent.analyze,
      buildSummary: (result) => result.summary,
      buildMetadata: (result, prompt) => ({ prompt, metrics: result.metrics }),
    }),
    wrapAnalyzeAgent({
      name: "rates-usd-yields",
      personaKey: "fundamental",
      promptKey: "fundamentalAnalysis",
      systemPrompt: ratesUsdYieldsAgent.systemPrompt,
      targetKey: "ratesEvidence",
      buildInput: (_, state) => ({ marketSnapshot: state.marketSnapshot }),
      analyze: ratesUsdYieldsAgent.analyze,
      buildSummary: (result) => result.summary,
      buildMetadata: (result, prompt) => ({ prompt, metrics: result.metrics }),
    }),
    wrapAnalyzeAgent({
      name: "central-bank-event-risk",
      personaKey: "fundamental",
      promptKey: "fundamentalAnalysis",
      systemPrompt: centralBankInflationEventRiskAgent.systemPrompt,
      targetKey: "eventRiskEvidence",
      buildInput: (_, state) => ({ marketSnapshot: state.marketSnapshot }),
      analyze: centralBankInflationEventRiskAgent.analyze,
      buildSummary: (result) => result.summary,
      buildMetadata: (result, prompt) => ({ prompt, metrics: result.metrics }),
    }),
    wrapAnalyzeAgent({
      name: "positioning-intermarket",
      personaKey: "fundamental",
      promptKey: "fundamentalAnalysis",
      systemPrompt: positioningGeopoliticsIntermarketAgent.systemPrompt,
      targetKey: "positioningEvidence",
      buildInput: (_, state) => ({ marketSnapshot: state.marketSnapshot }),
      analyze: positioningGeopoliticsIntermarketAgent.analyze,
      buildSummary: (result) => result.summary,
      buildMetadata: (result, prompt) => ({ prompt, metrics: result.metrics }),
    }),
  ];
}

function createSignalAgents() {
  return [
    wrapAnalyzeAgent({
      name: "regime-confluence",
      personaKey: "entry",
      promptKey: "precisionEntry",
      systemPrompt: regimeConfluenceAgent.systemPrompt,
      targetKey: "confluence",
      buildInput: (_, state) => {
        state.technicalContext = buildTechnicalContext(state);
        return {
          marketSnapshot: state.marketSnapshot,
          technicalContext: state.technicalContext,
          fundamentalEvidence: getFundamentalEvidence(state),
        };
      },
      analyze: regimeConfluenceAgent.analyze,
      buildSummary: (result) => `Regime ${result.regime} with confluence ${result.combinedScore}.`,
      buildMetadata: (result, prompt) => ({ prompt, regime: result.regime, blockedReasons: result.blockedReasons }),
    }),
    wrapAnalyzeAgent({
      name: "precision-entry",
      personaKey: "entry",
      promptKey: "precisionEntry",
      systemPrompt: precisionTradeConstructionAgent.systemPrompt,
      targetKey: "candidate",
      buildInput: (_, state) => ({
        marketSnapshot: state.marketSnapshot,
        technicalContext: state.technicalContext,
        fundamentalEvidence: getFundamentalEvidence(state),
        confluence: state.confluence,
      }),
      analyze: precisionTradeConstructionAgent.analyze,
      buildSummary: (result) => result.status === "no_trade"
        ? "Precision entry builder returned no-trade."
        : `Constructed ${result.direction} candidate with ${result.triggerType} trigger.`,
      buildMetadata: (result, prompt) => ({ prompt, status: result.status, rr: result.rrProfile?.primary ?? 0 }),
    }),
    wrapAnalyzeAgent({
      name: "risk-qualification",
      personaKey: "risk",
      promptKey: "riskQualification",
      systemPrompt: riskQualificationAgent.systemPrompt,
      targetKey: "riskReview",
      buildInput: (context, state) => ({
        marketSnapshot: state.marketSnapshot,
        candidate: state.candidate,
        fundamentalEvidence: getFundamentalEvidence(state),
        userProfile: context.profile,
      }),
      analyze: riskQualificationAgent.analyze,
      buildSummary: (result) => `Risk review ${result.status} with ${result.eventRiskState} event state.`,
      buildMetadata: (result, prompt) => ({ prompt, status: result.status, policyViolations: result.policyViolations }),
    }),
    wrapAnalyzeAgent({
      name: "critic-challenge",
      personaKey: "critic",
      promptKey: "critic",
      systemPrompt: criticChallengeAgent.systemPrompt,
      targetKey: "criticReview",
      buildInput: (_, state) => ({
        marketSnapshot: state.marketSnapshot,
        candidate: state.candidate,
        riskReview: state.riskReview,
        confluence: state.confluence,
        fundamentalEvidence: getFundamentalEvidence(state),
      }),
      analyze: criticChallengeAgent.analyze,
      buildSummary: (result) => `Critic review ${result.status} with ${result.objections.length} objections.`,
      buildMetadata: (result, prompt) => ({ prompt, status: result.status, objections: result.objections }),
    }),
    wrapAnalyzeAgent({
      name: "execution-planner",
      personaKey: "entry",
      promptKey: "precisionEntry",
      systemPrompt: executionPlannerAgent.systemPrompt,
      targetKey: "executionPlan",
      buildInput: (_, state) => ({
        marketSnapshot: state.marketSnapshot,
        candidate: state.candidate,
        riskReview: state.riskReview,
        criticReview: state.criticReview,
      }),
      analyze: executionPlannerAgent.analyze,
      buildSummary: (result) => result.status === "unavailable"
        ? "Execution plan unavailable because no valid candidate survived."
        : "Execution plan generated.",
      buildMetadata: (result, prompt) => ({ prompt, status: result.status }),
    }),
    wrapAnalyzeAgent({
      name: "report-writer",
      personaKey: "reporter",
      promptKey: "reportWriter",
      systemPrompt: reportWriterAgent.systemPrompt,
      targetKey: "finalReport",
      buildInput: (_, state) => {
        const finalStatus = determineFinalStatus(state);
        state.finalStatus = finalStatus;
        return {
          marketSnapshot: state.marketSnapshot,
          technicalContext: state.technicalContext,
          fundamentalEvidence: getFundamentalEvidence(state),
          confluence: state.confluence,
          candidate: state.candidate,
          riskReview: state.riskReview,
          criticReview: state.criticReview,
          executionPlan: state.executionPlan,
          finalStatus,
        };
      },
      analyze: reportWriterAgent.analyze,
      buildSummary: (result) => result.summary,
      buildMetadata: (result, prompt) => ({ prompt, headline: result.headline, status: result.status }),
    }),
  ];
}

export function createAurumWorkflowSet() {
  const stages = [
    { name: "data", agentNames: ["market-data"], stopOnFailure: true },
    { name: "technical", agentNames: ["technical-htf", "technical-trigger", "technical-liquidity", "technical-momentum"], stopOnFailure: true },
    { name: "fundamental", agentNames: ["macro-driver", "rates-usd-yields", "central-bank-event-risk", "positioning-intermarket"], stopOnFailure: true },
    { name: "qualification", agentNames: ["regime-confluence", "precision-entry", "risk-qualification", "critic-challenge"], stopOnFailure: false, stopOnReject: false },
    { name: "execution", agentNames: ["execution-planner"], stopOnFailure: false, stopOnReject: false },
    { name: "reporting", agentNames: ["report-writer"], stopOnFailure: false, stopOnReject: false },
  ];

  return {
    morningBriefing: createWorkflowDefinition({
      name: "morning-briefing",
      stages,
    }),
    intradayScan: createWorkflowDefinition({
      name: "intraday-scan",
      stages,
    }),
    tradeValidation: createWorkflowDefinition({
      name: "trade-validation",
      stages,
    }),
  };
}

export function createRuntimeAgents() {
  const technicalAgents = createTechnicalAgents().map(wrapTechnicalAgent);
  return [
    createMarketDataAgent(),
    ...technicalAgents,
    ...createFundamentalAgents(),
    ...createSignalAgents(),
  ];
}

export function extractFinalState(workflowResult) {
  const state = workflowResult?.context?.runtime?.state || {};
  return {
    marketSnapshot: state.marketSnapshot || null,
    technicalContext: state.technicalContext || null,
    fundamentalEvidence: getFundamentalEvidence(state),
    confluence: state.confluence || null,
    candidate: state.candidate || null,
    riskReview: state.riskReview || null,
    criticReview: state.criticReview || null,
    executionPlan: state.executionPlan || null,
    report: state.finalReport || null,
    finalStatus: state.finalStatus || determineFinalStatus(state),
    promptsUsed: state.promptsUsed || {},
    averageTechnicalConfidence: round(average(Object.values(state.technical || {}).map((result) => result.confidence || 0)), 3),
  };
}
