import { createAuditTrail } from "./audit.js";
import { createLogger } from "./logging.js";
import { createAgentRegistry } from "./agent-registry.js";
import { createWorkflowContext, createStageResult } from "./contracts.js";
import { WorkflowError, AgentError } from "./errors.js";
import { assert, assertObject, assertString, safeJsonClone, validateStageList } from "./validation.js";
import { validateWorkflowDefinition } from "./policy.js";

function nowIso() {
  return new Date().toISOString();
}

function makeWorkflowId() {
  return `wf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createOrchestrator({
  logger = createLogger(),
  audit = createAuditTrail({ logger }),
  agentRegistry = createAgentRegistry(),
  prompts = null,
  providers = null,
} = {}) {
  async function runAgent(agentName, context) {
    const agent = agentRegistry.get(agentName);
    const startedAt = nowIso();
    audit.record("agent.start", { agentName, workflowId: context.workflowId, startedAt });
    try {
      const result = await agent.run(context, {
        logger,
        audit,
        registry: agentRegistry,
        prompts,
        providers,
      });
      assertObject(result, `agent result for ${agentName}`);
      assertString(result.status, `agent result for ${agentName}.status`);
      const output = {
        agentName,
        status: result.status,
        summary: result.summary || "",
        evidence: Array.isArray(result.evidence) ? safeJsonClone(result.evidence) : [],
        confidence: Number.isFinite(result.confidence) ? result.confidence : 0,
        metadata: result.metadata ? safeJsonClone(result.metadata) : {},
      };
      audit.record("agent.complete", {
        agentName,
        workflowId: context.workflowId,
        status: output.status,
        confidence: output.confidence,
      });
      return output;
    } catch (error) {
      const wrapped = error instanceof AgentError ? error : new AgentError(`Agent failed: ${agentName}`, { cause: error });
      audit.record("agent.error", {
        agentName,
        workflowId: context.workflowId,
        message: wrapped.message,
        code: wrapped.code,
      });
      throw wrapped;
    }
  }

  async function runWorkflow(definition, input = {}) {
    try {
      validateWorkflowDefinition(definition);
      const workflowId = input.workflowId || makeWorkflowId();
      const context = createWorkflowContext({
        workflowId,
        userRequest: input.userRequest || {},
        profile: input.profile || {},
        runtime: input.runtime || {},
        metadata: {
          workflowName: definition.name,
          createdAt: nowIso(),
          ...safeJsonClone(input.metadata || {}),
        },
      });

      const result = {
        workflowId,
        workflowName: definition.name,
        status: "running",
        stages: [],
        outputs: [],
        context,
      };

      audit.record("workflow.start", { workflowId, workflowName: definition.name });
      logger.info("workflow.start", { workflowId, workflowName: definition.name });

      for (const stage of definition.stages) {
        const stageResult = await runStage(stage, context);
        result.stages.push(stageResult);
        result.outputs.push(...stageResult.outputs);

        if (stageResult.status === "failed" && stage.stopOnFailure !== false) {
          result.status = "failed";
          audit.record("workflow.failed", {
            workflowId,
            workflowName: definition.name,
            stageName: stage.name,
          });
          logger.warn("workflow.failed", { workflowId, workflowName: definition.name, stageName: stage.name });
          return result;
        }
      }

      result.status = "completed";
      audit.record("workflow.complete", { workflowId, workflowName: definition.name });
      logger.info("workflow.complete", { workflowId, workflowName: definition.name });
      return result;
    } catch (error) {
      const wrapped = error instanceof WorkflowError ? error : new WorkflowError("Workflow execution failed", { cause: error });
      logger.error("workflow.error", { workflowName: definition?.name || "unknown", message: wrapped.message, code: wrapped.code });
      audit.record("workflow.error", {
        workflowName: definition?.name || "unknown",
        message: wrapped.message,
        code: wrapped.code,
      });
      return {
        workflowId: input.workflowId || makeWorkflowId(),
        workflowName: definition?.name || "unknown",
        status: "failed",
        error: {
          name: wrapped.name,
          message: wrapped.message,
          code: wrapped.code,
          details: wrapped.details || null,
        },
        stages: [],
        outputs: [],
        context: null,
      };
    }
  }

  async function runStage(stage, context) {
    assertObject(stage, "stage");
    assertString(stage.name, "stage.name");
    validateStageList([stage]);
    const stageContext = {
      ...context,
      stageName: stage.name,
      stageMetadata: safeJsonClone(stage.metadata || {}),
    };
    const outputs = [];
    const notes = [];
    let status = "completed";
    let error = null;

    audit.record("stage.start", {
      workflowId: context.workflowId,
      stageName: stage.name,
      agentNames: stage.agentNames,
    });

    for (const agentName of stage.agentNames) {
      try {
        const agentOutput = await runAgent(agentName, stageContext);
        outputs.push(agentOutput);
        if (agentOutput.summary) {
          notes.push({ agentName, summary: agentOutput.summary });
        }
        if (agentOutput.status === "rejected") {
          status = "failed";
          error = new WorkflowError(`Stage rejected by agent ${agentName}`, { stageName: stage.name, agentName });
          if (stage.stopOnReject !== false) {
            break;
          }
        }
      } catch (agentError) {
        status = "failed";
        error = agentError instanceof WorkflowError ? agentError : new WorkflowError(`Stage failed: ${stage.name}`, {
          stageName: stage.name,
          cause: agentError,
        });
        notes.push({ agentName, error: error.message });
        if (stage.stopOnFailure !== false) {
          break;
        }
      }
    }

    const stageResult = createStageResult({
      stageName: stage.name,
      status,
      outputs,
      notes,
      error,
    });

    audit.record("stage.complete", {
      workflowId: context.workflowId,
      stageName: stage.name,
      status,
    });

    return stageResult;
  }

  function registerAgent(agentDefinition) {
    return agentRegistry.register(agentDefinition);
  }

  return {
    logger,
    audit,
    agentRegistry,
    registerAgent,
    runWorkflow,
    runAgent,
    nowIso,
  };
}
