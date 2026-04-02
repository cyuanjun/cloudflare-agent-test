# Cloudflare FPL Agent MVP

Minimal Cloudflare Workers app that:
- accepts `user_profile.json` and `user_preferences.json`
- builds a shared cached Fantasy Premier League dataset
- derives deterministic ranking features once for all runs
- ranks players using the weighting model from the reference repo
- optimizes a legal 15-man FPL squad
- returns results to a small upload UI through async polling

## Stack
- Cloudflare Workers
- Durable Objects
- TypeScript
- Vitest

## Project Structure
```text
src/
  agent/
    RunAgent.ts
  domain/
    contracts.ts
    schemas.ts
    fplClient.ts
    features.ts
    ranking.ts
    squadOptimizer.ts
    pipeline.ts
    templates.ts
  ui/
    page.ts
  index.ts

test/
  fixtures/
  *.test.ts
```

## How It Works
1. Open the Worker frontend at `/`.
2. Upload `user_profile.json` and `user_preferences.json`.
3. The browser parses both files locally and then posts them to `POST /api/runs`.
4. The Worker creates a run id and a dedicated `RunAgent` Durable Object instance.
5. The `RunAgent` reads the shared cached dataset, ranks players, and solves the optimal squad.
6. The frontend polls `GET /api/runs/:id` until the run completes or fails.
7. Results are displayed in the browser.

Shared dataset flow:
1. Open `/data` to inspect the current shared dataset.
2. Click refresh to rebuild the shared dataset manually, or let the cron trigger refresh it every 6 hours.
3. The refresh path fetches FPL raw data and stores one derived dataset for all future runs.

## Input Files
The app keeps the same top-level JSON shapes as your reference repo:
- `user_profile.json`
- `user_preferences.json`

Sample downloads are exposed at:
- `/api/templates/user_profile.json`
- `/api/templates/user_preferences.json`

## Local Development
1. Install dependencies:
```bash
npm install
```
2. Copy `.dev.vars.example` to `.dev.vars` if you want to override the FPL base URL.
3. Start the local dev server:
```bash
npm run dev
```
4. Open the local Wrangler URL and upload the JSON files.

## Tests
Run unit and route tests:
```bash
npm test
```

Run the type checker:
```bash
npm run typecheck
```

## Deploy
```bash
npm run deploy
```

## Notes
- v1 only supports fresh 15-man squad generation.
- There is no transfer planner, captaincy, lineup optimizer, or LLM reasoning flow yet.
- One Durable Object instance is created per run, so the architecture already supports multiple concurrent runs in the future.
- A singleton `SharedDataset` Durable Object now owns the expensive FPL ingestion work, so user runs no longer fan out across all player histories.
