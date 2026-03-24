import { createAgentReport } from "./contracts.js";
import { validateAgentDefinition } from "./policy.js";
import { assertFunction, assertObject, assertString, safeJsonClone } from "./validation.js";

function summarizeFromResponse(response, fallback = "") {
  if (typeof response === "string") return response.slice(0, 400);
  if (response && typeof response.summary === "string") return response.summary;
  if (response && typeof response.text === "string") return response.text.slice(0, 400);
  return fallback;
}

export function createPromptedAgent({
  name,
  description = "",
  personaKey = null,
  promptKey = null,
  buildVariables = null,
  parseResponse = null,
  defaultConfidence = 0.5,
} = {}) {
  assertString(name, "agent name");
  if (buildVariables !== null) {
    assertFunction(buildVariables, "buildVariables");
  }
  if (parseResponse !== null) {
    assertFunction(parseResponse, "parseResponse");
  }

  const agent = {
    name,
    description,
    persona: personaKey ? { key: personaKey } : null,
    async run(context, runtime = {}) {
      assertObject(context, "agent context");
      const promptRegistry = runtime.registry?.promptRegistry || runtime.prompts || runtime.promptRegistry;
      const modelProvider = runtime.providers?.model;
      if (!promptRegistry || !modelProvider) {
        throw new Error(`Prompted agent ${name} requires prompt registry and model provider`);
      }

      const variables = buildVariables ? buildVariables(context, runtime) : context;
      const promptName = promptKey || name;
      const promptBundle = promptRegistry.render(promptName, variables || {});
      const response = await modelProvider.generate({
        prompt: [
          promptBundle.system || "",
          promptBundle.prompt || "",
        ]
          .filter(Boolean)
          .join("\n\n"),
        context: safeJsonClone(variables) || {},
        agentName: name,
      });

      const parsed = parseResponse ? parseResponse(response, context, runtime) : response;
      const summary = summarizeFromResponse(parsed, `Agent ${name} completed`);
      return createAgentReport({
        agentName: name,
        status: parsed?.status || "completed",
        summary,
        evidence: parsed?.evidence || [],
        confidence: Number.isFinite(parsed?.confidence) ? parsed.confidence : defaultConfidence,
        metadata: {
          promptName,
          personaKey,
          raw: parsed?.metadata ? safeJsonClone(parsed.metadata) : undefined,
        },
      });
    },
  };

  return validateAgentDefinition(agent);
}

export function createRuleBasedAgent({
  name,
  description = "",
  personaKey = null,
  run,
} = {}) {
  assertString(name, "agent name");
  assertFunction(run, "run");
  return validateAgentDefinition({
    name,
    description,
    persona: personaKey ? { key: personaKey } : null,
    run,
  });
}
