import http from "node:http";
import { createAurumSystem } from "./index.js";

const system = createAurumSystem();
const port = Number(process.env.PORT || 3000);

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body, null, 2));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

    if (request.method === "GET" && url.pathname === "/health") {
      return sendJson(response, 200, {
        status: "ok",
        health: system.api.getHealth(),
        fixtures: Object.keys(system.fixtures),
      });
    }

    if (request.method === "GET" && url.pathname === "/agents") {
      return sendJson(response, 200, system.api.listAgents());
    }

    if (request.method === "GET" && url.pathname === "/workflows") {
      return sendJson(response, 200, system.api.listWorkflows());
    }

    if (request.method === "GET" && url.pathname === "/fixtures") {
      return sendJson(response, 200, Object.values(system.fixtures).map((fixture) => ({
        name: fixture.name,
        description: fixture.description,
      })));
    }

    if (request.method === "POST" && url.pathname === "/run") {
      const payload = await readJson(request);
      const result = await system.runScenario(payload || {});
      return sendJson(response, 200, result);
    }

    return sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    return sendJson(response, 500, {
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

server.listen(port, () => {
  process.stdout.write(`Aurum Intelligence server listening on http://localhost:${port}\n`);
});
