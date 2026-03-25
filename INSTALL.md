# Aurum Intelligence Installation Guide

This guide is written for non-developers.

## What This Project Is

Aurum Intelligence is a local gold-market intelligence system for `XAU/USD`.

It includes:
- a coordinator agent
- technical-analysis agents
- fundamental-analysis agents
- signal-construction and risk agents
- a local dashboard and HTTP server
- offline fixture mode
- optional live market mode
- optional TradingView browser capture
- optional chart-vision analysis
- optional multi-timeframe monitor and merged decision coordinator

## What You Need

- Windows
- Node.js `22+`

## Step 1: Install Node.js

1. Open [https://nodejs.org](https://nodejs.org)
2. Install current LTS
3. Restart terminal

## Step 2: Get the Project Files

- Download ZIP from GitHub, or
- clone with Git

## Step 3: Open the Project Folder

You should see:
- `README.md`
- `INSTALL.md`
- `.env.example`
- `package.json`
- `src/`
- `web/`
- `fixtures/`
- `test/`

## Optional: Safe Key Setup with .env

1. Copy `.env.example` to `.env`
2. Put your keys in `.env`
3. Keep `.env` private (it is git-ignored)

Security reference:
- `docs/SECURITY_AND_KEYS.md`

## Step 4: Run Offline Demo

### Easiest
- Double-click [run-aurum-demo.bat](C:\Users\user\Documents\Playground\run-aurum-demo.bat)

### Terminal
```powershell
node src/cli.js morningBriefing bullishRetest
```

## Step 5: Start Dashboard

### Easiest
- Double-click [start-aurum-server.bat](C:\Users\user\Documents\Playground\start-aurum-server.bat)

### Terminal
```powershell
node src/server.js
```

Open:
- `http://localhost:3000/`

## Step 6: Verify App Health

Open:
- `http://localhost:3000/health`
- `http://localhost:3000/status`
- `http://localhost:3000/workflows`
- `http://localhost:3000/agents`
- `http://localhost:3000/fixtures`

## Step 7: Run Analysis

In dashboard:
1. Choose `Fixture` or `Live`
2. Choose workflow
3. Choose fixture (if in fixture mode)
4. Set symbol (`XAU/USD` default)
5. Click `Run`

## Optional: Live Gold Data (Alpha Vantage)

Set env vars:

```powershell
$env:AURUM_LIVE="1"
$env:ALPHAVANTAGE_KEY="YOUR_KEY"
```

Start server:

```powershell
node src/server.js
```

Notes:
- Live mode may be degraded if provider coverage is partial.
- In degraded mode, system may choose `no_trade` instead of forcing signals.

## Optional: TradingView Capture

Install dependencies once:

```powershell
cmd /c npm install
npx playwright install chromium
```

Single capture:

```powershell
node src/vision/tradingview.js --symbol=XAUUSD
```

Visible browser:

```powershell
node src/vision/tradingview.js --symbol=XAUUSD --headless=false
```

Multi-timeframe cycle (`1m/5m/15m/1h/4h`):

```powershell
node src/vision/tradingview.js --multi=true --symbol=XAUUSD --timeframes=1,5,15,60,240
```

## Optional: Vision Analysis + Merged Decision

Set vision key:

```powershell
$env:OPENAI_API_KEY="YOUR_KEY"
```

Optional model:

```powershell
$env:AURUM_VISION_MODEL="gpt-4.1-mini"
```

Single capture + analyze:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/vision/capture -ContentType "application/json" -Body '{"symbol":"XAUUSD"}'
```

Multi-timeframe monitor:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/vision/monitor -ContentType "application/json" -Body '{"symbol":"XAUUSD","timeframes":["1","5","15","60","240"],"cycles":1,"analyze":true}'
```

Final merged decision (`API + vision`):

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/decision/merged -ContentType "application/json" -Body '{"workflowName":"intradayScan","marketMode":"live","symbol":"XAU/USD","timeframes":["1","5","15","60","240"],"cycles":1,"analyze":true}'
```

## Run Tests

```powershell
cmd /c npm test
```

## Common Problems

### "node is not recognized"
Node.js is not installed correctly or terminal was not restarted.

### PowerShell blocks npm
Use:

```powershell
cmd /c npm test
cmd /c npm run server
```

### localhost unavailable
Server is not running. Start with:

```powershell
node src/server.js
```

### TradingView capture fails
Install Playwright dependencies:

```powershell
cmd /c npm install
npx playwright install chromium
```

### Screenshot works but no vision analysis
`OPENAI_API_KEY` is missing or invalid.

## API Reference

See:
- `docs/API_REFERENCE.md`

## Important Note

This is decision-support software, not guaranteed financial advice or guaranteed winning trades.
