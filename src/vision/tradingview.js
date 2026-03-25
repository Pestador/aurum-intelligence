#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_TIMEFRAMES = ["1", "5", "15", "60", "240"];

function normalizeSymbol(symbol = "XAUUSD", exchange = "OANDA") {
  if (symbol.includes(":")) return symbol;
  return `${exchange}:${symbol}`;
}

function normalizeTimeframe(value = "15") {
  const timeframe = String(value).trim().toLowerCase();
  const map = {
    "1m": "1",
    "3m": "3",
    "5m": "5",
    "15m": "15",
    "30m": "30",
    "45m": "45",
    "1h": "60",
    "2h": "120",
    "3h": "180",
    "4h": "240",
    "1d": "1d",
    "1w": "1w",
  };
  if (map[timeframe]) return map[timeframe];
  return timeframe || "15";
}

function timeframeLabel(timeframe = "15") {
  const normalized = normalizeTimeframe(timeframe);
  const map = {
    "1": "1m",
    "3": "3m",
    "5": "5m",
    "15": "15m",
    "30": "30m",
    "45": "45m",
    "60": "1h",
    "120": "2h",
    "180": "3h",
    "240": "4h",
    "1d": "1d",
    "1w": "1w",
  };
  return map[normalized] || normalized;
}

function parseTimeframes(value) {
  if (!value) return [...DEFAULT_TIMEFRAMES];
  return String(value)
    .split(",")
    .map((item) => normalizeTimeframe(item))
    .filter(Boolean);
}

function parseBoolean(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function parseArgs(argv) {
  const args = {};
  for (const arg of argv.slice(2)) {
    const [key, value] = arg.replace(/^--/, "").split("=");
    args[key] = value ?? true;
  }

  const symbol = args.symbol || "XAUUSD";
  const exchange = args.exchange || "OANDA";
  const output = args.output || `screenshots/tradingview-${symbol.toLowerCase()}.png`;
  const headless = parseBoolean(args.headless, true);
  const analyze = parseBoolean(args.analyze, false);
  const timeframe = normalizeTimeframe(args.timeframe || "15");
  const timeframes = parseTimeframes(args.timeframes);
  const multi = parseBoolean(args.multi, false);

  return {
    symbol,
    exchange,
    normalizedSymbol: normalizeSymbol(symbol, exchange),
    outputPath: output,
    outputDir: args.outputDir || "screenshots",
    headless,
    analyze,
    timeframe,
    timeframes,
    multi,
    waitMs: Number(args.waitMs || 3500),
    keepOpenMs: Number(args.keepOpenMs || 0),
    baseUrl: args.url || "https://www.tradingview.com/chart/",
  };
}

async function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch (error) {
    throw new Error(
      "Playwright is not installed. Run `npm install` and then `npx playwright install chromium` before using chart capture.",
    );
  }
}

function buildTradingViewUrl(baseUrl, normalizedSymbol) {
  const url = new URL(baseUrl);
  url.searchParams.set("symbol", normalizedSymbol);
  return url.toString();
}

function buildTradingViewUrlForTimeframe(baseUrl, normalizedSymbol, timeframe = "15") {
  const url = new URL(baseUrl);
  url.searchParams.set("symbol", normalizedSymbol);
  url.searchParams.set("interval", normalizeTimeframe(timeframe));
  return url.toString();
}

async function captureWithPage(page, {
  symbol = "XAUUSD",
  exchange = "OANDA",
  timeframe = "15",
  outputPath = `screenshots/tradingview-${symbol.toLowerCase()}.png`,
  waitMs = 3500,
  baseUrl = "https://www.tradingview.com/chart/",
} = {}) {
  const normalizedSymbol = normalizeSymbol(symbol, exchange);
  const normalizedTimeframe = normalizeTimeframe(timeframe);
  const finalUrl = buildTradingViewUrlForTimeframe(baseUrl, normalizedSymbol, normalizedTimeframe);

  await ensureDir(outputPath);
  await page.goto(finalUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(waitMs);

  // Best-effort symbol search fallback if query params are ignored in current page state.
  try {
    await page.keyboard.press("Escape");
    await page.keyboard.press("ControlOrMeta+K");
    await page.waitForTimeout(450);
    await page.keyboard.type(normalizedSymbol);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(900);
  } catch {
    // Keep capture resilient to TradingView UI changes.
  }

  await page.screenshot({ path: outputPath, fullPage: true });

  return {
    status: "captured",
    symbol,
    exchange,
    normalizedSymbol,
    timeframe: normalizedTimeframe,
    timeframeLabel: timeframeLabel(normalizedTimeframe),
    outputPath,
    fileName: path.basename(outputPath),
    publicPath: `/screenshots/${path.basename(outputPath)}`,
    chartUrl: finalUrl,
    capturedAt: new Date().toISOString(),
  };
}

export async function captureTradingViewChart({
  symbol = "XAUUSD",
  exchange = "OANDA",
  timeframe = "15",
  outputPath = `screenshots/tradingview-${symbol.toLowerCase()}.png`,
  headless = true,
  waitMs = 3500,
  keepOpenMs = 0,
  baseUrl = "https://www.tradingview.com/chart/",
} = {}) {
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ headless });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

  try {
    const result = await captureWithPage(page, {
      symbol,
      exchange,
      timeframe,
      outputPath,
      waitMs,
      baseUrl,
    });
    if (keepOpenMs > 0 && !headless) {
      await page.waitForTimeout(keepOpenMs);
    }
    return {
      ...result,
      headless,
    };
  } finally {
    await browser.close();
  }
}

export async function captureTradingViewTimeframes({
  symbol = "XAUUSD",
  exchange = "OANDA",
  timeframes = DEFAULT_TIMEFRAMES,
  outputDir = "screenshots",
  headless = true,
  waitMs = 3500,
  baseUrl = "https://www.tradingview.com/chart/",
} = {}) {
  const normalizedSymbol = normalizeSymbol(symbol, exchange);
  const captureTimeframes = (Array.isArray(timeframes) && timeframes.length ? timeframes : DEFAULT_TIMEFRAMES)
    .map((timeframe) => normalizeTimeframe(timeframe));
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ headless });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const captures = [];

  try {
    for (const timeframe of captureTimeframes) {
      const label = timeframeLabel(timeframe).replace(/[^A-Za-z0-9]/g, "");
      const outputPath = path.join(outputDir, `tradingview-${symbol.toLowerCase()}-${label.toLowerCase()}.png`);
      const capture = await captureWithPage(page, {
        symbol,
        exchange,
        timeframe,
        outputPath,
        waitMs,
        baseUrl,
      });
      captures.push({
        ...capture,
        headless,
      });
    }
  } finally {
    await browser.close();
  }

  return {
    status: "captured",
    symbol,
    exchange,
    normalizedSymbol,
    timeframes: captureTimeframes,
    captures,
    capturedAt: new Date().toISOString(),
  };
}

async function runCli() {
  const options = parseArgs(process.argv);
  process.stdout.write(`Opening TradingView for ${options.normalizedSymbol}...\n`);
  const result = options.multi
    ? await captureTradingViewTimeframes(options)
    : await captureTradingViewChart(options);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (invokedPath && import.meta.url === invokedPath) {
  runCli().catch((error) => {
    process.stderr.write(`TradingView capture failed: ${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}
