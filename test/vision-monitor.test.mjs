import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { createVisionService } from "../src/vision/service.js";
import { mergeApiAndVisionDecision } from "../src/vision/merge-coordinator.js";

function buildFakeCapture(symbol, timeframe) {
  return {
    status: "captured",
    symbol,
    timeframe,
    timeframeLabel: timeframe === "60" ? "1h" : timeframe === "240" ? "4h" : `${timeframe}m`,
    outputPath: path.join("screenshots", `fake-${symbol}-${timeframe}.png`),
    publicPath: `/screenshots/fake-${symbol}-${timeframe}.png`,
    chartUrl: `https://example.com/chart?symbol=${symbol}&interval=${timeframe}`,
    capturedAt: new Date().toISOString(),
  };
}

test("vision service monitors multiple timeframes and builds aggregate consensus", async () => {
  const fakeCaptureMulti = async ({ symbol, timeframes }) => ({
    status: "captured",
    symbol,
    captures: timeframes.map((timeframe) => buildFakeCapture(symbol, timeframe)),
    capturedAt: new Date().toISOString(),
  });

  const fakeVisionProvider = {
    getCapabilities() {
      return { configured: true, provider: "fake" };
    },
    async analyzeChartImage({ timeframe }) {
      const bullish = ["15", "60", "240"].includes(String(timeframe));
      return {
        status: "completed",
        direction: bullish ? "bullish" : "neutral",
        confidence: bullish ? 0.76 : 0.45,
        score: bullish ? 74 : 52,
        summary: bullish ? "Bullish structure visible." : "Neutral microstructure.",
      };
    },
  };

  const service = createVisionService({
    rootDir: process.cwd(),
    visionProvider: fakeVisionProvider,
    captureMulti: fakeCaptureMulti,
  });

  const monitor = await service.monitorTimeframes({
    symbol: "XAUUSD",
    timeframes: ["1", "5", "15", "60", "240"],
    cycles: 1,
    analyze: true,
  });

  assert.equal(monitor.status, "completed");
  assert.equal(monitor.latestCycle.capture.captures.length, 5);
  assert.equal(monitor.aggregate.status, "completed");
  assert.equal(monitor.aggregate.direction, "bullish");
  assert.ok(monitor.aggregate.confidence > 0);
  assert.equal(monitor.aggregate.timeframeVotes.length, 5);
});

test("merge coordinator fuses api and vision decisions into a final status", () => {
  const apiFinalState = {
    finalStatus: "approved",
    candidate: {
      direction: "long",
      confidence: 0.82,
    },
    confluence: {
      combinedScore: 84,
    },
  };

  const visionMonitor = {
    status: "completed",
    aggregate: {
      direction: "bullish",
      confidence: 0.68,
      weightedScore: 0.62,
      timeframeVotes: [
        { timeframe: "15", direction: "bullish", confidence: 0.7 },
        { timeframe: "60", direction: "bullish", confidence: 0.74 },
        { timeframe: "240", direction: "bullish", confidence: 0.62 },
      ],
    },
  };

  const merged = mergeApiAndVisionDecision({
    apiFinalState,
    visionMonitor,
  });

  assert.equal(merged.status, "completed");
  assert.equal(merged.api.status, "approved");
  assert.equal(merged.vision.direction, "bullish");
  assert.equal(merged.finalStatus, "approved");
  assert.ok(merged.mergedConfidence > 0.6);
  assert.equal(merged.fallback.activated, false);
  assert.equal(merged.signal.source, "api_vision_merge");
  assert.equal(merged.signal.direction, "bullish");
});

test("merge coordinator promotes a conditional fallback when API is degraded and vision is strongly directional", () => {
  const apiFinalState = {
    finalStatus: "no_trade",
    marketSnapshot: {
      source: "live-alpha-vantage",
      liveData: {
        mode: "live",
        degraded: true,
        notes: ["rate limit reached"],
      },
      health: {
        ok: false,
        degraded: true,
      },
    },
    technicalContext: {
      directionBias: "neutral",
    },
  };

  const visionMonitor = {
    status: "completed",
    aggregate: {
      status: "completed",
      direction: "bullish",
      confidence: 0.74,
      weightedScore: 0.48,
      timeframeVotes: [
        { timeframe: "15", direction: "bullish", confidence: 0.72 },
        { timeframe: "60", direction: "bullish", confidence: 0.76 },
        { timeframe: "240", direction: "bullish", confidence: 0.7 },
      ],
    },
  };

  const merged = mergeApiAndVisionDecision({
    apiWorkflow: { status: "failed" },
    apiFinalState,
    visionMonitor,
  });

  assert.equal(merged.status, "completed");
  assert.equal(merged.api.status, "no_trade");
  assert.equal(merged.apiQuality.degraded, true);
  assert.equal(merged.fallback.activated, true);
  assert.equal(merged.finalStatus, "conditional");
  assert.equal(merged.signal.source, "vision_fallback");
  assert.equal(merged.signal.direction, "bullish");
  assert.ok(merged.mergedConfidence >= 0.5);
});
