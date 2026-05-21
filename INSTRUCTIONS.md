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
- [ ] Connect Figma MCP (`.cursor/mcp.json`) and sync finishes from the GD team's Figma library
- [x] Rebuild UI to match Figma `SS` screen — `/configurator.html` + factory xlsx import (see [finish-catalog-import.md](docs/finish-catalog-import.md))
- [ ] **Phase 1 Pages:** GitHub secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` → push `main` or `npm run pages:deploy`
- [ ] **Phase 2 Worker:** Production deploy `npm run deploy` (enable `deploy-worker.yml` when D1/R2 ready)
- [ ] CI (lint / `wrangler check`) when pipeline is needed

---

## Workflow (summary)

| Topic | Chapter · section |
|-------|-------------------|
| Version-control bible (Git, teams, golden rules) | [09 — Development workflow](docs/09-development-workflow.md) |
| Replay guide (how this repo should be branched/PR’d) | [09 — Replay guide](docs/09-development-workflow.md#replay-guide--how-this-repo-should-have-been-versioned) |
| PRs with Figma + screenshots | [09 — Pull requests](docs/09-development-workflow.md#pull-requests--engineering--design-contract) |
| Cleaning up local work before push | [09 — Cleaning up](docs/09-development-workflow.md#cleaning-up-uncommitted-work-today) |
| Roadmap and Figma/code gap | [10 — Roadmap and status](docs/10-roadmap-and-status.md) |

---

## Links

- Repository: https://github.com/SWFTstudios/core-home-finish-library
- Figma: https://www.figma.com/design/XY8ZVNYLrbK6OMVWNNqSBt/InteractiveFinishLibrary_COPY
