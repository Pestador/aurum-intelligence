import { assert, assertArray, assertFunction, assertObject, assertString, validateStageList } from "./validation.js";

export function validateWorkflowDefinition(definition) {
  assertObject(definition, "workflow definition");
  assertString(definition.name, "workflow definition.name");
  validateStageList(definition.stages);
  if (definition.timeoutMs !== undefined && definition.timeoutMs !== 0) {
    assert(Number.isFinite(definition.timeoutMs) && definition.timeoutMs > 0, "workflow definition.timeoutMs must be positive");
  }
  return definition;
}

export function validateAgentDefinition(definition) {
  assertObject(definition, "agent definition");
  assertString(definition.name, "agent definition.name");
  assertFunction(definition.run, "agent definition.run");
  if (definition.persona !== undefined) {
    assertObject(definition.persona, "agent definition.persona");
  }
  return definition;
}

export function validateProviderResult(result, label) {
  assertObject(result, `${label} result`);
  assertString(result.status, `${label}.status`);
  return result;
}

export function validatePromptsRegistry(registry) {
  assertObject(registry, "prompt registry");
  assertFunction(registry.get, "prompt registry.get");
  assertFunction(registry.list, "prompt registry.list");
  assertFunction(registry.render, "prompt registry.render");
  return registry;
}

export function ensureArrayOfStrings(values, fieldName) {
  assertArray(values, fieldName);
  values.forEach((value, index) => {
    assertString(value, `${fieldName}[${index}]`);
  });
  return values;
}
