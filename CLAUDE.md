# CLAUDE.md

## Development Commands

All commands run from `cf_assignment/`:

```sh
npm run dev          # Local dev server (wrangler dev) → http://localhost:8787
npm run deploy       # Deploy to Cloudflare
npx wrangler types   # Regenerate types after changing bindings in wrangler.jsonc
```

## Project Overview

Feedback intelligence pipeline built on Cloudflare. Consolidates feedback from multiple sources, classifies it with Workers AI, stores structured results in D1, and uses Durable Objects for real-time theme aggregation.

**"Importance"** = theme frequency + negative sentiment + urgency.

### Architecture

| Layer | Service | Role |
|-------|---------|------|
| Compute | Workers | API routing (`POST /feedback`, `GET /summary`) |
| Classification | Workers AI | Derive theme, sentiment, urgency, summary from raw text |
| Storage | D1 | Persist structured feedback (text, source metadata, AI-derived fields) |
| Aggregation | Durable Objects | Real-time theme counts for low-latency summary reads |

### Planned API Endpoints

- **POST /feedback** — Ingest raw feedback; Workers AI classifies on ingestion (tradeoff: slower intake, but data is queryable immediately).
- **GET /summary** — Return prioritized feedback summary, ranked by importance.

## Current Bindings (wrangler.jsonc)

- `MY_DURABLE_OBJECT` — Durable Object namespace (class: `MyDurableObject`, SQLite-backed)
- D1 and Workers AI bindings are **not yet configured** — add them to wrangler.jsonc as the pipeline is built out.
- Compatibility flag: `nodejs_compat`

## Code Style

From `.prettierrc` / `.editorconfig`:

- Tabs for indentation (no spaces)
- Single quotes, semicolons required
- Print width: 140
- LF line endings, UTF-8, trim trailing whitespace, final newline
- YAML files use spaces for indentation

## Cloudflare Docs — Always Check Fresh

Your knowledge of Cloudflare APIs may be outdated. Before any Workers, D1, Durable Objects, or Workers AI task, retrieve current docs:

- Workers: https://developers.cloudflare.com/workers/
- D1: https://developers.cloudflare.com/d1/
- Durable Objects: https://developers.cloudflare.com/durable-objects/
- Workers AI: https://developers.cloudflare.com/workers-ai/
- Limits: check each product's `/platform/limits/` page
- Errors: https://developers.cloudflare.com/workers/observability/errors/

Run `npx wrangler types` after changing any bindings.

## Key Files

- `cf_assignment/src/index.js` — Worker entry point + Durable Object class
- `cf_assignment/wrangler.jsonc` — Cloudflare bindings and config
- `cf_assignment/AGENTS.md` — Cloudflare-specific agent guidance
