import { createAurumApi, createAurumRuntime } from "./core/index.js";
import { createAurumWorkflowSet, createRuntimeAgents, extractFinalState } from "./agent-integration.js";
import { createFixtureLibrary, getFixtureByName } from "./fixtures-library.js";

function safeClone(value) {
  return structuredClone(value);
}

function createFixtureMarketProvider(fixtures) {
  return {
    async getSnapshot({ symbol = "XAU/USD", fixtureName = "bullishRetest" } = {}) {
      const selected = fixtures[fixtureName] || fixtures.bullishRetest;
      const snapshot = safeClone(selected.marketSnapshot);
      snapshot.symbol = symbol;
      snapshot.source = "fixture-market-provider";
      return snapshot;
    },
  };
}

export function createAurumSystem(options = {}) {
  const fixtures = options.fixtures || createFixtureLibrary();
  const runtime = createAurumRuntime({
    autoRegisterDefaultAgents: false,
    workflows: createAurumWorkflowSet(),
    logging: options.logging || {
      sink: {
        log() {},
        warn() {},
        error() {},
      },
    },
    providers: {
      market: options.providers?.market || createFixtureMarketProvider(fixtures),
      news: options.providers?.news,
      model: options.providers?.model,
    },
  });

  for (const agent of createRuntimeAgents()) {
    runtime.registerAgent(agent);
  }

  const api = createAurumApi(runtime);

  async function runScenario({
    workflowName = "morningBriefing",
    fixtureName = "bullishRetest",
    symbol = "XAU/USD",
    userRequest = {},
    profile = null,
  } = {}) {
    const fixture = getFixtureByName(fixtureName);
    const mergedProfile = profile || fixture.userProfile || {};
    const result = await api.runNamedWorkflow(workflowName, {
      workflowId: fixture.workflowId,
      userRequest: {
        symbol,
        fixtureName,
        ...userRequest,
      },
      profile: safeClone(mergedProfile),
      runtime: {
        fixtureName,
      },
      metadata: {
        fixtureName,
      },
    });

    return {
      workflow: result,
      finalState: extractFinalState(result),
    };
  }

  return {
    runtime,
    api,
    fixtures,
    runScenario,
  };
}
