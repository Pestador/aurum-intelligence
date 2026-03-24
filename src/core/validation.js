import { ValidationError } from "./errors.js";

export function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function assert(condition, message, details = null) {
  if (!condition) {
    throw new ValidationError(message, details);
  }
}

export function assertString(value, fieldName, { allowEmpty = false } = {}) {
  assert(typeof value === "string", `${fieldName} must be a string`, { fieldName, value });
  assert(allowEmpty || value.trim().length > 0, `${fieldName} must not be empty`, {
    fieldName,
    value,
  });
  return value;
}

export function assertFunction(value, fieldName) {
  assert(typeof value === "function", `${fieldName} must be a function`, { fieldName });
  return value;
}

export function assertArray(value, fieldName) {
  assert(Array.isArray(value), `${fieldName} must be an array`, { fieldName, value });
  return value;
}

export function assertObject(value, fieldName) {
  assert(isPlainObject(value), `${fieldName} must be an object`, { fieldName, value });
  return value;
}

export function safeJsonClone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export function validateStageList(stages) {
  assertArray(stages, "workflow.stages");
  stages.forEach((stage, index) => {
    assertObject(stage, `workflow.stages[${index}]`);
    assertString(stage.name, `workflow.stages[${index}].name`);
    assertArray(stage.agentNames, `workflow.stages[${index}].agentNames`);
    stage.agentNames.forEach((agentName, agentIndex) => {
      assertString(agentName, `workflow.stages[${index}].agentNames[${agentIndex}]`);
    });
  });
  return stages;
}
