import { safeJsonClone } from "./validation.js";

function nowIso() {
  return new Date().toISOString();
}

export function createAuditTrail({ logger = null } = {}) {
  const records = [];

  function record(eventType, payload = {}) {
    const entry = {
      id: `audit_${records.length + 1}`,
      ts: nowIso(),
      eventType,
      payload: safeJsonClone(payload) || {},
    };
    records.push(entry);
    if (logger) {
      logger.info("audit.recorded", { eventType, auditId: entry.id });
    }
    return entry;
  }

  function list() {
    return records.map((item) => safeJsonClone(item));
  }

  function clear() {
    records.length = 0;
  }

  return {
    record,
    list,
    clear,
  };
}
