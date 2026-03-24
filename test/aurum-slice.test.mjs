import test from "node:test";
import assert from "node:assert/strict";

import { goldBullishRetestFixture } from "../fixtures/gold-bullish-retest.mjs";
import { goldEventBlockedFixture } from "../fixtures/gold-event-blocked.mjs";
import { macroDriverSynthesisAgent } from "../src/agents/fundamental/macro-driver-synthesis.mjs";
import { ratesUsdYieldsAgent } from "../src/agents/fundamental/rates-usd-yields.mjs";
import { centralBankInflationEventRiskAgent } from "../src/agents/fundamental/central-bank-inflation-event-risk.mjs";
import { positioningGeopoliticsIntermarketAgent } from "../src/agents/fundamental/positioning-geopolitics-intermarket.mjs";
import { regimeConfluenceAgent } from "../src/agents/signal/regime-confluence.mjs";
import { precisionTradeConstructionAgent } from "../src/agents/signal/precision-trade-construction.mjs";
import { riskQualificationAgent } from "../src/agents/signal/risk-qualification.mjs";
import { criticChallengeAgent } from "../src/agents/signal/critic-challenge.mjs";
import { executionPlannerAgent } from "../src/agents/signal/execution-planner.mjs";
import { runAurumSignalSlice } from "../src/agents/signal/workflow.mjs";
import { reportWriterAgent } from "../src/agents/reporting/report-writer.mjs";

test("agents expose structured prompts and analyzers", () => {
  const agents = [
    macroDriverSynthesisAgent,
    ratesUsdYieldsAgent,
    centralBankInflationEventRiskAgent,
    positioningGeopoliticsIntermarketAgent,
    regimeConfluenceAgent,
    precisionTradeConstructionAgent,
    riskQualificationAgent,
    criticChallengeAgent,
    executionPlannerAgent,
    reportWriterAgent,
  ];

  for (const agent of agents) {
    assert.equal(typeof agent.systemPrompt, "string");
    assert.equal(typeof agent.analyze, "function");
  }
});

test("bullish fixture produces an approved signal slice", async () => {
  const result = await runAurumSignalSlice(goldBullishRetestFixture);

  assert.equal(result.finalStatus, "approved");
  assert.equal(result.candidate.status, "candidate");
  assert.equal(result.riskReview.status, "pass");
  assert.equal(result.criticReview.status, "pass");
  assert.equal(result.executionPlan.status, "ready");
  assert.match(result.report.headline, /Approved/i);
  assert.ok(result.confluence.combinedScore >= 75);
  assert.ok(result.candidate.rrProfile.primary >= 6);
});

test("event-blocked fixture produces a no-trade outcome", async () => {
  const result = await runAurumSignalSlice(goldEventBlockedFixture);

  assert.equal(result.finalStatus, "no_trade");
  assert.equal(result.candidate.status, "no_trade");
  assert.equal(result.riskReview, null);
  assert.equal(result.criticReview, null);
  assert.equal(result.executionPlan, null);
  assert.match(result.report.headline, /No-Trade/i);
  assert.ok(result.confluence.blockedReasons.length > 0);
});

test("standalone agent outputs remain structured", async () => {
  const macro = await macroDriverSynthesisAgent.analyze(goldBullishRetestFixture);
  const rates = await ratesUsdYieldsAgent.analyze(goldBullishRetestFixture);
  const eventRisk = await centralBankInflationEventRiskAgent.analyze(goldBullishRetestFixture);
  const positioning = await positioningGeopoliticsIntermarketAgent.analyze(goldBullishRetestFixture);

  const confluence = await regimeConfluenceAgent.analyze({
    ...goldBullishRetestFixture,
    fundamentalEvidence: { macro, rates, eventRisk, positioning },
  });

  const candidate = await precisionTradeConstructionAgent.analyze({
    ...goldBullishRetestFixture,
    fundamentalEvidence: { macro, rates, eventRisk, positioning },
    confluence,
  });

  assert.equal(macro.domain, "fundamental");
  assert.equal(rates.domain, "fundamental");
  assert.equal(eventRisk.domain, "fundamental");
  assert.equal(positioning.domain, "fundamental");
  assert.ok(typeof confluence.combinedScore === "number");
  assert.equal(candidate.status, "candidate");
});
