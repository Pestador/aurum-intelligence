import { buildReport } from "../signal/contracts.mjs";

const AGENT_ID = "report-writer";

export const reportWriterAgent = {
  id: AGENT_ID,
  name: "Report Writer Agent",
  persona: "clear trader-facing narrator",
  systemPrompt: `You are the Report Writer Agent.
You translate the final workflow state into a concise report that is easy for a trader to use.
You must not inflate confidence or hide failed gates. State the outcome plainly and preserve evidence references.`,
  async analyze(input = {}) {
    const finalStatus = input.finalStatus ?? "no_trade";
    const candidate = input.candidate ?? null;
    const confluence = input.confluence ?? null;
    const riskReview = input.riskReview ?? null;
    const criticReview = input.criticReview ?? null;
    const executionPlan = input.executionPlan ?? null;
    const snapshot = input.marketSnapshot ?? {};

    const headline = finalStatus === "approved"
      ? "Approved Gold Signal"
      : finalStatus === "conditional"
        ? "Conditional Gold Signal"
        : finalStatus === "rejected"
          ? "Rejected Gold Signal"
          : "No-Trade Gold Report";

    const sections = [
      {
        title: "Market Context",
        body: [
          `Symbol: ${snapshot.symbol ?? "XAU/USD"}`,
          `Session: ${snapshot.session?.name ?? "unknown"}`,
          `Price: ${snapshot.price?.current ?? "n/a"}`,
        ],
      },
      {
        title: "Fundamental View",
        body: [
          input.fundamentalEvidence?.macro?.summary ?? "No macro summary available.",
          input.fundamentalEvidence?.eventRisk?.summary ?? "No event-risk summary available.",
        ].filter(Boolean),
      },
      {
        title: "Decision",
        body: [
          `Status: ${finalStatus}`,
          candidate?.thesis ? `Thesis: ${candidate.thesis}` : "No candidate thesis.",
          confluence ? `Confluence: ${confluence.combinedScore}` : "No confluence score.",
          riskReview ? `Risk review: ${riskReview.status}` : "No risk review.",
          criticReview ? `Critic review: ${criticReview.status}` : "No critic review.",
        ],
      },
    ];

    if (executionPlan) {
      sections.push({
        title: "Execution Plan",
        body: [
          executionPlan.entryPlan,
          executionPlan.stopPlan,
          ...(executionPlan.targetPlan ?? []),
        ].filter(Boolean),
      });
    }

    return buildReport({
      id: `${AGENT_ID}:${snapshot.symbol ?? "xau-usd"}`,
      status: finalStatus,
      headline,
      summary:
        finalStatus === "approved"
          ? "The signal cleared the technical, fundamental, risk, and critic gates."
          : finalStatus === "conditional"
            ? "The signal is usable but should be treated with caution."
            : "The system prefers no-trade over a low-quality setup.",
      sections,
      confidence: finalStatus === "approved" ? 0.92 : finalStatus === "conditional" ? 0.76 : 0.96,
    });
  },
};
