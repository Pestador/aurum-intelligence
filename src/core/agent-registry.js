import { validateAgentDefinition } from "./policy.js";
import { ValidationError } from "./errors.js";

export function createAgentRegistry() {
  const agents = new Map();

  function register(agentDefinition) {
    const definition = validateAgentDefinition(agentDefinition);
    agents.set(definition.name, definition);
    return definition.name;
  }

  function get(agentName) {
    if (!agents.has(agentName)) {
      throw new ValidationError(`Unknown agent: ${agentName}`, { agentName });
    }
    return agents.get(agentName);
  }

  function has(agentName) {
    return agents.has(agentName);
  }

  function list() {
    return Array.from(agents.values()).map((agent) => ({
      name: agent.name,
      description: agent.description || "",
      persona: agent.persona || null,
    }));
  }

  return {
    register,
    get,
    has,
    list,
  };
}
