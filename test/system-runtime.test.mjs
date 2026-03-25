import test from "node:test";
import assert from "node:assert/strict";
import { createAurumSystem } from "../src/index.js";

test("bullish retest fixture produces an approved or conditional signal through the full workflow", async () => {
  const system = createAurumSystem();
  const result = await system.runScenario({
    workflowName: "morningBriefing",
    fixtureName: "bullishRetest",
  });

  assert.equal(result.workflow.status, "completed");
  assert.ok(["approved", "conditional"].includes(result.finalState.finalStatus));
  assert.ok(result.finalState.technicalContext);
  assert.ok(result.finalState.report);
  assert.ok(result.finalState.candidate);
  assert.ok(result.finalState.agentIO?.["market-data"]);
  assert.ok(result.finalState.agentIO?.["report-writer"]);
  assert.ok(Array.isArray(result.telemetry?.auditTrail));
  assert.ok(result.telemetry.auditTrail.some((entry) => entry.eventType === "workflow.start"));
  assert.ok(result.telemetry.auditTrail.some((entry) => entry.eventType === "workflow.complete"));
  assert.ok(result.telemetry.auditTrail.every((entry) => entry.payload?.workflowId === result.workflow.workflowId));
});

test("event blocked fixture produces a no-trade or rejected signal through the full workflow", async () => {
  const system = createAurumSystem();
  const result = await system.runScenario({
    workflowName: "tradeValidation",
    fixtureName: "eventBlocked",
  });

  assert.equal(result.workflow.status, "completed");
  assert.ok(["no_trade", "rejected"].includes(result.finalState.finalStatus));
  assert.ok(result.finalState.report);
  assert.ok(result.finalState.confluence);
});
