# Aurum Intelligence Installation Guide

This guide is written for non-developers.

## What This Project Is

Aurum Intelligence is a local gold-market analysis system for `XAU/USD`.

It includes:

- a coordinator agent
- technical-analysis agents
- fundamental-analysis agents
- signal-construction and risk agents
- a local HTTP server
- an offline demo mode using built-in fixtures

## What You Need

- A Windows computer
- Node.js version 22 or newer

## Step 1: Install Node.js

1. Open [https://nodejs.org](https://nodejs.org)
2. Download the current LTS version
3. Install it with the default options
4. After install, restart your terminal if one was open

## Step 2: Get the Project Files

You can get the project in either of these ways:

- Download the ZIP from GitHub after the repo is published
- Copy the full project folder to your computer
- Clone it with Git if you know how

## Step 3: Open the Project Folder

The folder should contain files such as:

- `README.md`
- `INSTALL.md`
- `package.json`
- `src/`
- `fixtures/`
- `test/`

## Step 4: Run the Demo

### Easiest option

Double-click:

- [run-aurum-demo.bat](C:\Users\user\Documents\Playground\run-aurum-demo.bat)

This runs a sample gold analysis in the terminal.

### Terminal option

Open a terminal in the project folder and run:

```powershell
node src/cli.js morningBriefing bullishRetest
```

## Step 5: Run the Local Server

### Easiest option

Double-click:

- [start-aurum-server.bat](C:\Users\user\Documents\Playground\start-aurum-server.bat)

### Terminal option

```powershell
node src/server.js
```

When the server starts, it will listen on:

- `http://localhost:3000`

## Step 6: Check That It Works

Open these in your browser:

- `http://localhost:3000/health`
- `http://localhost:3000/workflows`
- `http://localhost:3000/agents`
- `http://localhost:3000/fixtures`

## Step 7: Run an Analysis Through the Server

Use a tool such as Postman, Insomnia, or a terminal request.

Example request:

```json
{
  "workflowName": "morningBriefing",
  "fixtureName": "bullishRetest"
}
```

Post it to:

- `http://localhost:3000/run`

## What the Current Version Uses

The current version uses built-in offline fixture data.

That means:

- it works immediately
- it does not need API keys yet
- it is safe for local demos and validation
- real market API integration can be added later

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

## Important Note

This system is decision-support software. It is not guaranteed financial advice and it does not guarantee winning trades.
