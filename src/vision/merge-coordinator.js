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

function deriveApiQuality(apiFinalState = {}, apiWorkflow = null) {
  const snapshot = apiFinalState?.marketSnapshot || {};
  const liveData = snapshot?.liveData || {};
  const health = snapshot?.health || {};
  const source = snapshot?.source || health?.source || "unknown";
  const notes = Array.isArray(liveData?.notes) ? liveData.notes : [];

  return {
    mode: liveData?.mode || "unknown",
    source,
    degraded: Boolean(liveData?.degraded || health?.degraded || health?.ok === false || apiWorkflow?.status === "failed"),
    notes,
  };
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

function visionDirectionalVoteCount(votes = [], direction = "neutral") {
  if (!Array.isArray(votes)) return 0;
  return votes.filter((vote) => String(vote?.direction || "").toLowerCase() === direction).length;
}

function deriveVisionFallback({
  apiStatus,
  apiQuality,
  visionDirection,
  visionConfidence,
  visionWeightedScore,
  timeframeVotes = [],
} = {}) {
  if (apiStatus !== "no_trade" || !apiQuality?.degraded) {
    return {
      activated: false,
      reason: "Fallback only applies when API returns no-trade under degraded data quality.",
      threshold: { minConfidence: 0.58, minWeightedScoreAbs: 0.22, minDirectionalVotes: 2 },
    };
  }

  const directional = visionDirection === "bullish" || visionDirection === "bearish";
  const weightedScoreAbs = Math.abs(Number(visionWeightedScore) || 0);
  const directionalVotes = visionDirectionalVoteCount(timeframeVotes, visionDirection);
  const strongVisionSignal = directional
    && visionConfidence >= 0.58
    && (weightedScoreAbs >= 0.22 || directionalVotes >= 2);

  if (!strongVisionSignal) {
    return {
      activated: false,
      reason: "Vision signal was not strong enough to promote fallback.",
      threshold: { minConfidence: 0.58, minWeightedScoreAbs: 0.22, minDirectionalVotes: 2 },
      measured: {
        directional,
        confidence: visionConfidence,
        weightedScoreAbs,
        directionalVotes,
      },
    };
  }

  return {
    activated: true,
    finalStatus: "conditional",
    direction: visionDirection,
    reason: "API data is degraded; using a vision-led conditional fallback signal.",
    measured: {
      confidence: visionConfidence,
      weightedScoreAbs,
      directionalVotes,
    },
    safeguards: [
      "Treat as conditional until API data quality normalizes.",
      "Use tighter risk and confirmation requirements before entry.",
    ],
  };
}

function normalizeCandidateDirection(candidateDirection = "neutral", technicalDirection = "neutral") {
  if (candidateDirection && candidateDirection !== "neutral") return candidateDirection;
  if (technicalDirection && technicalDirection !== "neutral") return technicalDirection;
  return "neutral";
}

function buildSummary({
  finalStatus,
  apiStatus,
  apiDirection,
  visionDirection,
  align,
  mergedConfidence,
  fallback = null,
}) {
  return [
    `Merged status is ${finalStatus}.`,
    `API pipeline status: ${apiStatus}.`,
    `API direction: ${apiDirection}.`,
    `Vision direction: ${visionDirection}.`,
    `Alignment score: ${align.toFixed(2)}.`,
    `Merged confidence: ${mergedConfidence.toFixed(2)}.`,
    fallback?.activated ? "Vision fallback mode is active due to degraded API data." : "",
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
  const apiQuality = deriveApiQuality(apiState, apiWorkflow);

  const visionAggregate = visionMonitor?.aggregate || null;
  const visionDirection = normalizeDirection(visionAggregate?.direction || "neutral");
  const visionConfidence = clamp(Number.isFinite(visionAggregate?.confidence) ? visionAggregate.confidence : 0);
  const visionWeightedScore = Number.isFinite(visionAggregate?.weightedScore) ? visionAggregate.weightedScore : 0;
  const timeframeVotes = Array.isArray(visionAggregate?.timeframeVotes) ? visionAggregate.timeframeVotes : [];

  const align = alignmentScore(apiDirection, visionDirection);
  let mergedConfidence = clamp((apiConfidence * 0.6 + visionConfidence * 0.4) * (0.6 + align * 0.4));
  let finalStatus = chooseFinalStatus({
    apiStatus,
    align,
    visionDirection,
    visionConfidence,
  });

  const fallback = deriveVisionFallback({
    apiStatus,
    apiQuality,
    visionDirection,
    visionConfidence,
    visionWeightedScore,
    timeframeVotes,
  });
  if (fallback.activated) {
    finalStatus = fallback.finalStatus;
    const fallbackConfidence = clamp(visionConfidence * 0.8 * (0.8 + Math.min(Math.abs(visionWeightedScore), 1) * 0.2));
    mergedConfidence = clamp(Math.max(mergedConfidence, fallbackConfidence));
  }

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

  if (fallback.activated) {
    reasons.push(fallback.reason);
  }

  if (apiQuality.degraded) {
    reasons.push("API data quality is degraded.");
  }

  const candidateDirection = normalizeDirection(apiState?.candidate?.direction || "");
  const technicalDirection = normalizeDirection(apiState?.technicalContext?.directionBias || "");
  const baseDirection = normalizeCandidateDirection(candidateDirection, technicalDirection);
  const finalDirection = fallback.activated
    ? fallback.direction
    : (baseDirection !== "neutral" ? baseDirection : visionDirection);

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
      weightedScore: visionWeightedScore,
      timeframeVotes,
    },
    apiQuality,
    fallback,
    alignment: {
      score: align,
      verdict: align >= 0.8 ? "aligned" : align <= 0.2 ? "conflicted" : "mixed",
    },
    signal: {
      status: finalStatus,
      direction: finalDirection,
      confidence: mergedConfidence,
      source: fallback.activated ? "vision_fallback" : "api_vision_merge",
      entryZone: apiState?.candidate?.entryZone || apiState?.technicalContext?.entryZone || null,
      stopLoss: apiState?.candidate?.stopLoss || apiState?.technicalContext?.stopLoss || null,
      targets: apiState?.candidate?.takeProfitLevels || apiState?.technicalContext?.targets || [],
      rr: apiState?.candidate?.rrProfile?.primary || null,
    },
    reasons,
    summary: buildSummary({
      finalStatus,
      apiStatus,
      apiDirection,
      visionDirection,
      align,
      mergedConfidence,
      fallback,
    }),
    createdAt: new Date().toISOString(),
  };
}
