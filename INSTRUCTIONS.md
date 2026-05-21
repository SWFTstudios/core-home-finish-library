# Instructions — active work

> **Project book:** [docs/README.md](docs/README.md) — purpose, setup, API, and workflow.  
> Read [01 — Purpose](docs/01-purpose.md) before substantive changes.

---

## Active to-do items

- [x] Project scaffold (Worker, D1 schema, static UI)
- [x] Project book documentation (`docs/`)
- [ ] Create remote D1: `npm run db:create` → update `database_id` in `wrangler.jsonc`
- [ ] Apply remote schema: `npm run db:migrate`
- [ ] Create R2 bucket `render-portal-files` in Cloudflare
- [ ] Configure Cloudflare Access + seed `profiles` for real team emails
- [ ] Connect Figma MCP (`.cursor/mcp.json`) and sync finishes from Maria's library
- [ ] Rebuild UI to match Figma `SS` screen (see [03 — Design and Figma](docs/03-design-and-figma.md))
- [ ] Production deploy: `npm run deploy`
- [ ] CI (lint / `wrangler check`) when pipeline is needed

---

## Workflow (summary)

| Topic | Chapter |
|-------|---------|
| Git, commits, PRs, definition of done | [09 — Development workflow](docs/09-development-workflow.md) |
| Roadmap and Figma/code gap | [10 — Roadmap and status](docs/10-roadmap-and-status.md) |

---

## Links

- Repository: https://github.com/SWFTstudios/core-home-finish-library
- Figma: https://www.figma.com/design/XY8ZVNYLrbK6OMVWNNqSBt/InteractiveFinishLibrary_COPY
