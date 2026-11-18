# Instructions — active work

> **Project book:** [docs/README.md](docs/README.md) — purpose, setup, API, and workflow.  
> Read [01 — Purpose](docs/01-purpose.md) before substantive changes.

---

## Active to-do items

### Done (May 2026)

- [x] Project scaffold (Worker, D1 schema, static UI)
- [x] Project book documentation (`docs/`)
- [x] Rebuild UI to match Figma `SS` screen — `/configurator/` + factory xlsx import ([finish-catalog-import.md](docs/finish-catalog-import.md))
- [x] **Phase 1 Pages:** configurator live at [core-home-finish-library.elombe.workers.dev](https://core-home-finish-library.elombe.workers.dev/)
- [x] Static catalog fallback (`public/api/catalog`) for Pages without remote D1
- [x] HUD layout: specs card, finish wheel, search/filters, graphic shelf, 3D preview
- [x] `STATIC_ASSETS` binding rename (Pages reserves `ASSETS`)
- [x] `_redirects` (`/` → `/configurator/`), `_headers` for `/api/catalog` JSON

### Open — infrastructure (WD / IT)

- [x] GitHub secret `CLOUDFLARE_ACCOUNT_ID` (set via `gh` — May 2026)
- [ ] GitHub secret `CLOUDFLARE_API_TOKEN` — create in [Cloudflare API tokens](https://dash.cloudflare.com/profile/api-tokens), then `gh secret set CLOUDFLARE_API_TOKEN -R SWFTstudios/core-home-finish-library`
- [ ] Re-run **Deploy Finish Library (Pages)** workflow after both secrets exist
- [ ] Create remote D1: `npm run db:create` → update `database_id` in `wrangler.jsonc`
- [ ] Apply remote schema: `npm run db:migrate`
- [ ] Create R2 bucket `render-portal-files` in Cloudflare
- [ ] Configure Cloudflare Access + seed `profiles` for real team emails
- [ ] **Phase 2 Worker:** Production deploy `npm run deploy` (replace static catalog with live D1 API)
- [ ] CI (lint / `wrangler check`) when pipeline is needed

### Open — design & data (GD / WD)

- [ ] Connect Figma MCP (`.cursor/mcp.json`) and sync finishes from the GD team's Figma library
- [ ] Render request builder wired to production D1

### Catalog + 3D milestones (see project book ch. 11–13)

| ID | Task | Chapter |
|----|------|---------|
| **M2a** | Remote D1 live; `GET /api/catalog?material=` filters finishes by material | [12 — Database](docs/12-database-multi-material.md) Phase 0–1 |
| **M2b** | Multi-tab xlsx import (`Library_Ceramic`, …); enable material tabs in seed | [12](docs/12-database-multi-material.md) Phase 1 |
| **M3** | ~~Replace cube~~ Done as code-built products (Stage 1b); GLB swap when CAD exists | [13 — 3D pipeline](docs/13-3d-preview-pipeline.md) Stage 1b · Stage 2 |
| **M4** | Zone map (`body`, `logo`) + per-zone finishes — preview done; persist to `request_finishes.zone` open | [13](docs/13-3d-preview-pipeline.md) Stage 3 · [12](docs/12-database-multi-material.md) Phase 3 |
| **M5** | R2 GLB upload + admin mesh→zone assignment | [13](docs/13-3d-preview-pipeline.md) Stage 4 |
| **M6** | Graphic decals / textures on logo mesh | [13](docs/13-3d-preview-pipeline.md) · [10 — Roadmap](docs/10-roadmap-and-status.md) |

**Concepts for PD/ID/GD:** [11 — 3D and materials primer](docs/11-3d-materials-primer.md)

### Open — 2D / 3D view toggle (branch `feature/2d-3d-view-toggle`)

Worktree: `../CORE HOME FINISH LIBRARY-3d` (from `feature/3d-product-render`).

- [ ] PD: confirm real height / top and bottom diameter for each hero product → update `PROFILES` in `public/js/product-models-3d.js` (then re-run `npm run shells:export`)
- [ ] GD / PD: review `/render-qa.html` per material; record corrections in `public/data/finish-render-overrides.json`
- [ ] GD / PD: set `reviewStatus` in `data/ai-photos.json` (`approved` / `rejected`) for the 28 AI photos; regenerate rejected ones
- [ ] Re-run `npm run render:colors` whenever factory photos or AI images change
- [ ] Optional: "Render HD still" button (`three-gpu-pathtracer`) for render requests
- [ ] M6: graphic decals on the `logo` patch (UVs are already 0–1 across the patch)

### Related PRs

- Folders / PDF / request detail: [PR #10](https://github.com/SWFTstudios/core-home-finish-library/pull/10) (`feature/folders-and-requests`)
- 3D product render: [PR #9](https://github.com/SWFTstudios/core-home-finish-library/pull/9) (`feature/3d-product-render`) — prefer merging before or with the view-toggle PR

---

## Workflow (summary)

| Topic | Chapter · section |
|-------|-------------------|
| Version-control bible (Git, teams, golden rules) | [09 — Development workflow](docs/09-development-workflow.md) |
| What shipped in the configurator sprint | [09 — Sprint narrative](docs/09-development-workflow.md#configurator-sprint--what-shipped-may-2026) |
| Replay guide (how this repo should be branched/PR'd) | [09 — Replay guide](docs/09-development-workflow.md#replay-guide--how-this-repo-should-have-been-versioned) |
| PRs with Figma + screenshots | [09 — Pull requests](docs/09-development-workflow.md#pull-requests--engineering--design-contract) |
| Roadmap and Figma/code gap | [10 — Roadmap and status](docs/10-roadmap-and-status.md) |
| 3D concepts (meshes vs zones) | [11 — 3D and materials primer](docs/11-3d-materials-primer.md) |
| Multi-material D1 + xlsx tabs | [12 — Database and multi-material](docs/12-database-multi-material.md) |
| GLTF preview and upload stages | [13 — 3D preview pipeline](docs/13-3d-preview-pipeline.md) |

---

## Links

- Repository: https://github.com/SWFTstudios/core-home-finish-library
- Live configurator: https://core-home-finish-library.elombe.workers.dev/configurator/
- Figma: https://www.figma.com/design/XY8ZVNYLrbK6OMVWNNqSBt/InteractiveFinishLibrary_COPY
