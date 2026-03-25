import { createAurumSystem } from "./index.js";

function parseArgs(argv) {
  const [, , workflowName = "morningBriefing", fixtureName = "bullishRetest", ...rest] = argv;
  const options = {
    workflowName,
    fixtureName,
    marketMode: undefined,
    symbol: "XAU/USD",
  };

  for (const arg of rest) {
    const [key, value] = arg.replace(/^--/, "").split("=");
    if (key === "marketMode") options.marketMode = value;
    if (key === "symbol") options.symbol = value;
  }

  return options;
}

async function main() {
  const { workflowName, fixtureName, marketMode, symbol } = parseArgs(process.argv);
  const system = createAurumSystem();
  const result = await system.runScenario({ workflowName, fixtureName, marketMode, symbol });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
