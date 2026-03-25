import path from "node:path";
import { captureTradingViewChart } from "./tradingview.js";
import { createOpenAIVisionProvider } from "./openai-vision-provider.js";

function sanitizeSymbol(symbol = "XAUUSD") {
  return String(symbol).replace(/[^A-Za-z0-9:_-]/g, "").toUpperCase() || "XAUUSD";
}

function defaultOutputPath(rootDir, symbol) {
  const safeSymbol = sanitizeSymbol(symbol).replace(":", "-").toLowerCase();
  return path.join(rootDir, "screenshots", `tradingview-${safeSymbol}.png`);
}

export function createVisionService({
  rootDir = process.cwd(),
  visionProvider = createOpenAIVisionProvider(),
} = {}) {
  let latestResult = null;

  async function capture(options = {}) {
    const symbol = options.symbol || "XAUUSD";
    const outputPath = options.outputPath || defaultOutputPath(rootDir, symbol);
    const captureResult = await captureTradingViewChart({
      ...options,
      symbol,
      outputPath,
    });

    latestResult = {
      capturedAt: captureResult.capturedAt,
      capture: captureResult,
      analysis: latestResult?.analysis || null,
    };

    return latestResult;
  }

  async function analyze(options = {}) {
    const imagePath = options.imagePath || latestResult?.capture?.outputPath;
    const symbol = options.symbol || latestResult?.capture?.symbol || "XAU/USD";
    const analysis = await visionProvider.analyzeChartImage({
      imagePath,
      symbol,
      prompt: options.prompt,
    });

    latestResult = {
      capturedAt: latestResult?.capturedAt || new Date().toISOString(),
      capture: latestResult?.capture || null,
      analysis,
    };

    return latestResult;
  }

  async function captureAndAnalyze(options = {}) {
    const captureResult = await capture(options);
    const shouldAnalyze = options.analyze !== false;
    if (!shouldAnalyze) {
      return captureResult;
    }

    const analysisResult = await analyze({
      imagePath: captureResult.capture?.outputPath,
      symbol: captureResult.capture?.symbol,
      prompt: options.prompt,
    });

    return analysisResult;
  }

  return {
    capture,
    analyze,
    captureAndAnalyze,
    getLatest() {
      return latestResult ? structuredClone(latestResult) : null;
    },
    getCapabilities() {
      return {
        capture: {
          tradingView: true,
        },
        analysis: visionProvider.getCapabilities(),
      };
    },
  };
}
