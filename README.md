# Aurum Intelligence

Aurum Intelligence is a dependency-light, self-hostable, multi-agent gold trading intelligence system focused on `XAU/USD`.

This repository implements:

- A coordinator/orchestrator that dispatches staged workflows to specialist agents
- Technical analysis agents for structure, triggers, liquidity, and momentum/session conditions
- Fundamental analysis agents for macro context, rates/USD/yields, event risk, and intermarket context
- Signal-construction agents for confluence scoring, precision trade building, risk qualification, critic review, execution planning, and reporting
- Provider abstractions and mock fixtures so the system can run offline without external API keys

## Goals

- Produce selective, well-qualified trade ideas
- Produce explicit no-trade outcomes when conditions are not strong enough
- Keep analysis traceable and auditable
- Support future real provider and model integrations without rewriting the core runtime

## Scripts

- `npm run start` runs the CLI with fixture-backed analysis
- `npm run server` runs a small HTTP server
- `npm test` runs the built-in Node test suite

If PowerShell blocks `npm`, use `cmd /c npm run start` or `cmd /c npm test`.

## Non-Developer Install

You do **not** need to install any npm packages for the current version of this project.

What you need:

- Windows
- Node.js 22 or newer installed

How to run it:

1. Download or clone the project folder.
2. Open the folder.
3. Double-click [run-aurum-demo.bat](run-aurum-demo.bat) for a demo analysis in the terminal.
4. Double-click [start-aurum-server.bat](start-aurum-server.bat) to start the local server.
5. Once the server is running, open `http://localhost:3000/health` in your browser to confirm it is working.

If you prefer terminal commands:

- `node src/cli.js morningBriefing bullishRetest`
- `node src/cli.js tradeValidation eventBlocked`
- `node src/server.js`

Full step-by-step setup is in [INSTALL.md](INSTALL.md).

## Quick Start

- `node src/cli.js morningBriefing bullishRetest`
- `node src/cli.js tradeValidation eventBlocked`
- `node src/server.js`

HTTP endpoints:

- `GET /health`
- `GET /agents`
- `GET /workflows`
- `GET /fixtures`
- `POST /run`

Example `POST /run` body:

```json
{
  "workflowName": "morningBriefing",
  "fixtureName": "bullishRetest"
}
```

## Architecture

The high-level pipeline is:

1. Load workflow request and market snapshot
2. Validate data integrity
3. Run technical and fundamental specialist agents
4. Synthesize regime and confluence
5. Construct a precision trade candidate or no-trade state
6. Run risk qualification and critic review
7. Generate execution guidance and a user-facing report

## Project Layout

- `src/core/` runtime orchestration, workflow helpers, validation, logging
- `src/providers/` provider abstractions and mock data providers
- `src/prompts/` coordinator and specialist agent prompt/personality definitions
- `src/agents/technical/` technical analysis specialists
- `src/agents/fundamental/` macro and contextual specialists
- `src/agents/signal/` confluence, trade construction, risk, and critic agents
- `src/agents/reporting/` report generation and presentation agents
- `src/domain/` shared analytical helpers
- `fixtures/` deterministic snapshots for offline execution and testing
- `test/` integration and workflow tests

## Safety Notes

- The system is designed for decision support, not guaranteed outcomes.
- It prefers no-trade over low-quality trade construction.
- Event risk and unresolved contradictions should suppress signals rather than produce forced conviction.

## GitHub Publishing

This repo is ready to be published, but there is currently no GitHub remote connected in this workspace.

Use [GITHUB_SETUP.md](GITHUB_SETUP.md) for a plain-English guide to:

- create a GitHub repository
- connect this local repo to GitHub
- push the code
- publish the documentation
