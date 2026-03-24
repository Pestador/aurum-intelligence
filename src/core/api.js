import { assertObject, assertString } from "./validation.js";
import { WorkflowError } from "./errors.js";

export function createAurumApi(runtime) {
  assertObject(runtime, "runtime");
  const workflows = runtime.workflows || {};

  function listAgents() {
    return runtime.agentRegistry.list();
  }

  function listWorkflows() {
    return Object.keys(workflows).map((key) => ({
      key,
      name: workflows[key]?.name || key,
      stageCount: Array.isArray(workflows[key]?.stages) ? workflows[key].stages.length : 0,
    }));
  }

  function listPrompts() {
    return runtime.prompts.list();
  }

  function resolveWorkflow(workflowName) {
    assertString(workflowName, "workflowName");
    const workflow = workflows[workflowName];
    if (!workflow) {
      throw new WorkflowError(`Unknown workflow: ${workflowName}`, { workflowName });
    }
    return workflow;
  }

  async function runNamedWorkflow(workflowName, input = {}) {
    const workflow = resolveWorkflow(workflowName);
    return runtime.runWorkflow(workflow, input);
  }

  function getHealth() {
    return {
      agents: listAgents().length,
      workflows: listWorkflows().length,
      prompts: listPrompts().length,
      providers: Object.keys(runtime.providers || {}).length,
    };
  }

  return {
    listAgents,
    listWorkflows,
    listPrompts,
    resolveWorkflow,
    runNamedWorkflow,
    getHealth,
  };
}
