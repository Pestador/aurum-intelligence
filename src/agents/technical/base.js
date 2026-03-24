import { createAgentResult } from "../../domain/evidence.js";

export class TechnicalAgent {
  constructor(config = {}) {
    this.name = config.name ?? "technical-agent";
    this.description = config.description ?? "";
    this.persona = config.persona ?? null;
    this.timeframe = config.timeframe ?? "mixed";
  }

  async analyze(context = {}) {
    return this.run(context);
  }

  async run() {
    throw new Error(`${this.name} must implement run(context)`);
  }

  wrapResult({
    summary = "",
    evidence = [],
    confidence = 0,
    metadata = {},
    status = "completed"
  } = {}) {
    return createAgentResult({
      agentName: this.name,
      status,
      summary,
      evidence,
      confidence,
      metadata: {
        timeframe: this.timeframe,
        ...metadata
      }
    });
  }
}

export function getSnapshot(context = {}) {
  return context.marketSnapshot ?? context.snapshot ?? context.market ?? {};
}

export function getTimeframeCandles(context = {}, timeframe = "1h") {
  const snapshot = getSnapshot(context);
  const direct = snapshot?.timeframes?.[timeframe]?.candles;
  if (Array.isArray(direct)) return direct;
  const fallback = context?.candlesByTimeframe?.[timeframe];
  if (Array.isArray(fallback)) return fallback;
  if (Array.isArray(context?.candles)) return context.candles;
  return [];
}

export function getPrice(context = {}, fallback = 0) {
  const snapshot = getSnapshot(context);
  return snapshot.lastPrice ?? snapshot.price ?? context.price ?? fallback;
}

export function getTimestamp(context = {}) {
  const snapshot = getSnapshot(context);
  return context.timestampUtc ?? context.timestamp ?? snapshot.timestampUtc ?? snapshot.timestamp ?? new Date().toISOString();
}

export function getSymbol(context = {}, fallback = "XAU/USD") {
  const snapshot = getSnapshot(context);
  return snapshot.symbol ?? context.symbol ?? fallback;
}

export function agentDefinition(agent) {
  return {
    name: agent.name,
    description: agent.description,
    persona: agent.persona ?? undefined,
    run: async (context, tools) => agent.run(context, tools)
  };
}
