# Chapter 10 — Roadmap and status

[← 09 — Development workflow](09-development-workflow.md) · [Project book](README.md) · **Next:** [11 — 3D and materials primer →](11-3d-materials-primer.md)

**Plain language summary:** The Finish Library configurator is live on the web; the render-request dashboard and company login are the next infrastructure steps.

---

## Current phase

**Phase 1 complete — Finish Library configurator live** (May 2026)

| Live now | URL |
|----------|-----|
| Configurator | [https://core-home-finish-library.pages.dev/configurator/](https://core-home-finish-library.pages.dev/configurator/) |

**Phase 2 in planning:** Worker production deploy, remote D1, R2 uploads, Cloudflare Access for real team emails.

Track day-to-day tasks in [`INSTRUCTIONS.md`](../INSTRUCTIONS.md).

---

## Completed

### Foundation

- [x] GitHub repository and `main` branch  
- [x] Cursor project rules (`.cursorrules`, `.cursor/rules/`)  
- [x] Project book documentation (`docs/`)  
- [x] Worker API scaffold ([`src/index.ts`](../src/index.ts))  
- [x] D1 schema ([`schema.sql`](../schema.sql)) and local seed ([`seed.sql`](../seed.sql))  
- [x] Figma file linked and layout documented ([03 — Design and Figma](03-design-and-figma.md))  

### Finish Library UI (May 2026 sprint)

- [x] Single-screen configurator at `/configurator/` (Figma `study_SS` alignment)  
- [x] Viewport HUD: specs card, material tabs, finish wheel, graphic shelf  
- [x] Finish scroll wheel — fade mask, arc offset, nav arrows at active item  
- [x] Search + sort + filters (color, style, process)  
- [x] Three.js 3D preview with light/dark theme sync  
- [x] Core Home navbar component + theme event  
- [x] Standards library browse (`/library.html`, grouping taxonomy)  
- [x] Factory catalog import path ([finish-catalog-import.md](finish-catalog-import.md))  

### Deploy and hosting

- [x] Cloudflare Pages Phase 1 — [core-home-finish-library.pages.dev](https://core-home-finish-library.pages.dev/)  
- [x] `public/_redirects` — `/` → `/configurator/`  
- [x] `public/_headers` — JSON for `/api/catalog`  
- [x] Static catalog [`public/api/catalog`](../public/api/catalog) for Pages  
- [x] `STATIC_ASSETS` binding + `pages_build_output_dir` in `wrangler.jsonc`  

---

## Not started / in progress

| Item | Owner | Next step |
|------|--------|-----------|
| Remote D1 + `database_id` in `wrangler.jsonc` | WD / IT | `npm run db:create`, update config, `db:migrate` |
| R2 bucket `render-portal-files` | IT | Create in Cloudflare dashboard |
| Cloudflare Access + real `profiles` | IT | Policies for Core Home emails |
| Production Worker deploy | WD | `npm run deploy` after D1/R2/Access |
| Replace static catalog with live D1 API | WD | Remove or sync `public/api/catalog` after Worker live |
| CI pipeline (`wrangler check`, lint) | WD | Add workflow when team scales |
| Figma MCP finish sync | GD + WD | `.cursor/mcp.json`, map components → `finishes` |
| Product GLTF (replace cube) | ID + WD | [13 — 3D pipeline](13-3d-preview-pipeline.md) Stage 2 |
| Multi-material D1 + xlsx tabs | WD + PD | [12 — Database](12-database-multi-material.md) Phase 1 |
| Zone-aware 3D preview | ID + WD | [13](13-3d-preview-pipeline.md) Stage 3 + schema |
| Ceramic / Glass / Plastic full paths | GD + WD | After M2b + SS parity signed off |
| Render request dashboard in production | WD | Wire `/dashboard.html` to live D1 |

---

## Figma vs code (updated)

| Figma (target) | Code (May 2026) |
|----------------|-----------------|
| Single 1920×1080 configurator | **Live** at `/configurator/` |
| Material → Finish → Graphic on one screen | **Live** |
| Circular finish picker (exact geometry) | Vertical wheel + arc styling — close, not pixel-perfect |
| SS front/back hero | Single 3D cube stand-in |
| `Wheel_Button` carousels on shelf | Shelf cards + selection — carousel polish optional |
| Render request / PD-ID dashboard | Scaffold pages; not production-backed |

**Recommended order:** sign off SS layout with GD → product mesh → other materials → dashboard + Access.

---

## Milestones

```mermaid
flowchart LR
  M1[Scaffold done]
  M2[Phase1 Pages live]
  M3[SS UI parity]
  M4[Production infra]
  M5[PD ID rollout]

  M1 --> M2
  M2 --> M3
  M3 --> M4
  M4 --> M5
```

| Milestone | Outcome | Status |
|-----------|---------|--------|
| M1 — Scaffold | Worker, schema, docs, basic UI | Done |
| M2 — Phase 1 Pages | Public configurator + static catalog | **Done** |
| M3 — Figma SS UI | Parity with `study_SS` (layout + interactions) | In progress |
| M4 — Production infra | D1, R2, Access, Worker deploy | Not started |
| M5 — Rollout | PD/ID using portal instead of Excel/PPT | Blocked on M4 |

### Catalog and 3D track (M2a–M6)

Detailed specs: [11 — 3D primer](11-3d-materials-primer.md) · [12 — Database](12-database-multi-material.md) · [13 — 3D pipeline](13-3d-preview-pipeline.md).

| Milestone | Outcome | Depends on | Status |
|-----------|---------|------------|--------|
| **M2a** | Live D1 + `GET /api/catalog` filters by `material` | Secrets, Worker deploy, schema migration | Not started |
| **M2b** | Multi-tab xlsx import; enable Ceramic/Glass/Plastic | Template + factory tab names | Not started |
| **M3** | Bundled GLTF tumbler in preview (replace cube) | ID asset | Not started |
| **M4** | Zone map + multi-zone finishes in preview | `product_model_zones` + mesh naming | Not started |
| **M5** (3D) | R2 model upload + admin mesh→zone UI | Access, R2 CORS | Not started |
| **M6** | Decals / graphics on logo mesh (textures) | GD assets + shader work | Not started |

---

## Design and product notes

- UI must stay **visual-first** for PD.  
- **Finish Library** quality determines adoption.  
- **Render versioning** (V1, V2, V3) must remain visible in the dashboard.  
- Prefer **D1/SQLite** patterns in [05 — Data model](05-data-model.md).

---

## Owners

| Area | Owner |
|------|--------|
| Web / API / deploy | Elombe Kisala (WD) |
| Figma / visual design | Maria T, Jacinta Correia (GD) |
| PD workflow input | Product Development |
| ID fulfillment input | Industrial Design |
| Cloudflare account / Access | IT (with WD) |

---

[← 09 — Development workflow](09-development-workflow.md) · **Next:** [11 — 3D and materials primer →](11-3d-materials-primer.md)
