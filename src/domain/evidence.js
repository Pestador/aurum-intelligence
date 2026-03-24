import { clamp, round, toNumber } from "./numeric.js";

export function createEvidence({
  domain,
  agent,
  symbol = "XAU/USD",
  timeframe = "mixed",
  direction = "neutral",
  confidence = 0,
  summary = "",
  thesis = "",
  signals = [],
  levels = [],
  ranges = [],
  disqualifiers = [],
  caveats = [],
  score = null,
  status = "active",
  source = {}
} = {}) {
  const normalizedConfidence = round(clamp(toNumber(confidence, 0), 0, 1), 3);
  return {
    evidenceId: `${agent ?? "agent"}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`,
    domain,
    agent,
    symbol,
    timeframe,
    direction,
    confidence: normalizedConfidence,
    score: score == null ? normalizedConfidence : round(clamp(toNumber(score, normalizedConfidence), 0, 1), 3),
    summary,
    thesis,
    signals,
    levels,
    ranges,
    disqualifiers,
    caveats,
    status,
    source,
    generatedAt: new Date().toISOString()
  };
}

export function createAgentResult({
  agentName,
  status = "completed",
  summary = "",
  evidence = [],
  confidence = 0,
  metadata = {}
} = {}) {
  return {
    status,
    summary,
    evidence,
    confidence: round(clamp(toNumber(confidence, 0), 0, 1), 3),
    metadata: {
      agentName,
      ...metadata
    }
  };
}

export function createNoTradeEvidence({
  agent,
  symbol = "XAU/USD",
  timeframe = "mixed",
  reasons = [],
  caveats = [],
  confidence = 0.75
} = {}) {
  return createEvidence({
    domain: "technical",
    agent,
    symbol,
    timeframe,
    direction: "neutral",
    confidence,
    summary: "No-trade",
    thesis: "Conditions do not justify a high-quality setup.",
    disqualifiers: reasons,
    caveats,
    status: "no_trade"
  });
}
