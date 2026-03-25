#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

function normalizeSymbol(symbol = "XAUUSD", exchange = "OANDA") {
  if (symbol.includes(":")) return symbol;
  return `${exchange}:${symbol}`;
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

  return {
    symbol,
    exchange,
    normalizedSymbol: normalizeSymbol(symbol, exchange),
    outputPath: output,
    headless,
    analyze,
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

export async function captureTradingViewChart({
  symbol = "XAUUSD",
  exchange = "OANDA",
  outputPath = `screenshots/tradingview-${symbol.toLowerCase()}.png`,
  headless = true,
  waitMs = 3500,
  keepOpenMs = 0,
  baseUrl = "https://www.tradingview.com/chart/",
} = {}) {
  const { chromium } = await loadPlaywright();
  const normalizedSymbol = normalizeSymbol(symbol, exchange);
  const finalUrl = buildTradingViewUrl(baseUrl, normalizedSymbol);

  await ensureDir(outputPath);

  const browser = await chromium.launch({ headless });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

  try {
    await page.goto(finalUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(waitMs);

    // Best-effort search fallback if the symbol query param is ignored by the page state.
    try {
      await page.keyboard.press("Escape");
      await page.keyboard.press("ControlOrMeta+K");
      await page.waitForTimeout(450);
      await page.keyboard.type(normalizedSymbol);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(2000);
    } catch {
      // Keep the capture moving even if TradingView's UI changes.
    }

    await page.screenshot({ path: outputPath, fullPage: true });
    if (keepOpenMs > 0 && !headless) {
      await page.waitForTimeout(keepOpenMs);
    }
  } finally {
    await browser.close();
  }

  return {
    status: "captured",
    symbol,
    exchange,
    normalizedSymbol,
    outputPath,
    fileName: path.basename(outputPath),
    publicPath: `/screenshots/${path.basename(outputPath)}`,
    chartUrl: finalUrl,
    headless,
    capturedAt: new Date().toISOString(),
  };
}

async function runCli() {
  const options = parseArgs(process.argv);
  process.stdout.write(`Opening TradingView for ${options.normalizedSymbol}...\n`);
  const result = await captureTradingViewChart(options);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (invokedPath && import.meta.url === invokedPath) {
  runCli().catch((error) => {
    process.stderr.write(`TradingView capture failed: ${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}
