import { safeJsonClone } from "./validation.js";

function nowIso() {
  return new Date().toISOString();
}

function normalizeLevel(level) {
  const allowed = new Set(["debug", "info", "warn", "error"]);
  return allowed.has(level) ? level : "info";
}

export function createLogger({ serviceName = "aurum", sink = console } = {}) {
  function emit(level, message, context = {}) {
    const entry = {
      ts: nowIso(),
      level: normalizeLevel(level),
      service: serviceName,
      message,
      context: safeJsonClone(context) || {},
    };

    const line = JSON.stringify(entry);
    if (entry.level === "error") {
      sink.error(line);
      return entry;
    }
    if (entry.level === "warn") {
      sink.warn(line);
      return entry;
    }
    sink.log(line);
    return entry;
  }

  return {
    debug(message, context) {
      return emit("debug", message, context);
    },
    info(message, context) {
      return emit("info", message, context);
    },
    warn(message, context) {
      return emit("warn", message, context);
    },
    error(message, context) {
      return emit("error", message, context);
    },
  };
}
