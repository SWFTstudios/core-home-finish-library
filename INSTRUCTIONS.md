# Instructions — active work

> **Project book:** [docs/README.md](docs/README.md) — purpose, setup, API, and workflow.  
> Read [01 — Purpose](docs/01-purpose.md) before substantive changes.

---

## Active to-do items

### Done (May 2026)

- [x] Project scaffold (Worker, D1 schema, static UI)
- [x] Project book documentation (`docs/`)
- [x] Rebuild UI to match Figma `SS` screen — `/configurator/` + factory xlsx import ([finish-catalog-import.md](docs/finish-catalog-import.md))
- [x] **Phase 1 Pages:** configurator live at [core-home-finish-library.pages.dev](https://core-home-finish-library.pages.dev/)
- [x] Static catalog fallback (`public/api/catalog`) for Pages without remote D1
- [x] HUD layout: specs card, finish wheel, search/filters, graphic shelf, 3D preview
- [x] `STATIC_ASSETS` binding rename (Pages reserves `ASSETS`)
- [x] `_redirects` (`/` → `/configurator/`), `_headers` for `/api/catalog` JSON

### Open — infrastructure (WD / IT)

- [ ] Create remote D1: `npm run db:create` → update `database_id` in `wrangler.jsonc`
- [ ] Apply remote schema: `npm run db:migrate`
- [ ] Create R2 bucket `render-portal-files` in Cloudflare
- [ ] Configure Cloudflare Access + seed `profiles` for real team emails
- [ ] **Phase 2 Worker:** Production deploy `npm run deploy` (replace static catalog with live D1 API)
- [ ] CI (lint / `wrangler check`) when pipeline is needed

### Open — design & data (GD / WD)

- [ ] Connect Figma MCP (`.cursor/mcp.json`) and sync finishes from the GD team's Figma library
- [ ] Replace Three.js cube with product GLTF mesh
- [ ] Ceramic / Glass / Plastic full customization paths (SS is primary today)
- [ ] Render request builder wired to production D1

---

## Workflow (summary)

| Topic | Chapter · section |
|-------|-------------------|
| Version-control bible (Git, teams, golden rules) | [09 — Development workflow](docs/09-development-workflow.md) |
| What shipped in the configurator sprint | [09 — Sprint narrative](docs/09-development-workflow.md#configurator-sprint--what-shipped-may-2026) |
| Replay guide (how this repo should be branched/PR'd) | [09 — Replay guide](docs/09-development-workflow.md#replay-guide--how-this-repo-should-have-been-versioned) |
| PRs with Figma + screenshots | [09 — Pull requests](docs/09-development-workflow.md#pull-requests--engineering--design-contract) |
| Roadmap and Figma/code gap | [10 — Roadmap and status](docs/10-roadmap-and-status.md) |

---

## Links

- Repository: https://github.com/SWFTstudios/core-home-finish-library
- Live configurator: https://core-home-finish-library.pages.dev/configurator/
- Figma: https://www.figma.com/design/XY8ZVNYLrbK6OMVWNNqSBt/InteractiveFinishLibrary_COPY
