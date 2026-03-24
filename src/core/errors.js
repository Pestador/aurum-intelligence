export class AurumError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = options.code || "AURUM_ERROR";
    this.details = options.details || null;
    this.cause = options.cause || null;
  }
}

export class ValidationError extends AurumError {
  constructor(message, details = null) {
    super(message, { code: "VALIDATION_ERROR", details });
  }
}

export class WorkflowError extends AurumError {
  constructor(message, details = null) {
    super(message, { code: "WORKFLOW_ERROR", details });
  }
}

export class AgentError extends AurumError {
  constructor(message, details = null) {
    super(message, { code: "AGENT_ERROR", details });
  }
}

export class ProviderError extends AurumError {
  constructor(message, details = null) {
    super(message, { code: "PROVIDER_ERROR", details });
  }
}

export function toError(value, fallbackMessage = "Unexpected failure") {
  if (value instanceof Error) return value;
  if (typeof value === "string") return new Error(value);
  return new Error(fallbackMessage);
}
