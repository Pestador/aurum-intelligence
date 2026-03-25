# Aurum Intelligence Installation Guide

This guide is written for non-developers.

## What This Project Is

Aurum Intelligence is a local gold-market intelligence system for `XAU/USD`.

It includes:

- a coordinator agent
- technical-analysis agents
- fundamental-analysis agents
- signal-construction and risk agents
- a local dashboard
- a local HTTP server
- an offline demo mode using built-in fixtures
- optional live gold data
- optional TradingView browser capture
- optional chart-vision analysis
- optional multi-timeframe monitor and merged decision coordinator

## What You Need

- A Windows computer
- Node.js version 22 or newer

## Step 1: Install Node.js

1. Open [https://nodejs.org](https://nodejs.org)
2. Download the current LTS version
3. Install it with the default options
4. Restart your terminal if one was open

## Step 2: Get the Project Files

You can get the project by:

- downloading the ZIP from GitHub
- copying the full project folder
- cloning it with Git if you know how

## Step 3: Open the Project Folder

The folder should contain files such as:

- `README.md`
- `INSTALL.md`
- `package.json`
- `src/`
- `web/`
- `fixtures/`
- `test/`

## Step 4: Run the Offline Demo

### Easiest option

Double-click:

- [run-aurum-demo.bat](C:\Users\user\Documents\Playground\run-aurum-demo.bat)

### Terminal option

```powershell
node src/cli.js morningBriefing bullishRetest
```

## Step 5: Run the Local Dashboard

### Easiest option

Double-click:

- [start-aurum-server.bat](C:\Users\user\Documents\Playground\start-aurum-server.bat)

### Terminal option

```powershell
node src/server.js
```

When the server starts, it listens on:

- `http://localhost:3000`

Open:

- `http://localhost:3000/`

## Step 6: Test That It Works

You can open these in your browser:

- `http://localhost:3000/health`
- `http://localhost:3000/status`
- `http://localhost:3000/workflows`
- `http://localhost:3000/agents`
- `http://localhost:3000/fixtures`

## Step 7: Run an Analysis in the Dashboard

On the dashboard:

1. Pick a market mode:
   - `Fixture` for offline demo data
   - `Live` for real market data if configured
2. Pick a workflow
3. Pick a fixture if you are in fixture mode
4. Leave symbol as `XAU/USD` unless you know you want something else
5. Click `Run`

The result page will show:

- signal status
- report sections
- execution plan
- signal visualization
- raw JSON payload

## Optional: Live Gold Data

If you want the system to use live gold data through Alpha Vantage:

1. Get an Alpha Vantage API key
2. Set these environment variables:

```powershell
$env:AURUM_LIVE="1"
$env:ALPHAVANTAGE_KEY="YOUR_KEY"
```

3. Start the server:

```powershell
node src/server.js
```

Important:

- Live mode is honest about missing coverage.
- If only partial data is available, the dashboard and reports will say coverage is degraded.
- In degraded live mode, the system may prefer `no_trade` rather than pretend it has a strong intraday setup.

## Optional: TradingView Browser Capture

If you want the system to open TradingView and capture charts:

### First-time install

```powershell
cmd /c npm install
npx playwright install chromium
```

### CLI example

```powershell
node src/vision/tradingview.js --symbol=XAUUSD
```

This saves a screenshot under `screenshots/`.

If you want to see the browser window instead of running headless:

```powershell
node src/vision/tradingview.js --symbol=XAUUSD --headless=false
```

For automatic timeframe cycling (`1m`, `5m`, `15m`, `1h`, `4h`):

```powershell
node src/vision/tradingview.js --multi=true --symbol=XAUUSD --timeframes=1,5,15,60,240
```

## Optional: Chart Vision Analysis

If you want the captured chart image to be inspected by a vision model:

1. Set:

```powershell
$env:OPENAI_API_KEY="YOUR_KEY"
```

2. Optional model override:

```powershell
$env:AURUM_VISION_MODEL="gpt-4.1-mini"
```

3. Use the `Capture Chart` button in the dashboard

or call:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/vision/capture -ContentType "application/json" -Body '{"symbol":"XAUUSD"}'
```

For multi-timeframe monitoring plus per-timeframe analysis:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/vision/monitor -ContentType "application/json" -Body '{"symbol":"XAUUSD","timeframes":["1","5","15","60","240"],"cycles":1,"analyze":true}'
```

For one-shot merged final decision (`API + vision`):

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/decision/merged -ContentType "application/json" -Body '{"workflowName":"intradayScan","marketMode":"live","symbol":"XAU/USD","timeframes":["1","5","15","60","240"],"cycles":1,"analyze":true}'
```

## Running Tests

If you want to confirm the project is healthy:

```powershell
cmd /c npm test
```

## Common Problems

### “node is not recognized”

Node.js is not installed correctly, or the terminal was not restarted after install.

### PowerShell blocks npm

Use:

```powershell
cmd /c npm test
```

or:

```powershell
cmd /c npm run server
```

### Browser says localhost is unavailable

The server is not running yet. Start it first with:

```powershell
node src/server.js
```

### TradingView capture fails immediately

You likely still need:

```powershell
cmd /c npm install
npx playwright install chromium
```

### Vision capture returns a screenshot but no analysis

That usually means `OPENAI_API_KEY` is not set. Screenshot capture and vision analysis are separate.

## Important Note

This system is decision-support software. It is not guaranteed financial advice and it does not guarantee winning trades.
