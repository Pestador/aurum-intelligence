import { agentDefinition } from "./base.js";
import { HigherTimeframeStructureAgent } from "./higher-timeframe-structure.js";
import { LiquidityKeyLevelsAgent } from "./liquidity-key-levels.js";
import { MomentumVolatilitySessionAgent } from "./momentum-volatility-session.js";
import { TriggerStructureAgent } from "./trigger-structure.js";

export function createTechnicalAgents() {
  const agents = [
    new HigherTimeframeStructureAgent(),
    new TriggerStructureAgent(),
    new LiquidityKeyLevelsAgent(),
    new MomentumVolatilitySessionAgent()
  ];
  return agents.map((agent) => agentDefinition(agent));
}

export function createTechnicalAgentMap() {
  return Object.fromEntries(createTechnicalAgents().map((agent) => [agent.name, agent]));
}
