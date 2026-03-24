import { buildEvidence, scoreBand } from "../signal/contracts.mjs";

const AGENT_ID = "central-bank-inflation-event-risk";

export const centralBankInflationEventRiskAgent = {
  id: AGENT_ID,
  name: "Central Bank, Inflation, and Event Risk Agent",
  persona: "strict timing gatekeeper",
  systemPrompt: `You are the Central Bank, Inflation, and Event Risk Agent.
You protect the signal pipeline from trading into major macro events without justification.
You must treat high-impact releases as a serious timing hazard and clearly distinguish clear, caution, and blocked states.`,
  async analyze(input = {}) {
    const snapshot = input.marketSnapshot ?? {};
    const calendar = snapshot.calendar ?? {};
    const events = Array.isArray(calendar.nextEvents) ? calendar.nextEvents : [];
    const minutes = Number.isFinite(calendar.nextHighImpactMinutes) ? calendar.nextHighImpactMinutes : 9999;

    const risks = [];
    const support = [];
    let score = 70;
    let state = "clear";

    if (minutes <= 30) {
      score = 15;
      state = "blocked";
      risks.push("A high-impact event is too close for a clean signal.");
    } else if (minutes <= 120) {
      score = 42;
      state = "caution";
      risks.push("A high-impact event is near enough to distort execution.");
    } else {
      support.push("No immediate high-impact event pressure.");
    }

    if (calendar.policyTone === "hawkish") {
      score -= 10;
      risks.push("Policy tone is hawkish for gold.");
    }
    if (calendar.policyTone === "dovish") {
      score += 8;
      support.push("Policy tone is more supportive for gold.");
    }

    const confidence = Math.min(0.96, 0.5 + (events.length > 0 ? 0.1 : 0.06) + (state === "blocked" ? 0.1 : 0));

    return buildEvidence({
      id: `${AGENT_ID}:${snapshot.symbol ?? "xau-usd"}`,
      agent: AGENT_ID,
      domain: "fundamental",
      status: scoreBand(score),
      direction: state === "blocked" ? "contradictory" : state === "caution" ? "mixed" : "supportive",
      confidence,
      summary: `Event-risk state is ${state} with next high-impact event in ${minutes} minutes.`,
      support,
      risks,
      caveats: [
        "Event risk should suppress trade construction when the next release is too close.",
      ],
      metrics: {
        eventRiskState: state,
        minutesToHighImpact: minutes,
      },
      sourceRefs: events.map((event) => event.id).filter(Boolean),
    });
  },
};
