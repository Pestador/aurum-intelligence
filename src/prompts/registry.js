import { personas } from "./personas.js";
import { templates } from "./templates.js";
import { assertObject, assertString, safeJsonClone } from "../core/validation.js";

function compilePrompt(template, variables = {}) {
  return String(template).replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = variables[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

export function createPromptRegistry(overrides = {}) {
  const store = {
    personas: safeJsonClone(personas) || {},
    templates: safeJsonClone(templates) || {},
    ...(safeJsonClone(overrides) || {}),
  };

  function get(agentName) {
    assertString(agentName, "agentName");
    const persona = store.personas[agentName] || null;
    const template = store.templates[agentName] || null;
    return {
      agentName,
      persona,
      template,
    };
  }

  function list() {
    return Object.keys(store.personas).map((name) => ({
      agentName: name,
      persona: store.personas[name],
      template: Boolean(store.templates[name]),
    }));
  }

  function render(agentName, variables = {}) {
    assertString(agentName, "agentName");
    assertObject(variables, "variables");
    const entry = get(agentName);
    if (!entry.template) {
      return {
        agentName,
        persona: entry.persona,
        system: "",
        prompt: "",
      };
    }

    return {
      agentName,
      persona: entry.persona,
      system: compilePrompt(entry.template.system || "", variables),
      prompt: compilePrompt(entry.template.prompt || "", variables),
    };
  }

  function register(agentName, value) {
    assertString(agentName, "agentName");
    assertObject(value, "value");
    store.templates[agentName] = value;
    return get(agentName);
  }

  return {
    get,
    list,
    render,
    register,
  };
}
