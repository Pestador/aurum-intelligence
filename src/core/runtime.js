import { createLogger } from "./logging.js";
import { createAuditTrail } from "./audit.js";
import { createOrchestrator } from "./orchestrator.js";
import { createAgentRegistry } from "./agent-registry.js";
import { createPromptRegistry } from "../prompts/registry.js";
import { createMockModelProvider, createMockMarketProvider, createMockNewsProvider } from "../providers/index.js";
import { createDefaultAurumWorkflows, registerDefaultAurumAgents } from "./runtime-presets.js";

export function createAurumRuntime(options = {}) {
  const logger = options.logger || createLogger(options.logging || {});
  const audit = options.audit || createAuditTrail({ logger });
  const agentRegistry = options.agentRegistry || createAgentRegistry();
  const prompts = options.prompts || createPromptRegistry();
  const providers = {
    market: options.providers?.market || createMockMarketProvider(),
    news: options.providers?.news || createMockNewsProvider(),
    model: options.providers?.model || createMockModelProvider(),
  };
  const orchestrator = createOrchestrator({ logger, audit, agentRegistry, prompts, providers });
  const workflows = options.workflows || createDefaultAurumWorkflows();

  if (options.autoRegisterDefaultAgents !== false) {
    registerDefaultAurumAgents(orchestrator);
  }

  return {
    logger,
    audit,
    prompts,
    providers,
    workflows,
    agentRegistry,
    orchestrator,
    registerAgent: orchestrator.registerAgent,
    runWorkflow: orchestrator.runWorkflow,
    runAgent: orchestrator.runAgent,
  };
}
