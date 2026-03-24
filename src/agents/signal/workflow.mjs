import { macroDriverSynthesisAgent } from "../fundamental/macro-driver-synthesis.mjs";
import { ratesUsdYieldsAgent } from "../fundamental/rates-usd-yields.mjs";
import { centralBankInflationEventRiskAgent } from "../fundamental/central-bank-inflation-event-risk.mjs";
import { positioningGeopoliticsIntermarketAgent } from "../fundamental/positioning-geopolitics-intermarket.mjs";
import { regimeConfluenceAgent } from "./regime-confluence.mjs";
import { precisionTradeConstructionAgent } from "./precision-trade-construction.mjs";
import { riskQualificationAgent } from "./risk-qualification.mjs";
import { criticChallengeAgent } from "./critic-challenge.mjs";
import { executionPlannerAgent } from "./execution-planner.mjs";
import { buildNoTrade } from "./contracts.mjs";
import { reportWriterAgent } from "../reporting/report-writer.mjs";

function finalStatusFromReviews(candidate, riskReview, criticReview) {
  if (!candidate || candidate.status === "no_trade") return "no_trade";
  if (riskReview?.status === "fail") return "no_trade";
  if (criticReview?.status === "block") return "rejected";
  if (riskReview?.status === "conditional" || criticReview?.status === "caution") return "conditional";
  return "approved";
}

export async function runAurumSignalSlice(input = {}) {
  const technicalContext = input.technicalContext ?? input.marketSnapshot?.technicalContext ?? {};
  const [macro, rates, eventRisk, positioning] = await Promise.all([
    macroDriverSynthesisAgent.analyze(input),
    ratesUsdYieldsAgent.analyze(input),
    centralBankInflationEventRiskAgent.analyze(input),
    positioningGeopoliticsIntermarketAgent.analyze(input),
  ]);

  const fundamentalEvidence = {
    macro,
    rates,
    eventRisk,
    positioning,
  };

  const confluence = await regimeConfluenceAgent.analyze({
    ...input,
    technicalContext,
    fundamentalEvidence,
  });

  const candidate = await precisionTradeConstructionAgent.analyze({
    ...input,
    technicalContext,
    fundamentalEvidence,
    confluence,
  });

  if (candidate.status === "no_trade") {
    const noTrade = buildNoTrade({
      id: candidate.id,
      reasons: candidate.reasons ?? ["The candidate builder returned no-trade."],
      failedGates: candidate.failedGates ?? ["construction"],
      whatWouldChange: candidate.whatWouldChange ?? ["Improve confluence and entry quality."],
      confidence: candidate.confidence ?? 0.9,
      evidenceRefs: candidate.evidenceRefs ?? [],
    });
    const report = await reportWriterAgent.analyze({
      ...input,
      fundamentalEvidence,
      confluence,
      candidate: noTrade,
      riskReview: null,
      criticReview: null,
      executionPlan: null,
      finalStatus: "no_trade",
    });
    return {
      fundamentalEvidence,
      confluence,
      candidate: noTrade,
      riskReview: null,
      criticReview: null,
      executionPlan: null,
      finalStatus: "no_trade",
      report,
    };
  }

  const riskReview = await riskQualificationAgent.analyze({
    ...input,
    candidate,
    fundamentalEvidence,
    confluence,
  });

  const criticReview = await criticChallengeAgent.analyze({
    ...input,
    candidate,
    riskReview,
    fundamentalEvidence,
    confluence,
  });

  const finalStatus = finalStatusFromReviews(candidate, riskReview, criticReview);
  const executionPlan = finalStatus === "approved" || finalStatus === "conditional"
    ? await executionPlannerAgent.analyze({
        ...input,
        candidate,
        riskReview,
        criticReview,
      })
    : null;

  const report = await reportWriterAgent.analyze({
    ...input,
    fundamentalEvidence,
    confluence,
    candidate,
    riskReview,
    criticReview,
    executionPlan,
    finalStatus,
  });

  return {
    fundamentalEvidence,
    confluence,
    candidate,
    riskReview,
    criticReview,
    executionPlan,
    finalStatus,
    report,
  };
}
