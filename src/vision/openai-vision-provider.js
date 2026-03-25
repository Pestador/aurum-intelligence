import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4.1-mini";

function guessMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
}

function extractOutputText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const outputs = Array.isArray(payload?.output) ? payload.output : [];
  const parts = [];
  for (const output of outputs) {
    const content = Array.isArray(output?.content) ? output.content : [];
    for (const item of content) {
      if (typeof item?.text === "string" && item.text.trim()) {
        parts.push(item.text.trim());
      }
    }
  }

  return parts.join("\n\n").trim();
}

function extractJsonObject(text = "") {
  const trimmed = String(text || "").trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    // Continue into loose extraction.
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const maybeJson = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(maybeJson);
    } catch {
      return null;
    }
  }
  return null;
}

function normalizeDirection(direction = "neutral") {
  const normalized = String(direction || "").toLowerCase();
  if (["bullish", "bearish", "neutral", "mixed"].includes(normalized)) return normalized;
  if (normalized === "long") return "bullish";
  if (normalized === "short") return "bearish";
  return "neutral";
}

function normalizeConfidence(value, fallback = 0.5) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed > 1) return Math.min(1, Math.max(0, parsed / 100));
  return Math.min(1, Math.max(0, parsed));
}

async function fileToDataUrl(filePath) {
  const buffer = await fs.readFile(filePath);
  const mimeType = guessMimeType(filePath);
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function defaultChartPrompt(symbol = "XAU/USD", timeframe = "unknown") {
  return [
    `Inspect this ${symbol} chart screenshot on timeframe ${timeframe}.`,
    "Return a strict JSON object with keys: summary, direction (bullish|bearish|neutral|mixed), confidence (0-1), score (0-100), keyLevels (array of numbers), caveats (array of strings).",
    "Base the output only on what is visible in the chart image and be explicit about uncertainty.",
  ].join(" ");
}

export function createOpenAIVisionProvider({
  apiKey = process.env.OPENAI_API_KEY,
  baseUrl = process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL,
  model = process.env.AURUM_VISION_MODEL || DEFAULT_MODEL,
} = {}) {
  async function analyzeChartImage({
    imagePath,
    symbol = "XAU/USD",
    timeframe = "unknown",
    prompt = defaultChartPrompt(symbol, timeframe),
  } = {}) {
    if (!apiKey) {
      return {
        status: "unavailable",
        provider: "openai",
        model,
        reason: "OPENAI_API_KEY missing",
      };
    }

    if (!imagePath) {
      return {
        status: "error",
        provider: "openai",
        model,
        reason: "imagePath missing",
      };
    }

    const imageUrl = await fileToDataUrl(imagePath);
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/responses`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: prompt },
              { type: "input_image", image_url: imageUrl, detail: "high" },
            ],
          },
        ],
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      return {
        status: "error",
        provider: "openai",
        model,
        reason: payload?.error?.message || `Vision request failed with HTTP ${response.status}`,
      };
    }

    const text = extractOutputText(payload);
    const parsed = extractJsonObject(text);
    const direction = normalizeDirection(parsed?.direction);
    const confidence = normalizeConfidence(parsed?.confidence, 0.55);
    const score = Number.isFinite(Number(parsed?.score)) ? Number(parsed.score) : null;
    const keyLevels = Array.isArray(parsed?.keyLevels)
      ? parsed.keyLevels.map((value) => Number(value)).filter(Number.isFinite)
      : [];
    const caveats = Array.isArray(parsed?.caveats)
      ? parsed.caveats.map((item) => String(item))
      : [];

    return {
      status: "completed",
      provider: "openai",
      model,
      summary: parsed?.summary || text || "Vision model returned without a text summary.",
      direction,
      confidence,
      score,
      keyLevels,
      caveats,
      raw: payload,
    };
  }

  return {
    getCapabilities() {
      return {
        provider: "openai",
        configured: Boolean(apiKey),
        model,
        baseUrl,
      };
    },
    analyzeChartImage,
  };
}
