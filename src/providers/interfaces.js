import { ProviderError } from "../core/errors.js";
import { assertFunction, assertObject, assertString, safeJsonClone } from "../core/validation.js";

export function createProviderInterface(kind, methods = {}) {
  assertString(kind, "provider kind");
  assertObject(methods, "provider methods");
  for (const [name, fn] of Object.entries(methods)) {
    assertFunction(fn, `provider method ${name}`);
  }

  return {
    kind,
    ...methods,
  };
}

export function ensureProviderShape(provider, requiredMethods = []) {
  assertObject(provider, "provider");
  assertString(provider.kind, "provider.kind");
  requiredMethods.forEach((methodName) => {
    assertFunction(provider[methodName], `provider.${methodName}`);
  });
  return provider;
}

export function createProviderHealth({ ok = true, status = "ready", details = {} } = {}) {
  return {
    ok: Boolean(ok),
    status,
    details: safeJsonClone(details) || {},
  };
}

export function wrapProviderCall(kind, methodName, fn) {
  assertString(kind, "provider kind");
  assertString(methodName, "provider method name");
  assertFunction(fn, "provider call fn");

  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      throw new ProviderError(`Provider ${kind}.${methodName} failed`, {
        kind,
        methodName,
        cause: error,
      });
    }
  };
}
