import { createAurumSystem } from "./index.js";

function parseArgs(argv) {
  const [, , workflowName = "morningBriefing", fixtureName = "bullishRetest"] = argv;
  return { workflowName, fixtureName };
}

async function main() {
  const { workflowName, fixtureName } = parseArgs(process.argv);
  const system = createAurumSystem();
  const result = await system.runScenario({ workflowName, fixtureName });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
