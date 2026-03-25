const state = {
  health: null,
  workflows: [],
  fixtures: [],
  latestResult: null,
  latestRaw: null,
  vision: null,
  visionMonitor: null,
  merged: null,
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

function formatPrice(value) {
  const parsed = toNumber(value);
  return parsed === null ? "n/a" : parsed.toFixed(2);
}

function normalizeDirection(value = "neutral") {
  const normalized = String(value).toLowerCase();
  if (normalized === "long") return "bullish";
  if (normalized === "short") return "bearish";
  if (["bullish", "bearish", "neutral", "mixed"].includes(normalized)) return normalized;
  return "neutral";
}

function parseTimeframesInput(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return ["1", "5", "15", "60", "240"];
  return raw
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

function getRuntimeMode(health, result) {
  const healthMode =
    health?.mode ||
    health?.runtime?.defaultMarketMode ||
    health?.runtimeMode ||
    health?.health?.mode ||
    health?.health?.runtimeMode ||
    health?.health?.sourceMode ||
    null;
  if (healthMode) return healthMode;

  const source = result?.marketSnapshot?.source || result?.marketSnapshot?.health?.source || "";
  if (typeof source === "string" && source.includes("live")) return "live";
  if (typeof source === "string" && source.includes("fixture")) return "fixture";
  return "fixture";
}

function setHealth(status) {
  const el = $("health-status");
  if (!el) return;
  if (status?.status === "ok" || status?.health?.ok === true) {
    el.textContent = "Healthy";
    el.className = "pill ok";
  } else {
    el.textContent = status ? "Degraded" : "Unreachable";
    el.className = "pill error";
  }
}

function setMode(mode) {
  const modeEl = $("mode-pill");
  const runtimeEl = $("runtime-mode");
  const sourceEl = $("runtime-source");
  if (!modeEl || !runtimeEl || !sourceEl) return;

  const normalized = textOr(mode, "unknown").toLowerCase();
  modeEl.textContent = `Mode: ${normalized}`;
  modeEl.className = normalized === "live" ? "pill ok" : normalized === "fixture" ? "pill pill-muted" : "pill";
  runtimeEl.textContent = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  sourceEl.textContent = normalized === "live"
    ? "Live provider enabled or detected from the latest run."
    : "Fixture-backed runtime or offline scenario mode.";
}

function renderOptions(select, items) {
  if (!select) return;
  const list = Array.isArray(items) ? items : [];
  select.innerHTML = "";
  for (const item of list) {
    const option = document.createElement("option");
    const value = item?.name || item?.key || item?.id || "";
    option.value = value;
    option.textContent = value || "Unnamed";
    select.appendChild(option);
  }
}

function updateRuntimePanel({ health = null, result = null } = {}) {
  const providerCount = Number(health?.providers ?? health?.health?.providers ?? 0) || 0;
  const workflowCount = Number(health?.workflows ?? state.workflows.length) || 0;
  const fixtureCount = Number(health?.fixturesCount ?? state.fixtures.length) || 0;
  const providerNote = health?.health?.details?.providerHealth || health?.providerNote || "Provider health will appear here.";
  const workflowNote = workflowCount ? "Available analysis workflows." : "No workflows were loaded.";
  const fixtureNote = fixtureCount ? "Offline scenarios ready to run." : "No fixture scenarios available.";

  const providersEl = $("runtime-providers");
  const workflowsEl = $("runtime-workflows");
  const fixturesEl = $("runtime-fixtures");
  const providerNoteEl = $("runtime-provider-note");
  const workflowNoteEl = $("runtime-workflow-note");
  const fixtureNoteEl = $("runtime-fixture-note");

  if (providersEl) providersEl.textContent = String(providerCount);
  if (workflowsEl) workflowsEl.textContent = String(workflowCount);
  if (fixturesEl) fixturesEl.textContent = String(fixtureCount);
  if (providerNoteEl) providerNoteEl.textContent = textOr(providerNote);
  if (workflowNoteEl) workflowNoteEl.textContent = workflowNote;
  if (fixtureNoteEl) fixtureNoteEl.textContent = fixtureNote;

  const mode = getRuntimeMode(health || state.health, result || state.latestResult);
  setMode(mode);
  const marketModeEl = $("market-mode-select");
  if (marketModeEl && !marketModeEl.dataset.userChanged) {
    marketModeEl.value = mode === "live" ? "live" : "fixture";
  }
}

function addSection(container, title, lines = []) {
  if (!container) return;
  const card = document.createElement("div");
  card.className = "section";
  const heading = document.createElement("div");
  heading.className = "section-title";
  heading.textContent = title;
  card.appendChild(heading);

  for (const line of lines) {
    const el = document.createElement("div");
    el.textContent = String(line);
    card.appendChild(el);
  }
  container.appendChild(card);
}

function renderCandidate(result) {
  const bodyEl = $("result-body");
  if (!bodyEl) return;

  const candidate = result?.candidate || null;
  const reportSections = Array.isArray(result?.report?.sections) ? result.report.sections : [];

  bodyEl.innerHTML = "";

  if (candidate) {
    addSection(bodyEl, "Candidate", [
      `Direction: ${textOr(candidate.direction)}`,
      `Status: ${textOr(candidate.status)}`,
      `Entry: ${candidate.entryZone ? `${formatPrice(candidate.entryZone.low)} - ${formatPrice(candidate.entryZone.high)}` : "n/a"}`,
      `Stop: ${candidate.stopLoss ? formatPrice(candidate.stopLoss.price) : "n/a"}`,
      `Targets: ${Array.isArray(candidate.takeProfitLevels) && candidate.takeProfitLevels.length ? candidate.takeProfitLevels.map((target) => formatPrice(target?.price)).filter((item) => item !== "n/a").join(", ") : "n/a"}`,
      `RR: ${textOr(candidate.rrProfile?.primary)}`,
      `Trigger: ${textOr(candidate.triggerType)}`,
      `Best Session: ${textOr(candidate.bestSession)}`,
    ]);
  }

  for (const section of reportSections) {
    addSection(bodyEl, textOr(section?.title, "Section"), Array.isArray(section?.body) ? section.body : []);
  }
}

function renderExecutionPlan(result) {
  const execEl = $("execution-body");
  if (!execEl) return;

  const executionPlan = result?.executionPlan || null;
  if (!executionPlan) {
    execEl.textContent = "Run a workflow to see an execution plan.";
    return;
  }

  if (executionPlan.status === "no_trade") {
    execEl.textContent = "Execution plan suppressed (no-trade).";
    return;
  }

  execEl.innerHTML = "";
  addSection(execEl, "Entry Plan", [textOr(executionPlan.entryPlan)]);
  addSection(execEl, "Stop Plan", [textOr(executionPlan.stopPlan)]);
  addSection(execEl, "Targets", [Array.isArray(executionPlan.targetPlan) && executionPlan.targetPlan.length ? executionPlan.targetPlan.join(" | ") : "n/a"]);
}

function buildSignalModel(result) {
  const market = result?.marketSnapshot || {};
  const candidate = result?.candidate || {};
  const technical = result?.technicalContext || {};

  const points = [];
  const bands = [];
  const currentPrice = toNumber(market?.price?.current ?? market?.lastPrice ?? null);
  const dayHigh = toNumber(market?.price?.dayHigh ?? null);
  const dayLow = toNumber(market?.price?.dayLow ?? null);
  const entryLow = toNumber(candidate?.entryZone?.low ?? technical?.entryZone?.low ?? null);
  const entryHigh = toNumber(candidate?.entryZone?.high ?? technical?.entryZone?.high ?? null);
  const stop = toNumber(candidate?.stopLoss?.price ?? technical?.stopLoss?.price ?? null);
  const targets = Array.isArray(candidate?.takeProfitLevels) ? candidate.takeProfitLevels : [];

  if (Number.isFinite(currentPrice)) points.push({ label: "Current", value: currentPrice, kind: "current" });
  if (Number.isFinite(dayHigh)) points.push({ label: "Day High", value: dayHigh, kind: "reference" });
  if (Number.isFinite(dayLow)) points.push({ label: "Day Low", value: dayLow, kind: "reference" });
  if (Number.isFinite(entryLow) && Number.isFinite(entryHigh)) {
    bands.push({ label: "Entry Zone", low: Math.min(entryLow, entryHigh), high: Math.max(entryLow, entryHigh), kind: "entry" });
  }
  if (Number.isFinite(stop)) points.push({ label: "Stop", value: stop, kind: "stop" });
  for (const [index, target] of targets.entries()) {
    const price = toNumber(target?.price);
    if (price === null) continue;
    points.push({ label: `Target ${index + 1}`, value: price, kind: "target" });
  }

  const extraLevels = Array.isArray(technical?.levels) ? technical.levels : [];
  for (const level of extraLevels.slice(0, 4)) {
    const value = toNumber(level?.price);
    if (value === null) continue;
    points.push({ label: level?.source || "Key Level", value, kind: "reference" });
  }

  return { points, bands };
}

function renderSignalVisual(result) {
  const container = $("signal-visual");
  const legend = $("signal-legend");
  if (!container || !legend) return;

  const model = buildSignalModel(result);
  const points = model.points;
  const bands = model.bands;

  if (!points.length && !bands.length) {
    container.className = "signal-visual empty";
    container.innerHTML = `
      <div class="signal-empty">
        <strong>No signal loaded yet.</strong>
        <span class="muted small">Run a workflow to see the entry stack and price levels.</span>
      </div>
    `;
    legend.innerHTML = "";
    return;
  }

  const numericValues = [...points.map((point) => point.value), ...bands.flatMap((band) => [band.low, band.high])].filter(Number.isFinite);
  let min = Math.min(...numericValues);
  let max = Math.max(...numericValues);
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    min = 0;
    max = 1;
  }
  const padding = Math.max((max - min) * 0.1, 1);
  min -= padding;
  max += padding;
  const span = Math.max(max - min, 1);

  const width = 840;
  const height = 280;
  const leftPad = 120;
  const rightPad = 760;
  const topPad = 22;
  const bottomPad = 30;
  const scaleY = (value) => {
    const pct = (value - min) / span;
    return height - bottomPad - pct * (height - topPad - bottomPad);
  };

  const rows = [];
  for (let index = 0; index < 6; index += 1) {
    const value = min + (span / 5) * index;
    const y = scaleY(value);
    rows.push(`<line x1="${leftPad}" x2="${rightPad}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" class="signal-gridline" />`);
    rows.push(`<text x="18" y="${(y + 4).toFixed(1)}" class="signal-note">${value.toFixed(2)}</text>`);
  }

  const bandMarkup = bands.map((band) => {
    const y1 = scaleY(band.high);
    const y2 = scaleY(band.low);
    const top = Math.min(y1, y2);
    const bandHeight = Math.max(Math.abs(y2 - y1), 8);
    const labelY = top + bandHeight / 2 + 4;
    return `
      <rect x="${leftPad}" y="${top.toFixed(1)}" width="${rightPad - leftPad}" height="${bandHeight.toFixed(1)}" rx="10" class="signal-band" />
      <text x="${rightPad + 8}" y="${labelY.toFixed(1)}" class="signal-marker-text">${band.label}: ${formatPrice(band.low)} - ${formatPrice(band.high)}</text>
    `;
  }).join("");

  const pointMarkup = points.map((point) => {
    const y = scaleY(point.value);
    const className = point.kind === "stop" ? "signal-stop" : point.kind === "target" ? "signal-target" : point.kind === "current" ? "signal-marker" : "signal-axis";
    return `
      <line x1="${leftPad}" x2="${rightPad}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" class="${className}" />
      <circle cx="${leftPad + 8}" cy="${y.toFixed(1)}" r="4.5" class="signal-marker" />
      <text x="${rightPad + 8}" y="${(y + 4).toFixed(1)}" class="signal-marker-text">${point.label}: ${formatPrice(point.value)}</text>
    `;
  }).join("");

  container.className = "signal-visual";
  container.innerHTML = `
    <svg class="signal-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Signal visualization">
      <defs>
        <linearGradient id="signal-bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="rgba(255,255,255,0.03)" />
          <stop offset="100%" stop-color="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${width}" height="${height}" rx="16" fill="url(#signal-bg)" />
      ${rows.join("")}
      ${bandMarkup}
      ${pointMarkup}
      <text x="18" y="18" class="signal-note">Price ladder and trade structure</text>
    </svg>
  `;

  const legendItems = [
    { label: "Current price", value: textOr(formatPrice(points.find((point) => point.kind === "current")?.value)), color: "#edf1f8" },
    { label: "Entry zone", value: bands.length ? `${formatPrice(bands[0].low)} - ${formatPrice(bands[0].high)}` : "n/a", color: "#f5b63b" },
    { label: "Stop", value: textOr(formatPrice(points.find((point) => point.kind === "stop")?.value)), color: "#ff7a59" },
    { label: "Targets", value: points.filter((point) => point.kind === "target").map((point) => formatPrice(point.value)).join(", ") || "n/a", color: "#57d5cc" },
  ];

  legend.innerHTML = legendItems.map((item) => `
    <div class="legend-item">
      <div class="legend-row">
        <span class="legend-swatch" style="background: ${item.color};"></span>
        <strong>${item.label}</strong>
      </div>
      <div class="muted small">${item.value}</div>
    </div>
  `).join("");
}

function renderVisionPreviewFromCapture(capture = null, message = null) {
  const statusEl = $("vision-status");
  const imageEl = $("vision-image");
  const placeholderEl = $("vision-placeholder");
  const previewEl = imageEl?.parentElement;
  if (!statusEl || !imageEl || !placeholderEl || !previewEl) return;

  const imageUrl = capture?.publicPath || capture?.imageUrl || capture?.url || null;
  if (imageUrl) {
    imageEl.src = imageUrl;
    imageEl.alt = `TradingView chart preview for ${capture?.symbol || "XAUUSD"}`;
    previewEl.classList.add("has-image");
    statusEl.textContent = message || `Captured ${capture?.symbol || "XAUUSD"} (${capture?.timeframeLabel || capture?.timeframe || "chart"}).`;
    placeholderEl.innerHTML = "";
    const title = document.createElement("strong");
    title.textContent = "Latest capture ready.";
    const note = document.createElement("span");
    note.className = "muted small";
    note.textContent = capture?.chartUrl || "Screenshot captured successfully.";
    placeholderEl.appendChild(title);
    placeholderEl.appendChild(note);
    return;
  }

  previewEl.classList.remove("has-image");
  imageEl.removeAttribute("src");
  statusEl.textContent = message || "No screenshot returned yet.";
  placeholderEl.innerHTML = `
    <strong>Chart preview will appear here.</strong>
    <span class="muted small">If capture returns an image URL, the screenshot will render here.</span>
  `;
}

function renderResult(result) {
  const headlineEl = $("result-headline");
  const summaryEl = $("result-summary");
  if (!headlineEl || !summaryEl) return;

  state.latestResult = result || null;
  updateRuntimePanel({ health: state.health, result });
  renderCandidate(result);
  renderExecutionPlan(result);
  renderSignalVisual(result);

  if (!result) {
    headlineEl.textContent = "No run yet.";
    summaryEl.textContent = "";
    return;
  }

  headlineEl.textContent = `${textOr(result.finalStatus, "NO_STATUS").toUpperCase()} - ${textOr(result.report?.headline, "No headline")}`;
  summaryEl.textContent = textOr(result.report?.summary, "No summary available.");
}

function setRawPayload(payload) {
  state.latestRaw = payload || null;
  const rawEl = $("raw-json");
  if (!rawEl) return;
  rawEl.textContent = payload ? JSON.stringify(payload, null, 2) : "Run a workflow to view JSON output.";
}

function renderMergedDecision(merged = null) {
  const headlineEl = $("merged-headline");
  const summaryEl = $("merged-summary");
  const bodyEl = $("merged-body");
  if (!headlineEl || !summaryEl || !bodyEl) return;

  state.merged = merged || null;
  bodyEl.innerHTML = "";

  if (!merged) {
    headlineEl.textContent = "No merged decision yet.";
    summaryEl.textContent = "";
    return;
  }

  headlineEl.textContent = `${textOr(merged.finalStatus, "unknown").toUpperCase()} - confidence ${toNumber(merged.mergedConfidence)?.toFixed(2) || "n/a"}`;
  summaryEl.textContent = textOr(merged.summary, "No merged summary.");

  addSection(bodyEl, "API", [
    `Status: ${textOr(merged.api?.status)}`,
    `Direction: ${textOr(merged.api?.direction)}`,
    `Confidence: ${toNumber(merged.api?.confidence)?.toFixed(2) || "n/a"}`,
  ]);

  addSection(bodyEl, "Vision", [
    `Status: ${textOr(merged.vision?.status)}`,
    `Direction: ${textOr(merged.vision?.direction)}`,
    `Confidence: ${toNumber(merged.vision?.confidence)?.toFixed(2) || "n/a"}`,
    `Weighted score: ${toNumber(merged.vision?.weightedScore)?.toFixed(2) || "n/a"}`,
  ]);

  addSection(bodyEl, "Alignment", [
    `Verdict: ${textOr(merged.alignment?.verdict)}`,
    `Score: ${toNumber(merged.alignment?.score)?.toFixed(2) || "n/a"}`,
  ]);

  const voteLines = Array.isArray(merged.vision?.timeframeVotes)
    ? merged.vision.timeframeVotes.map((vote) => `${vote.timeframeLabel || vote.timeframe}: ${vote.direction} (${toNumber(vote.confidence)?.toFixed(2) || "n/a"})`)
    : [];
  addSection(bodyEl, "Timeframe Votes", voteLines.length ? voteLines : ["No timeframe votes available."]);

  addSection(bodyEl, "Reasons", Array.isArray(merged.reasons) && merged.reasons.length ? merged.reasons : ["No reasons supplied."]);
}

function getVisionRequestOptions() {
  const symbol = ($("vision-symbol")?.value || "XAUUSD").trim() || "XAUUSD";
  const timeframes = parseTimeframesInput($("vision-timeframes")?.value || "1,5,15,60,240");
  const cycles = parseCycles($("vision-cycles")?.value || "1");
  return { symbol, timeframes, cycles };
}

async function loadInitial() {
  const runStatus = $("run-status");
  if (runStatus) runStatus.textContent = "Loading...";

  const [healthResult, fixturesResult, workflowsResult] = await Promise.allSettled([
    fetchJson("/health"),
    fetchJson("/fixtures"),
    fetchJson("/workflows"),
  ]);

  state.health = healthResult.status === "fulfilled" ? healthResult.value : null;
  state.fixtures = fixturesResult.status === "fulfilled" && Array.isArray(fixturesResult.value) ? fixturesResult.value : [];
  state.workflows = workflowsResult.status === "fulfilled" && Array.isArray(workflowsResult.value) ? workflowsResult.value : [];

  if (healthResult.status === "fulfilled") {
    setHealth(healthResult.value);
  } else {
    setHealth(null);
  }

  renderOptions($("fixture-select"), state.fixtures);
  renderOptions($("workflow-select"), state.workflows);
  updateRuntimePanel({ health: state.health, result: state.latestResult });

  if (runStatus) runStatus.textContent = "Ready";
}

async function runWorkflow() {
  const workflowName = $("workflow-select")?.value || "morningBriefing";
  const fixtureName = $("fixture-select")?.value || "bullishRetest";
  const marketMode = $("market-mode-select")?.value || "fixture";
  const symbol = ($("market-symbol-input")?.value || "XAU/USD").trim() || "XAU/USD";
  const runStatus = $("run-status");

  if (runStatus) runStatus.textContent = "Running...";
  try {
    const response = await fetchJson("/run", {
      method: "POST",
      body: JSON.stringify({ workflowName, fixtureName, marketMode, symbol }),
    });
    const finalState = response?.finalState || response || null;
    renderResult(finalState);
    renderMergedDecision(null);
    setRawPayload(response);
    if (runStatus) runStatus.textContent = "Done";
  } catch (error) {
    if (runStatus) runStatus.textContent = `Error: ${error.message}`;
    renderResult(null);
    setRawPayload({ error: error.message });
  }
}

async function captureVision() {
  const statusEl = $("vision-status");
  const btn = $("vision-btn");
  const { symbol } = getVisionRequestOptions();
  if (!statusEl) return;

  if (btn) btn.disabled = true;
  statusEl.textContent = `Capturing ${symbol}...`;
  try {
    const response = await fetchJson("/vision/capture", {
      method: "POST",
      body: JSON.stringify({ symbol }),
    });

    const capture = response?.result?.capture || null;
    state.vision = {
      symbol,
      capture,
      message: response?.message || "Capture complete.",
    };
    renderVisionPreviewFromCapture(capture, state.vision.message);
    setRawPayload(response);
  } catch (error) {
    renderVisionPreviewFromCapture(null, `Capture unavailable: ${error.message}`);
    setRawPayload({ error: error.message });
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function runVisionMonitor() {
  const statusEl = $("vision-status");
  const btn = $("vision-monitor-btn");
  const { symbol, timeframes, cycles } = getVisionRequestOptions();
  if (!statusEl) return;

  if (btn) btn.disabled = true;
  statusEl.textContent = `Monitoring ${symbol} on ${timeframes.join(",")}...`;
  try {
    const response = await fetchJson("/vision/monitor", {
      method: "POST",
      body: JSON.stringify({
        symbol,
        timeframes,
        cycles,
        analyze: true,
      }),
    });

    state.visionMonitor = response?.monitor || null;
    const latestCapture = state.visionMonitor?.latestCycle?.capture?.captures?.at(-1) || null;
    const aggregate = state.visionMonitor?.aggregate;
    const message = aggregate?.summary || "Multi-timeframe monitor complete.";
    renderVisionPreviewFromCapture(latestCapture, message);
    setRawPayload(response);
  } catch (error) {
    renderVisionPreviewFromCapture(null, `Monitor unavailable: ${error.message}`);
    setRawPayload({ error: error.message });
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function runMergedDecision() {
  const runStatus = $("run-status");
  const visionStatus = $("vision-status");
  const btn = $("merged-run-btn");
  const workflowName = $("workflow-select")?.value || "intradayScan";
  const fixtureName = $("fixture-select")?.value || "bullishRetest";
  const marketMode = $("market-mode-select")?.value || "fixture";
  const symbol = ($("market-symbol-input")?.value || "XAU/USD").trim() || "XAU/USD";
  const { timeframes, cycles } = getVisionRequestOptions();

  if (btn) btn.disabled = true;
  if (runStatus) runStatus.textContent = "Running merged decision...";
  if (visionStatus) visionStatus.textContent = "Coordinator is combining API + vision...";

  try {
    const response = await fetchJson("/decision/merged", {
      method: "POST",
      body: JSON.stringify({
        workflowName,
        fixtureName,
        marketMode,
        symbol,
        timeframes,
        cycles,
        analyze: true,
      }),
    });

    renderResult(response?.api?.finalState || null);
    renderMergedDecision(response?.merged || null);
    state.visionMonitor = response?.vision || null;
    const latestCapture = state.visionMonitor?.latestCycle?.capture?.captures?.at(-1) || null;
    renderVisionPreviewFromCapture(latestCapture, response?.merged?.summary || "Merged decision completed.");
    setRawPayload(response);
    if (runStatus) runStatus.textContent = "Merged decision done";
  } catch (error) {
    if (runStatus) runStatus.textContent = `Merged decision failed: ${error.message}`;
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

  $("market-mode-select")?.addEventListener("change", (event) => {
    event.currentTarget.dataset.userChanged = "1";
  });

  $("run-btn")?.addEventListener("click", runWorkflow);
  $("vision-btn")?.addEventListener("click", captureVision);
  $("vision-monitor-btn")?.addEventListener("click", runVisionMonitor);
  $("merged-run-btn")?.addEventListener("click", runMergedDecision);
});
