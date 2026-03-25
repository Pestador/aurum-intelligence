# Security and API Key Handling

## Never Commit Real Keys

Use environment variables for secrets:
- `ALPHAVANTAGE_KEY`
- `OPENAI_API_KEY`

Do not place real keys in:
- source code
- committed `.env` files
- screenshots
- issue comments or pull requests

## Safe Local Setup

1. Copy `.env.example` to `.env`.
2. Fill in your keys locally.
3. Keep `.env` private.

## Current Git Ignore Rules

The repository ignores:
- `.env`
- `.env.*`
- `.env.local`
- `.env.*.local`

And keeps:
- `.env.example`

## Rotation Guidance

If a key is exposed:
1. Revoke it at the provider immediately.
2. Generate a new key.
3. Replace the local environment value.
4. Check git history for leaked value before pushing.

## Public Deployment Warning

This project runs a local server with no authentication by default.  
Do not expose it directly to the public internet without:
- authentication
- TLS
- network restrictions
- rate limiting
- secrets vault or equivalent
