import { safeJsonClone } from "./validation.js";

export function createWorkflowContext({
  workflowId,
  userRequest,
  profile = {},
  runtime = {},
  metadata = {},
} = {}) {
  return {
    workflowId,
    userRequest: userRequest || {},
    profile,
    runtime,
    metadata,
    evidence: [],
    artifacts: [],
    notes: [],
  };
}

export function createStageResult({
  stageName,
  status,
  outputs = [],
  notes = [],
  error = null,
} = {}) {
  return {
    stageName,
    status,
    outputs: safeJsonClone(outputs) || [],
    notes: safeJsonClone(notes) || [],
    error: error
      ? {
          name: error.name,
          message: error.message,
          code: error.code || null,
          details: error.details || null,
        }
      : null,
  };
}

export function createAgentReport({
  agentName,
  status,
  summary,
  evidence = [],
  confidence = 0,
  metadata = {},
} = {}) {
  return {
    agentName,
    status,
    summary,
    confidence,
    evidence: safeJsonClone(evidence) || [],
    metadata: safeJsonClone(metadata) || {},
  };
}
