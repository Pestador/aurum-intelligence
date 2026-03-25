import { createAurumApi, createAurumRuntime } from "./core/index.js";
import { createAurumWorkflowSet, createRuntimeAgents, extractFinalState } from "./agent-integration.js";
import { createFixtureLibrary, getFixtureByName } from "./fixtures-library.js";
import { createLiveGoldProvider, createMockMarketProvider } from "./providers/index.js";

function safeClone(value) {
  return structuredClone(value);
}

function createFixtureMarketProvider(fixtures) {
  return {
    async getSnapshot({ symbol = "XAU/USD", fixtureName = "bullishRetest" } = {}) {
      const selected = fixtures[fixtureName] || fixtures.bullishRetest;
      const snapshot = safeClone(selected.marketSnapshot);
      snapshot.symbol = symbol;
      snapshot.liveData = {
        mode: "fixture",
        degraded: false,
        notes: ["Fixture-backed scenario data loaded for deterministic analysis."],
        coverage: {
          spot: true,
          intraday15m: snapshot.timeframes?.["15m"]?.candles?.length || 0,
          intraday1h: snapshot.timeframes?.["1h"]?.candles?.length || 0,
          higherTimeframeDaily: snapshot.timeframes?.["1d"]?.candles?.length || 0,
        },
      };
      snapshot.source = "fixture-market-provider";
      return snapshot;
    },
  };
}

function createHybridMarketProvider({ fixtures, liveProvider, defaultMode = "fixture" }) {
  const fixtureProvider = createFixtureMarketProvider(fixtures);

  return {
    async getSnapshot({ symbol = "XAU/USD", fixtureName = "bullishRetest", marketMode = defaultMode } = {}) {
      if (marketMode === "live") {
        if (!liveProvider) {
          return {
            status: "error",
            symbol,
            source: "live-market-provider",
            liveData: {
              mode: "live",
              degraded: true,
              notes: ["Live mode was requested, but no live provider is configured."],
              coverage: {
                spot: false,
                intraday15m: 0,
                intraday1h: 0,
                higherTimeframeDaily: 0,
              },
            },
            health: {
              ok: false,
              degraded: true,
              reason: "live_provider_missing",
            },
          };
        }
        return liveProvider.getSnapshot({ symbol, fixtureName, marketMode });
      }

      return fixtureProvider.getSnapshot({ symbol, fixtureName });
    },
  };
}

export function createAurumSystem(options = {}) {
  const fixtures = options.fixtures || createFixtureLibrary();
  const liveEnabled = process.env.AURUM_LIVE === "1";
  const liveProvider = liveEnabled ? createLiveGoldProvider() : null;
  const defaultMarketMode = options.defaultMarketMode || (liveEnabled ? "live" : "fixture");
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
      market:
        options.providers?.market ||
        createHybridMarketProvider({
          fixtures,
          liveProvider,
          defaultMode: defaultMarketMode,
        }) ||
        createMockMarketProvider(),
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
    marketMode = defaultMarketMode,
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
        marketMode,
        ...userRequest,
      },
      profile: safeClone(mergedProfile),
      runtime: {
        fixtureName,
        marketMode,
      },
      metadata: {
        fixtureName,
        marketMode,
      },
    });

    return {
      workflow: result,
      finalState: extractFinalState(result),
    };
  }

  function getStatus() {
    return {
      defaultMarketMode,
      liveEnabled,
      liveConfigured: Boolean(liveProvider),
      fixtures: Object.keys(fixtures),
    };
  }

  return {
    runtime,
    api,
    fixtures,
    runScenario,
    getStatus,
  };
}
