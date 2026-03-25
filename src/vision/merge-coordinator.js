function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function normalizeDirection(direction = "neutral") {
  const normalized = String(direction).toLowerCase();
  if (normalized === "long") return "bullish";
  if (normalized === "short") return "bearish";
  if (normalized === "bullish" || normalized === "bearish" || normalized === "mixed" || normalized === "neutral") {
    return normalized;
  }
  return "neutral";
}

function deriveApiDirection(apiFinalState = {}) {
  const candidateDirection = normalizeDirection(apiFinalState?.candidate?.direction || "");
  if (candidateDirection !== "neutral") return candidateDirection;

  const technicalDirection = normalizeDirection(apiFinalState?.technicalContext?.directionBias || "");
  if (technicalDirection !== "neutral") return technicalDirection;

  return "neutral";
}

function deriveApiConfidence(apiFinalState = {}) {
  const confluence = apiFinalState?.confluence?.combinedScore;
  if (Number.isFinite(confluence)) return clamp(confluence / 100);

  const candidateConfidence = apiFinalState?.candidate?.confidence;
  if (Number.isFinite(candidateConfidence)) return clamp(candidateConfidence);

  return apiFinalState?.finalStatus === "approved" ? 0.72 : apiFinalState?.finalStatus === "conditional" ? 0.58 : 0.5;
}

function alignmentScore(apiDirection, visionDirection) {
  if (!visionDirection || visionDirection === "neutral") return 0.55;
  if (visionDirection === "mixed") return 0.45;
  if (apiDirection === "neutral" || apiDirection === "mixed") return 0.5;
  if (apiDirection === visionDirection) return 1;
  return 0;
}

function chooseFinalStatus({ apiStatus, align, visionDirection, visionConfidence }) {
  if (apiStatus === "no_trade") return "no_trade";
  if (apiStatus === "rejected") return "rejected";

  const strongOpposition = align === 0 && visionDirection !== "mixed" && visionDirection !== "neutral" && visionConfidence >= 0.55;

  if (strongOpposition) {
    return "rejected";
  }

  if (apiStatus === "approved" && align < 0.35) {
    return "conditional";
  }

  if (apiStatus === "conditional" && align < 0.2) {
    return "no_trade";
  }

  return apiStatus;
}

function buildSummary({ finalStatus, apiStatus, apiDirection, visionDirection, align, mergedConfidence }) {
  return [
    `Merged status is ${finalStatus}.`,
    `API pipeline status: ${apiStatus}.`,
    `API direction: ${apiDirection}.`,
    `Vision direction: ${visionDirection}.`,
    `Alignment score: ${align.toFixed(2)}.`,
    `Merged confidence: ${mergedConfidence.toFixed(2)}.`,
  ].join(" ");
}

export function mergeApiAndVisionDecision({
  apiWorkflow = null,
  apiFinalState = null,
  visionMonitor = null,
} = {}) {
  const apiState = apiFinalState || {};
  const apiStatus = apiState.finalStatus || "no_trade";
  const apiDirection = deriveApiDirection(apiState);
  const apiConfidence = deriveApiConfidence(apiState);

  const visionAggregate = visionMonitor?.aggregate || null;
  const visionDirection = normalizeDirection(visionAggregate?.direction || "neutral");
  const visionConfidence = clamp(Number.isFinite(visionAggregate?.confidence) ? visionAggregate.confidence : 0);

  const align = alignmentScore(apiDirection, visionDirection);
  const mergedConfidence = clamp((apiConfidence * 0.6 + visionConfidence * 0.4) * (0.6 + align * 0.4));
  const finalStatus = chooseFinalStatus({
    apiStatus,
    align,
    visionDirection,
    visionConfidence,
  });

  const reasons = [];
  if (align === 1) {
    reasons.push("API and vision direction are aligned.");
  } else if (align === 0) {
    reasons.push("Vision direction conflicts with API direction.");
  } else {
    reasons.push("Vision direction is mixed or neutral against API direction.");
  }

  if (visionMonitor?.status !== "completed") {
    reasons.push("Vision monitor did not complete; final decision leans on API pipeline.");
  }

  if (apiStatus === "no_trade") {
    reasons.push("API pipeline preferred no-trade, which remains the governing decision.");
  }

  return {
    status: "completed",
    finalStatus,
    mergedConfidence,
    api: {
      status: apiStatus,
      direction: apiDirection,
      confidence: apiConfidence,
      workflowStatus: apiWorkflow?.status || null,
    },
    vision: {
      status: visionMonitor?.status || "unavailable",
      direction: visionDirection,
      confidence: visionConfidence,
      weightedScore: Number.isFinite(visionAggregate?.weightedScore) ? visionAggregate.weightedScore : 0,
      timeframeVotes: visionAggregate?.timeframeVotes || [],
    },
    alignment: {
      score: align,
      verdict: align >= 0.8 ? "aligned" : align <= 0.2 ? "conflicted" : "mixed",
    },
    reasons,
    summary: buildSummary({
      finalStatus,
      apiStatus,
      apiDirection,
      visionDirection,
      align,
      mergedConfidence,
    }),
    createdAt: new Date().toISOString(),
  };
}
