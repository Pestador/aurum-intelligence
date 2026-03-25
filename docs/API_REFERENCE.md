# Aurum Intelligence API Reference

Base URL (local default): `http://localhost:3000`

## GET `/health`
Returns app health and capability summary.

Example response fields:
- `status`
- `mode`
- `health`
- `runtime`
- `vision`
- `fixtures`

## GET `/status`
Returns runtime status plus latest vision state.

Example response fields:
- `status`
- `mode`
- `runtime`
- `vision`
- `latestVision`

## GET `/agents`
Lists registered agents.

## GET `/workflows`
Lists available workflows.

## GET `/fixtures`
Lists fixture scenarios.

## POST `/run`
Runs the API-only workflow pipeline.

Example request:

```json
{
  "workflowName": "intradayScan",
  "fixtureName": "bullishRetest",
  "marketMode": "fixture",
  "symbol": "XAU/USD"
}
```

Example response fields:
- `workflow`
- `finalState`
- `telemetry`
  - `auditTrail`
- `operation`

## GET `/vision/latest`
Returns latest chart-capture or monitor result.

Example response fields:
- `status`
- `latest`
- `imageUrl`
- `message`

## POST `/vision/capture`
Captures a single TradingView chart and optionally analyzes it.

Example request:

```json
{
  "symbol": "XAUUSD",
  "analyze": true
}
```

Example response fields:
- `status`
- `result`
- `imageUrl`
- `source`
- `message`
- `operation`

## POST `/vision/monitor`
Runs multi-timeframe capture + per-timeframe analysis.

Default timeframe set: `["1","5","15","60","240"]`.

Example request:

```json
{
  "symbol": "XAUUSD",
  "timeframes": ["1", "5", "15", "60", "240"],
  "cycles": 1,
  "cycleDelayMs": 0,
  "analyze": true,
  "headless": true,
  "waitMs": 2500,
  "exchange": "OANDA"
}
```

Example response fields:
- `status`
- `monitor`
  - `cycles`
  - `latestCycle`
  - `aggregate`
- `operation`

## POST `/decision/merged`
Runs:
1. API workflow (`/run` equivalent)
2. Vision monitor (`/vision/monitor` equivalent)
3. Coordinator merge decision

Example request:

```json
{
  "workflowName": "intradayScan",
  "fixtureName": "bullishRetest",
  "marketMode": "live",
  "symbol": "XAU/USD",
  "timeframes": ["1", "5", "15", "60", "240"],
  "cycles": 1,
  "cycleDelayMs": 0,
  "analyze": true,
  "headless": true,
  "waitMs": 2500,
  "exchange": "OANDA"
}
```

Example response fields:
- `status`
- `merged`
  - `finalStatus`
  - `mergedConfidence`
  - `api`
  - `apiQuality`
  - `vision`
  - `fallback`
  - `signal`
  - `alignment`
  - `reasons`
  - `summary`
- `api`
- `vision`
- `operation`

## GET `/operations/history`
Returns recent operation records emitted by the server.

Query params:
- `limit` (optional, default `60`, max `200`)

Example response fields:
- `status`
- `total`
- `items`
  - `id`
  - `ts`
  - `type`
  - `status`
  - `summary`
  - `request`
  - `outcome`

## GET `/screenshots/<file>`
Serves screenshot files from local `screenshots/`.

## Notes
- Endpoints are local and unauthenticated by default.
- Do not expose this server publicly without adding authentication and network controls.
