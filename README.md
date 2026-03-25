# Aurum Intelligence

Aurum Intelligence is a self-hostable, multi-agent gold trading intelligence system focused on `XAU/USD`.

It includes:

- a coordinator/orchestrator that runs staged workflows
- technical-analysis agents for structure, triggers, liquidity, and momentum/session analysis
- fundamental-analysis agents for macro context, rates/USD/yields, event risk, and intermarket context
- signal-construction agents for confluence, precision entries, risk qualification, critic review, execution planning, and reporting
- a local dashboard and HTTP API
- fixture-backed offline scenarios
- optional live gold data support
- optional TradingView browser capture and chart-vision analysis

## What You Can Do Right Now

- Run the system fully offline with built-in scenarios
- Open a local dashboard at `http://localhost:3000/`
- Switch between fixture mode and live mode from the dashboard
- Capture a TradingView chart screenshot from the dashboard or CLI
- Run automatic timeframe cycling (`1m`, `5m`, `15m`, `1h`, `4h`)
- Get per-timeframe vision analysis and a merged final decision (`API + vision`)
- Optionally send captured charts to a vision model if `OPENAI_API_KEY` is configured

## Quick Start

### Option 1: easiest

- Double-click [run-aurum-demo.bat](run-aurum-demo.bat)
- Double-click [start-aurum-server.bat](start-aurum-server.bat)
- Open `http://localhost:3000/`

### Option 2: terminal

- `node src/cli.js morningBriefing bullishRetest`
- `node src/server.js`

## Secrets and Keys

- Never hardcode keys in source files.
- Use environment variables or a local `.env` file.
- Start from [.env.example](.env.example).

Required for live mode:
- `ALPHAVANTAGE_KEY`

Required for optional vision analysis:
- `OPENAI_API_KEY`

Security details:
- [docs/SECURITY_AND_KEYS.md](docs/SECURITY_AND_KEYS.md)

## Dashboard

Start the server:

```powershell
node src/server.js
```

Then open:

- `http://localhost:3000/`

The dashboard now includes:

- runtime snapshot and provider state
- workflow runner
- fixture/live mode selector
- symbol input
- TradingView chart capture
- automatic multi-timeframe monitor
- merged decision coordinator output
- signal visualization for entry, stop, targets, and key levels
- full report, execution plan, and raw JSON

## HTTP API

- `GET /health`
- `GET /status`
- `GET /agents`
- `GET /workflows`
- `GET /fixtures`
- `POST /run`
- `GET /vision/latest`
- `POST /vision/capture`
- `POST /vision/monitor`
- `POST /decision/merged`
- `GET /screenshots/<file>`

Full endpoint docs:
- [docs/API_REFERENCE.md](docs/API_REFERENCE.md)

Example `POST /run` body:

```json
{
  "workflowName": "morningBriefing",
  "fixtureName": "bullishRetest",
  "marketMode": "fixture",
  "symbol": "XAU/USD"
}
```

## Live Gold Data

The system can use Alpha Vantage as a live gold provider.

Set:

- `AURUM_LIVE=1`
- `ALPHAVANTAGE_KEY=YOUR_KEY`

Then run:

```powershell
node src/server.js
```

Current live coverage:

- live gold spot quote via Alpha Vantage commodities API
- daily gold history when available
- optional intraday coverage if Alpha Vantage returns intraday data for your plan

Important:

- If only partial live data is available, the system stays honest and marks coverage as degraded.
- In degraded live mode, the report may prefer `no_trade` rather than pretend to have a strong intraday signal.

## TradingView Browser Control and Vision

### 1. Install optional browser automation dependencies

```powershell
cmd /c npm install
npx playwright install chromium
```

### 2. Capture a TradingView chart from the CLI

```powershell
node src/vision/tradingview.js --symbol=XAUUSD
```

This saves a screenshot under `screenshots/`.

Useful options:

- `--headless=false` to open a visible browser window
- `--exchange=OANDA` to change the TradingView symbol prefix
- `--output=screenshots/my-chart.png` to choose the output file
- `--timeframe=15` for a single timeframe
- `--multi=true --timeframes=1,5,15,60,240` for automatic multi-timeframe cycling

### 3. Multi-timeframe monitor API

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/vision/monitor -ContentType "application/json" -Body '{"symbol":"XAUUSD","timeframes":["1","5","15","60","240"],"cycles":1,"analyze":true}'
```

### 4. Merged decision API (`API + chart vision`)

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/decision/merged -ContentType "application/json" -Body '{"workflowName":"intradayScan","marketMode":"live","symbol":"XAU/USD","timeframes":["1","5","15","60","240"],"cycles":1,"analyze":true}'
```

### 5. Optional chart-vision analysis

If you want the system to inspect the captured chart image with a vision model, set:

- `OPENAI_API_KEY=YOUR_KEY`
- optional `AURUM_VISION_MODEL=gpt-4.1-mini`

Then use the dashboard capture button or call:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/vision/capture -ContentType "application/json" -Body '{"symbol":"XAUUSD"}'
```

The server will:

- open TradingView through Playwright
- capture a screenshot
- save it under `screenshots/`
- optionally send the image to the configured vision model

## Scripts

- `npm run start`
- `npm run server`
- `npm run vision:capture`
- `npm run vision:monitor`
- `npm test`

If PowerShell blocks `npm`, use:

- `cmd /c npm run server`
- `cmd /c npm test`

## Install Guide

Plain-English setup instructions are in [INSTALL.md](INSTALL.md).

## Documentation Index

- [INSTALL.md](INSTALL.md)
- [docs/API_REFERENCE.md](docs/API_REFERENCE.md)
- [docs/SECURITY_AND_KEYS.md](docs/SECURITY_AND_KEYS.md)
- [GITHUB_SETUP.md](GITHUB_SETUP.md)

## Project Layout

- `src/core/` runtime orchestration and workflow execution
- `src/providers/` fixture and live market providers
- `src/agents/technical/` technical-analysis specialists
- `src/agents/fundamental/` macro and contextual specialists
- `src/agents/signal/` confluence, trade construction, risk, and critic agents
- `src/agents/reporting/` trader-facing reports
- `src/vision/` TradingView capture and optional vision-model analysis
- `web/` local dashboard
- `fixtures/` offline scenarios
- `test/` test suite

## Safety Notes

- This is decision-support software, not guaranteed financial advice.
- The system is designed to prefer no-trade over weak trade construction.
- Event risk, contradictory evidence, or degraded live coverage should reduce or suppress signal quality.

## GitHub

Publishing instructions are in [GITHUB_SETUP.md](GITHUB_SETUP.md).
