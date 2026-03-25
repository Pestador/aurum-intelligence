import path from "node:path";
import { captureTradingViewChart, captureTradingViewTimeframes } from "./tradingview.js";
import { createOpenAIVisionProvider } from "./openai-vision-provider.js";

const DEFAULT_TIMEFRAMES = ["1", "5", "15", "60", "240"];

function sanitizeSymbol(symbol = "XAUUSD") {
  return String(symbol).replace(/[^A-Za-z0-9:_-]/g, "").toUpperCase() || "XAUUSD";
}

function defaultOutputPath(rootDir, symbol, timeframe = null) {
  const safeSymbol = sanitizeSymbol(symbol).replace(":", "-").toLowerCase();
  if (!timeframe) {
    return path.join(rootDir, "screenshots", `tradingview-${safeSymbol}.png`);
  }
  return path.join(rootDir, "screenshots", `tradingview-${safeSymbol}-${String(timeframe).toLowerCase()}.png`);
}

function detectDirectionFromText(text = "") {
  const normalized = String(text).toLowerCase();
  const bullishHits = (normalized.match(/\bbullish\b|\buptrend\b|\bupside\b|\blong\b|\bbuy\b/g) || []).length;
  const bearishHits = (normalized.match(/\bbearish\b|\bdowntrend\b|\bdownside\b|\bshort\b|\bsell\b/g) || []).length;
  if (bullishHits === 0 && bearishHits === 0) return "neutral";
  if (bullishHits > bearishHits) return "bullish";
  if (bearishHits > bullishHits) return "bearish";
  return "mixed";
}

function parseScoreFromText(text = "") {
  const match = String(text).match(/\b(\d{1,3})\s*\/\s*100\b|\bscore[:\s]+(\d{1,3})\b/i);
  if (!match) return null;
  const raw = Number(match[1] || match[2]);
  if (!Number.isFinite(raw)) return null;
  return Math.max(0, Math.min(100, raw));
}

function safeConfidence(value, fallback = 0.5) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(1, Math.max(0, value));
  }
  return fallback;
}

function timeframeWeights(timeframe = "") {
  const normalized = String(timeframe);
  const map = {
    "1": 0.08,
    "5": 0.12,
    "15": 0.2,
    "60": 0.25,
    "240": 0.35,
  };
  return map[normalized] || 0.1;
}

function aggregateTimeframeAnalyses(analyses = []) {
  const scored = analyses.filter((entry) => entry?.analysis && entry.analysis.status === "completed");
  if (!scored.length) {
    return {
      status: "insufficient",
      summary: "No timeframe analyses were completed.",
      direction: "neutral",
      confidence: 0,
      weightedScore: 0,
      timeframeVotes: [],
    };
  }

  const votes = scored.map((entry) => {
    const direction = entry.analysis.direction || detectDirectionFromText(entry.analysis.summary || "");
    const confidence = safeConfidence(entry.analysis.confidence, 0.45);
    const weight = timeframeWeights(entry.timeframe);
    const score = direction === "bullish"
      ? confidence * weight
      : direction === "bearish"
        ? -confidence * weight
        : 0;
    return {
      timeframe: entry.timeframe,
      timeframeLabel: entry.timeframeLabel,
      direction,
      confidence,
      weight,
      weightedVote: score,
      summary: entry.analysis.summary || "",
    };
  });

  const total = votes.reduce((sum, vote) => sum + vote.weightedVote, 0);
  const absoluteMax = votes.reduce((sum, vote) => sum + vote.weight, 0) || 1;
  const normalized = total / absoluteMax;
  const direction = normalized > 0.1 ? "bullish" : normalized < -0.1 ? "bearish" : "mixed";
  const confidence = Math.min(1, Math.abs(normalized));

  return {
    status: "completed",
    summary: `Vision consensus is ${direction} with confidence ${confidence.toFixed(2)}.`,
    direction,
    confidence,
    weightedScore: normalized,
    timeframeVotes: votes,
  };
}

