import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createAurumSystem } from "./index.js";
import { createVisionService } from "./vision/service.js";
import { mergeApiAndVisionDecision } from "./vision/merge-coordinator.js";

const system = createAurumSystem();
const port = Number(process.env.PORT || 3000);
const root = process.cwd();
const webRoot = path.join(root, "web");
const screenshotsRoot = path.join(root, "screenshots");
const vision = createVisionService({ rootDir: root });

function normalizeTradingViewSymbol(symbol = "XAU/USD") {
  const raw = String(symbol || "").trim();
  if (!raw) return "XAUUSD";
  if (raw.includes(":")) return raw;
  return raw.replace("/", "");
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body, null, 2));
}

function sendFile(response, filePath, contentType = "text/html") {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      response.writeHead(404, { "content-type": "text/plain" });
      response.end("Not found");
      return;
    }
    response.writeHead(200, { "content-type": contentType });
    response.end(data);
  });
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function resolveContentType(filePath) {
  if (filePath.endsWith(".css")) return "text/css";
  if (filePath.endsWith(".js")) return "application/javascript";
  if (filePath.endsWith(".json")) return "application/json";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  if (filePath.endsWith(".webp")) return "image/webp";
  return "text/html";
}

function safeJoin(baseDir, relativePath) {
  const resolved = path.resolve(baseDir, relativePath);
  const normalizedBase = `${path.resolve(baseDir)}${path.sep}`;
  if (!(resolved === path.resolve(baseDir) || resolved.startsWith(normalizedBase))) {
    return null;
  }
  return resolved;
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

    // Static dashboard
    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/web" || url.pathname === "/dashboard")) {
      return sendFile(response, path.join(webRoot, "index.html"), "text/html");
    }
    if (request.method === "GET" && url.pathname.startsWith("/web/")) {
      const relativePath = url.pathname.replace(/^\/web\//, "");
      const filePath = safeJoin(webRoot, relativePath);
      if (!filePath) return sendJson(response, 400, { error: "Invalid path" });
      return sendFile(response, filePath, resolveContentType(filePath));
    }
    if (request.method === "GET" && url.pathname.startsWith("/screenshots/")) {
      const relativePath = url.pathname.replace(/^\/screenshots\//, "");
      const filePath = safeJoin(screenshotsRoot, relativePath);
      if (!filePath) return sendJson(response, 400, { error: "Invalid path" });
      return sendFile(response, filePath, resolveContentType(filePath));
    }

    // JSON API
    if (request.method === "GET" && url.pathname === "/health") {
      const runtime = system.getStatus();
      return sendJson(response, 200, {
        status: "ok",
        health: system.api.getHealth(),
        mode: runtime.defaultMarketMode,
        runtime,
        vision: vision.getCapabilities(),
        fixtures: Object.keys(system.fixtures),
      });
    }

    if (request.method === "GET" && url.pathname === "/status") {
      const runtime = system.getStatus();
      return sendJson(response, 200, {
        status: "ok",
        mode: runtime.defaultMarketMode,
        runtime,
        vision: vision.getCapabilities(),
        latestVision: vision.getLatest(),
      });
    }

    if (request.method === "GET" && url.pathname === "/agents") {
      return sendJson(response, 200, system.api.listAgents());
    }

    if (request.method === "GET" && url.pathname === "/workflows") {
      return sendJson(response, 200, system.api.listWorkflows());
    }

    if (request.method === "GET" && url.pathname === "/fixtures") {
      return sendJson(response, 200, Object.values(system.fixtures).map((fixture) => ({
        name: fixture.name,
        description: fixture.description,
      })));
    }

    if (request.method === "POST" && url.pathname === "/run") {
      const payload = await readJson(request);
      const result = await system.runScenario(payload || {});
      return sendJson(response, 200, result);
    }

    if (request.method === "GET" && url.pathname === "/vision/latest") {
      const latest = vision.getLatest();
      return sendJson(response, 200, {
        status: "ok",
        latest,
        imageUrl: latest?.capture?.publicPath || null,
        message: latest?.analysis?.summary || (latest?.capture ? "Latest chart capture is available." : "No chart capture yet."),
      });
    }

    if (request.method === "POST" && url.pathname === "/vision/capture") {
      const payload = await readJson(request);
      const result = await vision.captureAndAnalyze(payload || {});
      return sendJson(response, 200, {
        status: "ok",
        result,
        imageUrl: result?.capture?.publicPath || null,
        source: "TradingView",
        message: result?.analysis?.summary || "Chart capture completed.",
      });
    }

    if (request.method === "POST" && url.pathname === "/vision/monitor") {
      const payload = await readJson(request);
      const monitor = await vision.monitorTimeframes({
        symbol: payload?.symbol || "XAUUSD",
        timeframes: payload?.timeframes,
        cycles: payload?.cycles,
        cycleDelayMs: payload?.cycleDelayMs,
        analyze: payload?.analyze,
        headless: payload?.headless,
        waitMs: payload?.waitMs,
        exchange: payload?.exchange,
      });
      return sendJson(response, 200, {
        status: "ok",
        monitor,
      });
    }

    if (request.method === "POST" && url.pathname === "/decision/merged") {
      const payload = await readJson(request);
      const workflowResult = await system.runScenario({
        workflowName: payload?.workflowName || "intradayScan",
        fixtureName: payload?.fixtureName || "bullishRetest",
        marketMode: payload?.marketMode,
        symbol: payload?.symbol || "XAU/USD",
      });
      const monitor = await vision.monitorTimeframes({
        symbol: normalizeTradingViewSymbol(payload?.symbol || "XAU/USD"),
        timeframes: payload?.timeframes || ["1", "5", "15", "60", "240"],
        cycles: payload?.cycles ?? 1,
        cycleDelayMs: payload?.cycleDelayMs ?? 0,
        analyze: payload?.analyze !== false,
        headless: payload?.headless,
        waitMs: payload?.waitMs,
        exchange: payload?.exchange,
      });

      const merged = mergeApiAndVisionDecision({
        apiWorkflow: workflowResult?.workflow,
        apiFinalState: workflowResult?.finalState,
        visionMonitor: monitor,
      });

      return sendJson(response, 200, {
        status: "ok",
        merged,
        api: workflowResult,
        vision: monitor,
      });
    }

    return sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    return sendJson(response, 500, {
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

server.listen(port, () => {
  process.stdout.write(`Aurum Intelligence server listening on http://localhost:${port}\n`);
});
