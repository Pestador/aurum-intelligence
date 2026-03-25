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

async function fileToDataUrl(filePath) {
  const buffer = await fs.readFile(filePath);
  const mimeType = guessMimeType(filePath);
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function defaultChartPrompt(symbol = "XAU/USD") {
  return [
    `Inspect this ${symbol} chart screenshot.`,
    "Describe the visible market structure, probable directional bias, nearby support/resistance or sweep areas, and whether the chart looks tradeable right now.",
    "Be explicit about uncertainty and avoid pretending to know hidden indicators that are not visible.",
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
    prompt = defaultChartPrompt(symbol),
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
    return {
      status: "completed",
      provider: "openai",
      model,
      summary: text || "Vision model returned without a text summary.",
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