function cycleDelay(ms = 0) {
  if (!(Number.isFinite(ms) && ms > 0)) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createVisionService({
  rootDir = process.cwd(),
  visionProvider = createOpenAIVisionProvider(),
  captureSingle = captureTradingViewChart,
  captureMulti = captureTradingViewTimeframes,
} = {}) {
  let latestResult = null;

  async function capture(options = {}) {
    const symbol = options.symbol || "XAUUSD";
    const timeframe = options.timeframe || "15";
    const outputPath = options.outputPath || defaultOutputPath(rootDir, symbol, timeframe);
    const captureResult = await captureSingle({
      ...options,
      symbol,
      timeframe,
      outputPath,
    });

    latestResult = {
      capturedAt: captureResult.capturedAt,
      capture: captureResult,
      analysis: latestResult?.analysis || null,
      monitor: latestResult?.monitor || null,
    };

    return latestResult;
  }

  async function captureMultiTimeframe(options = {}) {
    const symbol = options.symbol || "XAUUSD";
    const timeframes = Array.isArray(options.timeframes) && options.timeframes.length
      ? options.timeframes
      : DEFAULT_TIMEFRAMES;
    const outputDir = options.outputDir || path.join(rootDir, "screenshots");
    const captureResult = await captureMulti({
      ...options,
      symbol,
      timeframes,
      outputDir,
    });

    latestResult = {
      capturedAt: captureResult.capturedAt,
      capture: captureResult,
      analysis: latestResult?.analysis || null,
      monitor: latestResult?.monitor || null,
    };

    return captureResult;
  }

  async function analyze(options = {}) {
    const imagePath = options.imagePath || latestResult?.capture?.outputPath;
    const symbol = options.symbol || latestResult?.capture?.symbol || "XAU/USD";
    const analysis = await visionProvider.analyzeChartImage({
      imagePath,
      symbol,
      prompt: options.prompt,
    });

    const enriched = {
      ...analysis,
      direction: analysis.direction || detectDirectionFromText(analysis.summary || ""),
      confidence: safeConfidence(analysis.confidence, analysis.status === "completed" ? 0.6 : 0.2),
      score: Number.isFinite(analysis.score) ? analysis.score : parseScoreFromText(analysis.summary || "") || null,
    };

    latestResult = {
      capturedAt: latestResult?.capturedAt || new Date().toISOString(),
      capture: latestResult?.capture || null,
      analysis: enriched,
      monitor: latestResult?.monitor || null,
    };

    return latestResult;
  }

  async function analyzeTimeframes({
    symbol = "XAU/USD",
    captures = [],
  } = {}) {
    const results = [];
    for (const captureResult of captures) {
      const analysisRaw = await visionProvider.analyzeChartImage({
        imagePath: captureResult.outputPath,
        symbol,
        timeframe: captureResult.timeframe,
        prompt: [
          `Inspect this ${symbol} TradingView screenshot on the ${captureResult.timeframeLabel || captureResult.timeframe} timeframe.`,
          "Return concise decision-support analysis with directional bias, confidence (0-1), setup quality score (0-100), and key levels.",
          "Be explicit about uncertainty.",
        ].join(" "),
      });

      const analysis = {
        ...analysisRaw,
        direction: analysisRaw.direction || detectDirectionFromText(analysisRaw.summary || ""),
        confidence: safeConfidence(analysisRaw.confidence, analysisRaw.status === "completed" ? 0.6 : 0.2),
        score: Number.isFinite(analysisRaw.score) ? analysisRaw.score : parseScoreFromText(analysisRaw.summary || "") || null,
      };

      results.push({
        timeframe: captureResult.timeframe,
        timeframeLabel: captureResult.timeframeLabel,
        capture: captureResult,
        analysis,
      });
    }

    return {
      status: "completed",
      symbol,
      timeframeCount: results.length,
      perTimeframe: results,
      aggregate: aggregateTimeframeAnalyses(results),
      analyzedAt: new Date().toISOString(),
    };
  }

  async function monitorTimeframes({
    symbol = "XAUUSD",
    timeframes = DEFAULT_TIMEFRAMES,
    cycles = 1,
    cycleDelayMs = 0,
    analyze = true,
    ...captureOptions
  } = {}) {
    const monitorCycles = [];
    const cycleCount = Number.isFinite(cycles) && cycles > 0 ? Math.floor(cycles) : 1;

    for (let index = 0; index < cycleCount; index += 1) {
      const captureResult = await captureMultiTimeframe({
        symbol,
        timeframes,
        ...captureOptions,
      });

      let analysisResult = null;
      if (analyze) {
        analysisResult = await analyzeTimeframes({
          symbol,
          captures: captureResult.captures || [],
        });
      }

      monitorCycles.push({
        cycle: index + 1,
        capturedAt: captureResult.capturedAt,
        capture: captureResult,
        analysis: analysisResult,
      });

      if (index < cycleCount - 1) {
        await cycleDelay(cycleDelayMs);
      }
    }

    const finalCycle = monitorCycles.at(-1) || null;
    const monitorResult = {
      status: "completed",
      symbol,
      cycles: monitorCycles,
      latestCycle: finalCycle,
      aggregate: finalCycle?.analysis?.aggregate || {
        status: "insufficient",
        summary: "No analyzed cycle available.",
        direction: "neutral",
        confidence: 0,
        weightedScore: 0,
        timeframeVotes: [],
      },
      monitoredAt: new Date().toISOString(),
    };

    latestResult = {
      capturedAt: finalCycle?.capturedAt || new Date().toISOString(),
      capture: finalCycle?.capture || null,
      analysis: finalCycle?.analysis || null,
      monitor: monitorResult,
    };

    return monitorResult;
  }

  async function captureAndAnalyze(options = {}) {
    const captureResult = await capture(options);
    const shouldAnalyze = options.analyze !== false;
    if (!shouldAnalyze) {
      return captureResult;
    }

    return analyze({
      imagePath: captureResult.capture?.outputPath,
      symbol: captureResult.capture?.symbol,
      prompt: options.prompt,
    });
  }

  return {
    capture,
    captureMultiTimeframe,
    analyze,
    analyzeTimeframes,
    monitorTimeframes,
    captureAndAnalyze,
    getLatest() {
      return latestResult ? structuredClone(latestResult) : null;
    },
    getCapabilities() {
      return {
        capture: {
          tradingView: true,
          multiTimeframe: true,
          supportedTimeframes: [...DEFAULT_TIMEFRAMES],
        },
        analysis: visionProvider.getCapabilities(),
      };
    },
  };
}
