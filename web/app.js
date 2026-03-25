const state = {
  health: null,
  workflows: [],
  fixtures: [],
  latestRun: null,
  latestMerged: null,
  latestVisionCapture: null,
  latestVisionMonitor: null,
  latestRaw: null,
  operations: [],
};

function $(id) {
  return document.getElementById(id);
}

function textOr(value, fallback = "n/a") {
  return value === undefined || value === null || value === "" ? fallback : String(value);
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asPercent(value) {
  const parsed = toNumber(value);
  if (parsed === null) return "n/a";
  const normalized = parsed <= 1 ? parsed * 100 : parsed;
  return `${normalized.toFixed(1)}%`;
}

function asConfidence(value) {
  const parsed = toNumber(value);
  return parsed === null ? "n/a" : parsed.toFixed(2);
}

function formatPrice(value) {
  const parsed = toNumber(value);
  return parsed === null ? "n/a" : parsed.toFixed(2);
}

function formatEntry(entryZone = null) {
  if (!entryZone) return "n/a";
  const low = formatPrice(entryZone.low);
  const high = formatPrice(entryZone.high);
  if (low === "n/a" && high === "n/a") return "n/a";
  return `${low} - ${high}`;
}

function formatTargets(targets = []) {
  if (!Array.isArray(targets) || !targets.length) return "n/a";
  const values = targets
    .map((target) => target?.price)
    .map((price) => formatPrice(price))
    .filter((price) => price !== "n/a");
  return values.length ? values.join(", ") : "n/a";
}

function normalizeDirection(direction = "neutral") {
  const normalized = String(direction || "").toLowerCase();
  if (normalized === "long") return "bullish";
  if (normalized === "short") return "bearish";
  if (["bullish", "bearish", "neutral", "mixed"].includes(normalized)) return normalized;
  return "neutral";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setRawPayload(payload) {
  state.latestRaw = payload || null;
  const el = $("raw-json");
  if (!el) return;
  el.textContent = payload ? JSON.stringify(payload, null, 2) : "Run an action to view JSON output.";
}

function renderOptions(selectEl, items = []) {
  if (!selectEl) return;
  selectEl.innerHTML = "";
  for (const item of items) {
    const option = document.createElement("option");
    option.value = item?.key || item?.name || item?.id || "";
    option.textContent = item?.name || item?.key || item?.id || "unnamed";
    selectEl.appendChild(option);
  }
}

function parseTimeframesInput(raw = "") {
  const value = String(raw || "").trim();
  if (!value) return ["1", "5", "15", "60", "240"];
  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .map((item) => {
      if (item === "1m") return "1";
      if (item === "5m") return "5";
      if (item === "15m") return "15";
      if (item === "1h") return "60";
      if (item === "4h") return "240";
      return item;
    })
    .filter(Boolean);
}

function parseCycles(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(20, Math.floor(parsed)));
}

async function fetchJson(url, options) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    ...options,
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  if (!response.ok) {
    const message = typeof payload === "string" ? payload : payload?.error || `${url} ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

function setHealth(status) {
  const el = $("health-status");
  if (!el) return;
  if (status?.status === "ok" || status?.health?.ok === true) {
    el.textContent = "Healthy";
    el.className = "pill ok";
    return;
  }
  el.textContent = status ? "Degraded" : "Unreachable";
  el.className = "pill error";
}

function getRuntimeMode(health, runResult) {
  const modeFromHealth = health?.mode || health?.runtime?.defaultMarketMode || null;
  if (modeFromHealth) return modeFromHealth;
  const source = runResult?.finalState?.marketSnapshot?.source || runResult?.finalState?.marketSnapshot?.liveData?.mode || "";
  if (String(source).includes("live")) return "live";
  return "fixture";
}

function setMode(mode = "unknown") {
  const modeEl = $("mode-pill");
  const runtimeEl = $("runtime-mode");
  const sourceEl = $("runtime-source");
  if (!modeEl || !runtimeEl || !sourceEl) return;

  const normalized = textOr(mode, "unknown").toLowerCase();
  modeEl.textContent = `Mode: ${normalized}`;
  modeEl.className = normalized === "live" ? "pill ok" : normalized === "fixture" ? "pill pill-muted" : "pill";
  runtimeEl.textContent = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  sourceEl.textContent = normalized === "live"
    ? "Live provider path is enabled."
    : "Fixture-backed or offline scenario mode.";

  const modeSelect = $("market-mode-select");
  if (modeSelect && !modeSelect.dataset.userChanged) {
    modeSelect.value = normalized === "live" ? "live" : "fixture";
  }
}

function updateRuntimePanel() {
  const health = state.health;
  const providers = Number(health?.health?.providers ?? health?.providers ?? 0) || 0;
  const workflows = Number(health?.health?.workflows ?? state.workflows.length) || 0;
  const fixtures = Number(Array.isArray(health?.fixtures) ? health.fixtures.length : state.fixtures.length) || 0;

  const providerEl = $("runtime-providers");
  const workflowEl = $("runtime-workflows");
  const fixtureEl = $("runtime-fixtures");
  const providerNoteEl = $("runtime-provider-note");
  const workflowNoteEl = $("runtime-workflow-note");
  const fixtureNoteEl = $("runtime-fixture-note");
  if (providerEl) providerEl.textContent = String(providers);
  if (workflowEl) workflowEl.textContent = String(workflows);
  if (fixtureEl) fixtureEl.textContent = String(fixtures);
  if (providerNoteEl) providerNoteEl.textContent = "Model, market, and vision providers detected by runtime.";
  if (workflowNoteEl) workflowNoteEl.textContent = workflows ? "Workflow stack loaded." : "No workflow definition loaded.";
  if (fixtureNoteEl) fixtureNoteEl.textContent = fixtures ? "Fixture scenarios ready." : "Fixture list is empty.";

  setMode(getRuntimeMode(health, state.latestRun));
}

function sectionMarkup(title, lines = []) {
  return `
    <section class="section">
      <div class="section-title">${escapeHtml(title)}</div>
      ${lines.map((line) => `<div>${escapeHtml(line)}</div>`).join("")}
    </section>
  `;
}

function deriveSignalFromFinalState(finalState = null) {
  if (!finalState) return null;
  const candidate = finalState?.candidate || null;
  const technical = finalState?.technicalContext || null;
  const confluence = finalState?.confluence || null;
  return {
    status: finalState?.finalStatus || "no_trade",
    direction: normalizeDirection(candidate?.direction || technical?.directionBias || "neutral"),
    confidence: Number.isFinite(confluence?.combinedScore) ? clampValue(confluence.combinedScore / 100) : finalState?.averageTechnicalConfidence || 0,
    source: "api_workflow",
    entryZone: candidate?.entryZone || technical?.entryZone || null,
    stopLoss: candidate?.stopLoss || technical?.stopLoss || null,
    targets: candidate?.takeProfitLevels || technical?.targets || [],
    rr: candidate?.rrProfile?.primary || null,
    note: finalState?.report?.summary || "Signal generated from API workflow pipeline.",
  };
}

function clampValue(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function deriveSignalFromMerged(merged = null, finalState = null) {
  if (!merged) return null;
  const fromMerged = merged?.signal || {};
  const fallback = merged?.fallback || {};
  const fallbackDirection = normalizeDirection(fallback?.direction || "neutral");
  const direction = normalizeDirection(fromMerged?.direction || (fallback?.activated ? fallbackDirection : merged?.api?.direction || "neutral"));
  return {
    status: fromMerged?.status || merged?.finalStatus || "no_trade",
    direction,
    confidence: Number.isFinite(fromMerged?.confidence) ? fromMerged.confidence : merged?.mergedConfidence || 0,
    source: fromMerged?.source || (fallback?.activated ? "vision_fallback" : "api_vision_merge"),
    entryZone: fromMerged?.entryZone || finalState?.candidate?.entryZone || finalState?.technicalContext?.entryZone || null,
    stopLoss: fromMerged?.stopLoss || finalState?.candidate?.stopLoss || finalState?.technicalContext?.stopLoss || null,
    targets: fromMerged?.targets || finalState?.candidate?.takeProfitLevels || finalState?.technicalContext?.targets || [],
    rr: fromMerged?.rr || finalState?.candidate?.rrProfile?.primary || null,
    note: fallback?.activated ? fallback?.reason || "Vision fallback signal is active." : merged?.summary || "Merged signal ready.",
  };
}

function signalSourceLabel(source = "api_workflow") {
  const normalized = String(source || "").toLowerCase();
  if (normalized === "vision_fallback") return "vision fallback";
  if (normalized === "api_vision_merge") return "api + vision";
  if (normalized === "api_workflow") return "api workflow";
  return normalized || "unknown";
}

function signalDirectionLabel(direction = "neutral") {
  const normalized = normalizeDirection(direction);
  if (normalized === "bullish") return "bullish (long bias)";
  if (normalized === "bearish") return "bearish (short bias)";
  if (normalized === "mixed") return "mixed";
  return "neutral";
}

function renderSignalCard() {
  const shell = $("signal-card-shell");
  const statusEl = $("signal-status");
  const sourceEl = $("signal-source-pill");
  const directionEl = $("signal-direction");
  const confidenceEl = $("signal-confidence");
  const entryEl = $("signal-entry");
  const stopEl = $("signal-stop");
  const targetsEl = $("signal-targets");
  const rrEl = $("signal-rr");
  const noteEl = $("signal-note");

  if (!shell || !statusEl || !sourceEl || !directionEl || !confidenceEl || !entryEl || !stopEl || !targetsEl || !rrEl || !noteEl) return;

  const mergedSignal = deriveSignalFromMerged(state.latestMerged, state.latestRun?.finalState || null);
  const apiSignal = deriveSignalFromFinalState(state.latestRun?.finalState || null);
  const signal = mergedSignal || apiSignal;

  if (!signal) {
    shell.className = "card card-span-2 signal-card-shell neutral";
    statusEl.className = "signal-status neutral";
    statusEl.textContent = "NO SIGNAL";
    sourceEl.textContent = "waiting";
    directionEl.textContent = "Direction: neutral";
    confidenceEl.textContent = "n/a";
    entryEl.textContent = "n/a";
    stopEl.textContent = "n/a";
    targetsEl.textContent = "n/a";
    rrEl.textContent = "n/a";
    noteEl.textContent = "Run Workflow or Run Merged Decision to generate a signal.";
    return;
  }

  const statusClass = String(signal.status || "no_trade").toLowerCase();
  shell.className = `card card-span-2 signal-card-shell ${statusClass}`;
  statusEl.className = `signal-status ${statusClass}`;
  statusEl.textContent = String(signal.status || "no_trade").replaceAll("_", " ").toUpperCase();
  sourceEl.textContent = signalSourceLabel(signal.source);
  sourceEl.className = `status-chip ${normalizeDirection(signal.direction)}`;
  directionEl.textContent = `Direction: ${signalDirectionLabel(signal.direction)}`;
  confidenceEl.textContent = asPercent(signal.confidence);
  entryEl.textContent = formatEntry(signal.entryZone);
  stopEl.textContent = formatPrice(signal.stopLoss?.price);
  targetsEl.textContent = formatTargets(signal.targets);
  rrEl.textContent = Number.isFinite(Number(signal.rr)) ? Number(signal.rr).toFixed(2) : "n/a";
  noteEl.textContent = textOr(signal.note, "No signal note available.");
}

function renderDecisionGates(finalState = null) {
  const container = $("decision-gates");
  if (!container) return;
  if (!finalState) {
    container.innerHTML = '<div class="muted small">Run a workflow to see confluence, risk, critic, and final gate decisions.</div>';
    return;
  }

  const confluence = finalState?.confluence || {};
  const candidate = finalState?.candidate || {};
  const risk = finalState?.riskReview || {};
  const critic = finalState?.criticReview || {};
  const report = finalState?.report || {};

  container.innerHTML = `
    ${sectionMarkup("Final Gate", [
      `Status: ${textOr(finalState.finalStatus, "unknown")}`,
      `Headline: ${textOr(report.headline, "n/a")}`,
      `Avg technical confidence: ${asConfidence(finalState.averageTechnicalConfidence)}`,
    ])}
    ${sectionMarkup("Confluence", [
      `Regime: ${textOr(confluence.regime, "n/a")}`,
      `Combined score: ${textOr(confluence.combinedScore, "n/a")}`,
      `Blocked reasons: ${Array.isArray(confluence.blockedReasons) ? confluence.blockedReasons.length : 0}`,
    ])}
    ${sectionMarkup("Entry Selection", [
      `Candidate status: ${textOr(candidate.status, "n/a")}`,
      `Direction: ${textOr(candidate.direction, "n/a")}`,
      `Trigger: ${textOr(candidate.triggerType, "n/a")}`,
      `RR profile: ${textOr(candidate.rrProfile?.primary, "n/a")}`,
    ])}
    ${sectionMarkup("Risk + Critic", [
      `Risk review: ${textOr(risk.status, "n/a")}`,
      `Event risk: ${textOr(risk.eventRiskState, "n/a")}`,
      `Critic review: ${textOr(critic.status, "n/a")}`,
      `Objections: ${Array.isArray(critic.objections) ? critic.objections.length : 0}`,
    ])}
  `;
}

function renderMergedDecision(merged = null) {
  const headlineEl = $("merged-headline");
  const summaryEl = $("merged-summary");
  const bodyEl = $("merged-body");
  if (!headlineEl || !summaryEl || !bodyEl) return;

  if (!merged) {
    headlineEl.textContent = "No merged decision yet.";
    summaryEl.textContent = "";
    bodyEl.innerHTML = "";
    return;
  }

  headlineEl.textContent = `${textOr(merged.finalStatus, "unknown").toUpperCase()} - confidence ${asConfidence(merged.mergedConfidence)}`;
  summaryEl.textContent = textOr(merged.summary, "No merged summary.");
  const fallback = merged?.fallback || {};
  const apiQuality = merged?.apiQuality || {};
  bodyEl.innerHTML = `
    ${sectionMarkup("API", [
      `Status: ${textOr(merged.api?.status, "n/a")}`,
      `Direction: ${textOr(merged.api?.direction, "n/a")}`,
      `Confidence: ${asConfidence(merged.api?.confidence)}`,
    ])}
    ${sectionMarkup("Vision", [
      `Status: ${textOr(merged.vision?.status, "n/a")}`,
      `Direction: ${textOr(merged.vision?.direction, "n/a")}`,
      `Confidence: ${asConfidence(merged.vision?.confidence)}`,
      `Weighted score: ${asConfidence(merged.vision?.weightedScore)}`,
    ])}
    ${sectionMarkup("Alignment", [
      `Verdict: ${textOr(merged.alignment?.verdict, "n/a")}`,
      `Score: ${asConfidence(merged.alignment?.score)}`,
      `Reasons: ${Array.isArray(merged.reasons) ? merged.reasons.join(" | ") : "n/a"}`,
    ])}
    ${sectionMarkup("Data Quality", [
      `Mode: ${textOr(apiQuality.mode, "n/a")}`,
      `Source: ${textOr(apiQuality.source, "n/a")}`,
      `Degraded: ${String(Boolean(apiQuality.degraded))}`,
      `Notes: ${Array.isArray(apiQuality.notes) && apiQuality.notes.length ? apiQuality.notes.join(" | ") : "n/a"}`,
    ])}
    ${sectionMarkup("Fallback", [
      `Activated: ${String(Boolean(fallback.activated))}`,
      `Reason: ${textOr(fallback.reason, "n/a")}`,
    ])}
  `;
}

function normalizeAgentNodes(workflow = null) {
  if (!workflow || !Array.isArray(workflow.stages)) return [];
  const nodes = [];
  for (const stage of workflow.stages) {
    const outputs = Array.isArray(stage.outputs) ? stage.outputs : [];
    for (const output of outputs) {
      nodes.push({
        stageName: stage.stageName || "stage",
        agentName: output.agentName || "agent",
        status: output.status || "unknown",
        confidence: output.confidence || 0,
      });
    }
  }
  return nodes;
}

function renderWorkflowTimeline(workflow = null) {
  const container = $("workflow-timeline");
  if (!container) return;
  if (!workflow || !Array.isArray(workflow.stages) || !workflow.stages.length) {
    container.innerHTML = '<div class="muted small">No workflow run yet.</div>';
    return;
  }

  container.innerHTML = workflow.stages.map((stage) => {
    const outputs = Array.isArray(stage.outputs) ? stage.outputs : [];
    const outputHtml = outputs.length
      ? outputs.map((output) => `
          <article class="timeline-agent">
            <div class="timeline-agent-head">
              <strong>${escapeHtml(textOr(output.agentName, "agent"))}</strong>
              <span class="status-chip ${escapeHtml(output.status || "unknown")}">${escapeHtml(textOr(output.status, "unknown"))}</span>
            </div>
            <div class="muted small">Confidence: ${asConfidence(output.confidence)}</div>
            <div>${escapeHtml(textOr(output.summary, "No summary."))}</div>
          </article>
        `).join("")
      : '<div class="muted small">No agent output for this stage.</div>';

    return `
      <section class="timeline-stage">
        <header class="timeline-stage-head">
          <h3>${escapeHtml(textOr(stage.stageName, "stage"))}</h3>
          <span class="status-chip ${escapeHtml(stage.status || "unknown")}">${escapeHtml(textOr(stage.status, "unknown"))}</span>
        </header>
        <div class="timeline-agent-list">${outputHtml}</div>
      </section>
    `;
  }).join("");
}

function renderAgentGraph(workflow = null) {
  const container = $("agent-graph");
  if (!container) return;

  const nodes = normalizeAgentNodes(workflow);
  if (!nodes.length) {
    container.innerHTML = '<div class="muted small">Run a workflow to render communication flow.</div>';
    return;
  }

  const width = Math.max(900, nodes.length * 150 + 120);
  const height = 260;
  const startX = 70;
  const step = (width - 140) / Math.max(nodes.length - 1, 1);
  const y = 130;

  const edgeMarkup = nodes.slice(0, -1).map((_, index) => {
    const x1 = startX + index * step + 54;
    const x2 = startX + (index + 1) * step - 54;
    return `<line x1="${x1.toFixed(1)}" y1="${y}" x2="${x2.toFixed(1)}" y2="${y}" class="graph-edge" />`;
  }).join("");

  const nodeMarkup = nodes.map((node, index) => {
    const x = startX + index * step;
    const className = node.status === "completed"
      ? "graph-node completed"
      : node.status === "rejected" || node.status === "failed"
        ? "graph-node failed"
        : "graph-node";
    return `
      <g>
        <rect x="${(x - 54).toFixed(1)}" y="${(y - 36).toFixed(1)}" width="108" height="72" rx="14" class="${className}" />
        <text x="${x.toFixed(1)}" y="${(y - 10).toFixed(1)}" text-anchor="middle" class="graph-node-title">${escapeHtml(node.agentName)}</text>
        <text x="${x.toFixed(1)}" y="${(y + 8).toFixed(1)}" text-anchor="middle" class="graph-node-meta">${escapeHtml(node.stageName)}</text>
        <text x="${x.toFixed(1)}" y="${(y + 24).toFixed(1)}" text-anchor="middle" class="graph-node-meta">c=${asConfidence(node.confidence)}</text>
      </g>
    `;
  }).join("");

  container.innerHTML = `
    <div class="graph-scroll">
      <svg class="graph-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Agent communication graph">
        <defs>
          <marker id="edge-arrow" markerWidth="10" markerHeight="8" refX="8" refY="4" orient="auto">
            <path d="M0,0 L10,4 L0,8 z" class="graph-arrow"></path>
          </marker>
        </defs>
        <text x="24" y="28" class="graph-title">Execution handoff flow across agent chain</text>
        ${edgeMarkup}
        ${nodeMarkup}
      </svg>
    </div>
  `;
}

function agentNamesInWorkflowOrder(workflow = null, agentIO = {}) {
  const names = [];
  const seen = new Set();
  if (workflow && Array.isArray(workflow.stages)) {
    for (const stage of workflow.stages) {
      const outputs = Array.isArray(stage.outputs) ? stage.outputs : [];
      for (const output of outputs) {
        const name = output?.agentName;
        if (name && !seen.has(name)) {
          seen.add(name);
          names.push(name);
        }
      }
    }
  }

  for (const key of Object.keys(agentIO || {})) {
    if (!seen.has(key)) {
      seen.add(key);
      names.push(key);
    }
  }
  return names;
}

function renderAgentInspectorMeta(agentSnapshot = null) {
  const metaEl = $("agent-meta");
  if (!metaEl) return;

  if (!agentSnapshot) {
    metaEl.innerHTML = '<div class="muted small">No agent snapshot available.</div>';
    return;
  }

  metaEl.innerHTML = `
    ${sectionMarkup("Agent Status", [
      `Name: ${textOr(agentSnapshot.agentName, "n/a")}`,
      `Status: ${textOr(agentSnapshot.status, "n/a")}`,
      `Confidence: ${asConfidence(agentSnapshot.confidence)}`,
      `Started: ${textOr(agentSnapshot.startedAt, "n/a")}`,
      `Completed: ${textOr(agentSnapshot.completedAt, "n/a")}`,
    ])}
    ${sectionMarkup("Summary", [
      textOr(agentSnapshot.summary, "No summary available."),
    ])}
  `;
}

function renderSelectedAgent() {
  const selector = $("agent-select");
  const promptEl = $("agent-prompt-json");
  const inputEl = $("agent-input-json");
  const outputEl = $("agent-output-json");
  if (!selector || !promptEl || !inputEl || !outputEl) return;

  const selected = selector.value;
  const agentIO = state.latestRun?.finalState?.agentIO || {};
  const snapshot = agentIO[selected] || null;
  renderAgentInspectorMeta(snapshot);

  promptEl.textContent = snapshot?.prompt ? JSON.stringify(snapshot.prompt, null, 2) : "{}";
  inputEl.textContent = snapshot?.input ? JSON.stringify(snapshot.input, null, 2) : "{}";
  outputEl.textContent = snapshot?.output ? JSON.stringify(snapshot.output, null, 2) : "{}";
}

function renderAgentInspector(workflow = null, agentIO = {}) {
  const selector = $("agent-select");
  if (!selector) return;

  const names = agentNamesInWorkflowOrder(workflow, agentIO);
  const current = selector.value;
  selector.innerHTML = "";

  if (!names.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No agents yet";
    selector.appendChild(option);
    renderAgentInspectorMeta(null);
    $("agent-prompt-json").textContent = "{}";
    $("agent-input-json").textContent = "{}";
    $("agent-output-json").textContent = "{}";
    return;
  }

  for (const name of names) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    selector.appendChild(option);
  }

  if (current && names.includes(current)) {
    selector.value = current;
  } else {
    selector.value = names[0];
  }
  renderSelectedAgent();
}

function renderAuditStream(auditTrail = []) {
  const container = $("audit-stream");
  if (!container) return;
  const events = Array.isArray(auditTrail) ? auditTrail : [];
  if (!events.length) {
    container.innerHTML = '<div class="muted small">Audit trail appears after a workflow run.</div>';
    return;
  }

  container.innerHTML = events.slice(-80).reverse().map((entry) => {
    const payload = entry?.payload || {};
    const snippet = payload?.agentName
      ? `agent=${payload.agentName}`
      : payload?.stageName
        ? `stage=${payload.stageName}`
        : payload?.workflowName
          ? `workflow=${payload.workflowName}`
          : "event";

    return `
      <article class="audit-item">
        <div class="audit-item-head">
          <strong>${escapeHtml(textOr(entry.eventType, "event"))}</strong>
          <span class="muted small">${escapeHtml(textOr(entry.ts, ""))}</span>
        </div>
        <div class="muted small">${escapeHtml(snippet)}</div>
      </article>
    `;
  }).join("");
}

function findAnalysisForTimeframe(analysis = null, timeframe = "") {
  const perTimeframe = Array.isArray(analysis?.perTimeframe) ? analysis.perTimeframe : [];
  return perTimeframe.find((item) => String(item?.timeframe) === String(timeframe)) || null;
}

function renderVisionGallery() {
  const gallery = $("vision-gallery");
  const votes = $("vision-votes");
  if (!gallery || !votes) return;

  const monitor = state.latestVisionMonitor;
  const captureBundle = state.latestVisionCapture;
  const latestCycle = monitor?.latestCycle || null;
  const captures = Array.isArray(latestCycle?.capture?.captures)
    ? latestCycle.capture.captures
    : captureBundle?.capture
      ? [captureBundle.capture]
      : [];

  if (!captures.length) {
    gallery.innerHTML = '<div class="muted small">Run capture or monitor to load timeframe screenshots.</div>';
    votes.innerHTML = "";
    return;
  }

  gallery.innerHTML = captures.map((capture) => {
    const analysis = findAnalysisForTimeframe(latestCycle?.analysis, capture?.timeframe) || captureBundle?.analysis || null;
    const direction = analysis?.direction || "neutral";
    const confidence = asConfidence(analysis?.confidence);
    const summary = analysis?.summary || "No analysis summary.";

    return `
      <article class="vision-card">
        <div class="vision-card-head">
          <strong>${escapeHtml(textOr(capture?.timeframeLabel || capture?.timeframe, "chart"))}</strong>
          <span class="status-chip">${escapeHtml(direction)}</span>
        </div>
        ${capture?.publicPath ? `<img src="${escapeHtml(capture.publicPath)}" alt="TradingView ${escapeHtml(textOr(capture?.timeframeLabel, "chart"))} screenshot" />` : '<div class="vision-empty muted small">No screenshot file.</div>'}
        <div class="muted small">Confidence: ${confidence}</div>
        <div class="vision-summary">${escapeHtml(summary)}</div>
      </article>
    `;
  }).join("");

  const aggregate = monitor?.aggregate || null;
  if (!aggregate) {
    votes.innerHTML = "";
    return;
  }
  const voteLines = Array.isArray(aggregate.timeframeVotes)
    ? aggregate.timeframeVotes.map((vote) => `${vote.timeframeLabel || vote.timeframe}: ${vote.direction} (${asConfidence(vote.confidence)})`)
    : [];

  votes.innerHTML = `
    ${sectionMarkup("Vision Aggregate", [
      `Direction: ${textOr(aggregate.direction, "neutral")}`,
      `Confidence: ${asConfidence(aggregate.confidence)}`,
      `Weighted score: ${asConfidence(aggregate.weightedScore)}`,
      `Summary: ${textOr(aggregate.summary, "n/a")}`,
    ])}
    ${sectionMarkup("Timeframe Votes", voteLines.length ? voteLines : ["No votes available."])}
  `;
}

function operationSubtitle(operation = null) {
  if (!operation) return "";
  const outcome = operation.outcome || {};
  if (outcome.finalStatus) return `final=${outcome.finalStatus}`;
  if (outcome.direction) return `direction=${outcome.direction}`;
  if (outcome.visionDirection) return `vision=${outcome.visionDirection}`;
  if (outcome.symbol) return `symbol=${outcome.symbol}`;
  return "";
}

function renderOperations() {
  const container = $("operations-list");
  if (!container) return;
  const items = Array.isArray(state.operations) ? state.operations : [];
  if (!items.length) {
    container.innerHTML = '<div class="muted small">No operations recorded yet.</div>';
    return;
  }

  container.innerHTML = items.map((item) => `
    <article class="operation-item">
      <div class="operation-item-head">
        <strong>${escapeHtml(textOr(item.type, "operation"))}</strong>
        <span class="status-chip ${escapeHtml(item.status || "unknown")}">${escapeHtml(textOr(item.status, "unknown"))}</span>
      </div>
      <div class="muted small">${escapeHtml(textOr(item.ts, ""))}</div>
      <div>${escapeHtml(textOr(item.summary, ""))}</div>
      <div class="muted small">${escapeHtml(operationSubtitle(item))}</div>
    </article>
  `).join("");
}

function renderRunBundle(runResponse = null) {
  state.latestRun = runResponse || null;
  const workflow = runResponse?.workflow || null;
  const finalState = runResponse?.finalState || null;
  const telemetry = runResponse?.telemetry || {};

  renderDecisionGates(finalState);
  renderWorkflowTimeline(workflow);
  renderAgentGraph(workflow);
  renderAgentInspector(workflow, finalState?.agentIO || {});
  renderAuditStream(telemetry.auditTrail || []);
  updateRuntimePanel();
  renderSignalCard();
}

async function refreshOperations() {
  try {
    const payload = await fetchJson("/operations/history?limit=50");
    state.operations = Array.isArray(payload?.items) ? payload.items : [];
    renderOperations();
  } catch (error) {
    const container = $("operations-list");
    if (container) container.innerHTML = `<div class="muted small">Operations unavailable: ${escapeHtml(error.message)}</div>`;
  }
}

function runPayloadFromUI() {
  return {
    workflowName: $("workflow-select")?.value || "morningBriefing",
    fixtureName: $("fixture-select")?.value || "bullishRetest",
    marketMode: $("market-mode-select")?.value || "fixture",
    symbol: ($("market-symbol-input")?.value || "XAU/USD").trim() || "XAU/USD",
  };
}

function visionPayloadFromUI() {
  return {
    symbol: ($("vision-symbol")?.value || "XAUUSD").trim() || "XAUUSD",
    timeframes: parseTimeframesInput($("vision-timeframes")?.value || "1,5,15,60,240"),
    cycles: parseCycles($("vision-cycles")?.value || "1"),
  };
}

async function loadInitial() {
  const runStatus = $("run-status");
  if (runStatus) runStatus.textContent = "Loading runtime...";

  const [healthResult, fixturesResult, workflowsResult, operationsResult] = await Promise.allSettled([
    fetchJson("/health"),
    fetchJson("/fixtures"),
    fetchJson("/workflows"),
    fetchJson("/operations/history?limit=50"),
  ]);

  state.health = healthResult.status === "fulfilled" ? healthResult.value : null;
  state.fixtures = fixturesResult.status === "fulfilled" && Array.isArray(fixturesResult.value) ? fixturesResult.value : [];
  state.workflows = workflowsResult.status === "fulfilled" && Array.isArray(workflowsResult.value) ? workflowsResult.value : [];
  state.operations = operationsResult.status === "fulfilled" && Array.isArray(operationsResult.value?.items)
    ? operationsResult.value.items
    : [];

  setHealth(state.health);
  renderOptions($("fixture-select"), state.fixtures);
  renderOptions($("workflow-select"), state.workflows);
  updateRuntimePanel();
  renderOperations();
  renderDecisionGates(null);
  renderMergedDecision(null);
  renderWorkflowTimeline(null);
  renderAgentGraph(null);
  renderAgentInspector(null, {});
  renderAuditStream([]);
  renderVisionGallery();
  renderSignalCard();

  if (runStatus) runStatus.textContent = "Ready";
}

async function runWorkflow() {
  const runStatus = $("run-status");
  if (runStatus) runStatus.textContent = "Running workflow...";
  try {
    const payload = runPayloadFromUI();
    const response = await fetchJson("/run", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    state.latestMerged = null;
    renderRunBundle(response);
    renderMergedDecision(null);
    renderSignalCard();
    setRawPayload(response);
    await refreshOperations();
    if (runStatus) runStatus.textContent = "Workflow complete";
  } catch (error) {
    if (runStatus) runStatus.textContent = `Run failed: ${error.message}`;
    setRawPayload({ error: error.message });
  }
}

async function captureVision() {
  const visionStatus = $("vision-status");
  const btn = $("vision-btn");
  const payload = visionPayloadFromUI();
  if (btn) btn.disabled = true;
  if (visionStatus) visionStatus.textContent = `Capturing ${payload.symbol}...`;
  try {
    const response = await fetchJson("/vision/capture", {
      method: "POST",
      body: JSON.stringify({
        symbol: payload.symbol,
        timeframe: payload.timeframes[2] || "15",
        analyze: true,
      }),
    });
    state.latestVisionCapture = response?.result || null;
    renderVisionGallery();
    setRawPayload(response);
    await refreshOperations();
    if (visionStatus) visionStatus.textContent = textOr(response?.message, "Vision capture complete");
  } catch (error) {
    if (visionStatus) visionStatus.textContent = `Vision capture failed: ${error.message}`;
    setRawPayload({ error: error.message });
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function runVisionMonitor() {
  const visionStatus = $("vision-status");
  const btn = $("vision-monitor-btn");
  const payload = visionPayloadFromUI();
  if (btn) btn.disabled = true;
  if (visionStatus) visionStatus.textContent = `Monitoring ${payload.symbol} ${payload.timeframes.join(",")}...`;
  try {
    const response = await fetchJson("/vision/monitor", {
      method: "POST",
      body: JSON.stringify({
        symbol: payload.symbol,
        timeframes: payload.timeframes,
        cycles: payload.cycles,
        analyze: true,
      }),
    });
    state.latestVisionMonitor = response?.monitor || null;
    renderVisionGallery();
    setRawPayload(response);
    await refreshOperations();
    if (visionStatus) visionStatus.textContent = textOr(state.latestVisionMonitor?.aggregate?.summary, "Vision monitor complete");
  } catch (error) {
    if (visionStatus) visionStatus.textContent = `Vision monitor failed: ${error.message}`;
    setRawPayload({ error: error.message });
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function runMergedDecision() {
  const runStatus = $("run-status");
  const visionStatus = $("vision-status");
  const btn = $("merged-run-btn");
  const runPayload = runPayloadFromUI();
  const visionPayload = visionPayloadFromUI();

  if (btn) btn.disabled = true;
  if (runStatus) runStatus.textContent = "Running merged coordinator...";
  if (visionStatus) visionStatus.textContent = "Gathering API + vision evidence...";
  try {
    const response = await fetchJson("/decision/merged", {
      method: "POST",
      body: JSON.stringify({
        ...runPayload,
        timeframes: visionPayload.timeframes,
        cycles: visionPayload.cycles,
        analyze: true,
      }),
    });

    state.latestMerged = response?.merged || null;
    state.latestVisionMonitor = response?.vision || null;
    renderRunBundle(response?.api || null);
    renderMergedDecision(state.latestMerged);
    renderVisionGallery();
    renderSignalCard();
    setRawPayload(response);
    await refreshOperations();
    if (runStatus) runStatus.textContent = "Merged decision complete";
    if (visionStatus) visionStatus.textContent = textOr(response?.merged?.summary, "Merged decision complete.");
  } catch (error) {
    if (runStatus) runStatus.textContent = `Merged run failed: ${error.message}`;
    if (visionStatus) visionStatus.textContent = "Merged run failed.";
    setRawPayload({ error: error.message });
  } finally {
    if (btn) btn.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadInitial().catch((error) => {
    const runStatus = $("run-status");
    if (runStatus) runStatus.textContent = `Unable to load app data: ${error.message}`;
    setHealth(null);
    updateRuntimePanel();
  });

  $("refresh-health")?.addEventListener("click", () => {
    loadInitial().catch((error) => {
      const runStatus = $("run-status");
      if (runStatus) runStatus.textContent = `Refresh failed: ${error.message}`;
    });
  });

  $("refresh-ops")?.addEventListener("click", () => {
    refreshOperations().catch((error) => {
      const runStatus = $("run-status");
      if (runStatus) runStatus.textContent = `Ops refresh failed: ${error.message}`;
    });
  });

  $("market-mode-select")?.addEventListener("change", (event) => {
    event.currentTarget.dataset.userChanged = "1";
  });

  $("agent-select")?.addEventListener("change", () => {
    renderSelectedAgent();
  });

  $("run-btn")?.addEventListener("click", runWorkflow);
  $("vision-btn")?.addEventListener("click", captureVision);
  $("vision-monitor-btn")?.addEventListener("click", runVisionMonitor);
  $("merged-run-btn")?.addEventListener("click", runMergedDecision);
});
