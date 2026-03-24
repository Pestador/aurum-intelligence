const DEFAULT_CONFIDENCE = 0.5;

export function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function clamp(value, min, max) {
  if (!isFiniteNumber(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function round(value, digits = 2) {
  if (!isFiniteNumber(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

export function scoreBand(score) {
  if (score >= 85) return "strong";
  if (score >= 70) return "good";
  if (score >= 55) return "mixed";
  return "weak";
}

export function weightedAverage(items) {
  const pairs = items.filter((item) => isFiniteNumber(item?.value) && isFiniteNumber(item?.weight) && item.weight > 0);
  const totalWeight = pairs.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight === 0) return 0;
  const weighted = pairs.reduce((sum, item) => sum + item.value * item.weight, 0);
  return weighted / totalWeight;
}

export function buildEvidence({
  id,
  agent,
  domain,
  status,
  direction = "neutral",
  confidence = DEFAULT_CONFIDENCE,
  summary,
  support = [],
  risks = [],
  caveats = [],
  metrics = {},
  sourceRefs = [],
}) {
  return {
    id,
    agent,
    domain,
    status,
    direction,
    confidence: round(clamp(confidence, 0, 1), 2),
    summary,
    support: asArray(support),
    risks: asArray(risks),
    caveats: asArray(caveats),
    metrics,
    sourceRefs: asArray(sourceRefs),
  };
}

export function buildConfluence({
  id,
  regime,
  technicalScore = 0,
  fundamentalScore = 0,
  executionScore = 0,
  combinedScore = 0,
  allowedStrategies = [],
  blockedReasons = [],
  technicalBias = "neutral",
  fundamentalBias = "neutral",
}) {
  return {
    id,
    regime,
    technicalScore: round(technicalScore, 1),
    fundamentalScore: round(fundamentalScore, 1),
    executionScore: round(executionScore, 1),
    combinedScore: round(combinedScore, 1),
    allowedStrategies: asArray(allowedStrategies),
    blockedReasons: asArray(blockedReasons),
    technicalBias,
    fundamentalBias,
  };
}

export function buildTradeCandidate({
  id,
  direction,
  status,
  entryZone,
  triggerType,
  confirmationRules = [],
  cancelBeforeEntry = [],
  stopLoss,
  takeProfitLevels = [],
  rrProfile = {},
  invalidation,
  bestSession,
  confidence = DEFAULT_CONFIDENCE,
  evidenceRefs = [],
  thesis,
  notes = [],
}) {
  return {
    id,
    direction,
    status,
    entryZone,
    triggerType,
    confirmationRules: asArray(confirmationRules),
    cancelBeforeEntry: asArray(cancelBeforeEntry),
    stopLoss,
    takeProfitLevels: asArray(takeProfitLevels),
    rrProfile,
    invalidation,
    bestSession,
    confidence: round(clamp(confidence, 0, 1), 2),
    evidenceRefs: asArray(evidenceRefs),
    thesis,
    notes: asArray(notes),
  };
}

export function buildRiskReview({
  id,
  candidateId,
  status,
  stopQuality,
  targetRealism,
  eventRiskState,
  policyViolations = [],
  notes = [],
  confidence = DEFAULT_CONFIDENCE,
}) {
  return {
    id,
    candidateId,
    status,
    stopQuality,
    targetRealism,
    eventRiskState,
    policyViolations: asArray(policyViolations),
    notes: asArray(notes),
    confidence: round(clamp(confidence, 0, 1), 2),
  };
}

export function buildCriticReview({
  id,
  candidateId,
  status,
  objections = [],
  confidence = DEFAULT_CONFIDENCE,
}) {
  return {
    id,
    candidateId,
    status,
    objections: asArray(objections),
    confidence: round(clamp(confidence, 0, 1), 2),
  };
}

export function buildExecutionPlan({
  id,
  candidateId,
  status,
  entryPlan,
  stopPlan,
  targetPlan,
  managementNotes = [],
  confidence = DEFAULT_CONFIDENCE,
}) {
  return {
    id,
    candidateId,
    status,
    entryPlan,
    stopPlan,
    targetPlan,
    managementNotes: asArray(managementNotes),
    confidence: round(clamp(confidence, 0, 1), 2),
  };
}

export function buildReport({
  id,
  status,
  headline,
  summary,
  sections = [],
  confidence = DEFAULT_CONFIDENCE,
}) {
  return {
    id,
    status,
    headline,
    summary,
    sections: asArray(sections),
    confidence: round(clamp(confidence, 0, 1), 2),
  };
}

export function buildNoTrade({
  id,
  status = "no_trade",
  reasons = [],
  failedGates = [],
  whatWouldChange = [],
  confidence = DEFAULT_CONFIDENCE,
  evidenceRefs = [],
}) {
  return {
    id,
    status,
    reasons: asArray(reasons),
    failedGates: asArray(failedGates),
    whatWouldChange: asArray(whatWouldChange),
    confidence: round(clamp(confidence, 0, 1), 2),
    evidenceRefs: asArray(evidenceRefs),
  };
}
