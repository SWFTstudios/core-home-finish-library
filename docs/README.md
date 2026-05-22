# Core Home Render Portal — Project Book

**In plain language:** This is the full story of Core Home's Finish Library — why it exists, how teams use it, how it was built, and what comes next. Read it like a book; you do not need to be technical to understand the first chapters.

Internal documentation for the **Render Portal / Finish Library**: why it exists, how it works, how to run it, and how the team builds on it.

**Repository:** https://github.com/SWFTstudios/core-home-finish-library  
**Company:** Core Home (NYC housewares)  
**Live configurator:** https://core-home-finish-library.pages.dev/  
**Last updated:** May 2026

---

## Table of contents

| Ch. | Title | For |
|-----|--------|-----|
| [01](01-purpose.md) | Purpose | C-Suite, stakeholders, new teammates — *why we built this* |
| [02](02-how-it-works.md) | How it works | PD, ID, Sales, GD — *day-to-day workflow and on-screen tour* |
| [03](03-design-and-figma.md) | Design and Figma | GD, WD — *UI source of truth and what's live vs. planned* |
| [04](04-architecture.md) | Architecture | WD, IT — *system diagram, Pages vs. Worker, 3D preview* |
| [05](05-data-model.md) | Data model | WD — *D1 tables, catalog JSON, relationships* |
| [06](06-local-setup.md) | Local setup | WD — *run on your machine in minutes* |
| [07](07-deployment.md) | Deployment | WD, IT — *Cloudflare Pages (live) and Worker (Phase 2)* |
| [08](08-api-reference.md) | API reference | WD, IT — *routes, auth, catalog response* |
| [09](09-development-workflow.md) | Development workflow | Everyone — *Git bible, design handoff, sprint narrative* |
| [10](10-roadmap-and-status.md) | Roadmap and status | Everyone — *what's done, what's next, who owns it* |
| [11](11-3d-materials-primer.md) | 3D and materials primer | Everyone — *meshes, zones, PBR, glossary* |
| [12](12-database-multi-material.md) | Database and multi-material catalog | WD, IT, PD — *xlsx tabs, D1 phases, schema* |
| [13](13-3d-preview-pipeline.md) | 3D preview and model upload | WD, ID — *GLTF stages, zone map, R2* |
| [phased-deployment](phased-deployment.md) | Phased deployment | WD, IT — *Pages → Worker → production* |

**Supplementary guides**

| Doc | For |
|-----|-----|
| [finish-catalog-import.md](finish-catalog-import.md) | WD — factory spreadsheet → D1 |
| [11](11-3d-materials-primer.md) · [12](12-database-multi-material.md) · [13](13-3d-preview-pipeline.md) | Catalog + 3D deep dives |
| [stitch-reference.md](stitch-reference.md) | WD — Stitch MCP in Cursor |

---

## Quick links

- **Figma prototype:** [InteractiveFinishLibrary_COPY](https://www.figma.com/design/XY8ZVNYLrbK6OMVWNNqSBt/InteractiveFinishLibrary_COPY)
- **UI inspiration (viewport HUD):** [`inspiration/`](../inspiration/) — before/after screenshots for layout QA
- **Configurator code:** [`public/configurator/`](../public/configurator/), [`public/css/configurator.css`](../public/css/configurator.css), [`public/js/configurator.js`](../public/js/configurator.js)
- **Schema:** [`schema.sql`](../schema.sql)
- **Worker API:** [`src/index.ts`](../src/index.ts)
- **Active todos:** [`INSTRUCTIONS.md`](../INSTRUCTIONS.md)
- **Pages site:** [core-home-finish-library.pages.dev](https://core-home-finish-library.pages.dev/)

---

## Read in order (by role)

| Role | Start here | Then |
|------|------------|------|
| **C-Suite / leadership** | [01 — Purpose](01-purpose.md) | [10 — Roadmap](10-roadmap-and-status.md) |
| **Product Development / Industrial Design** | [01 — Purpose](01-purpose.md) → [02 — How it works](02-how-it-works.md) | [11 — 3D primer](11-3d-materials-primer.md) → [13 — 3D pipeline](13-3d-preview-pipeline.md) (mesh naming) |
| **Graphic Design** | [02 — How it works](02-how-it-works.md) → [03 — Design and Figma](03-design-and-figma.md) | [11 — 3D primer](11-3d-materials-primer.md) → [12 — Multi-material](12-database-multi-material.md) (xlsx tabs) |
| **Sales / customer-facing** | [01 — Purpose](01-purpose.md) → [02 — How it works](02-how-it-works.md) | Finish names and filters in the configurator |
| **Web Development** | [05 — Data model](05-data-model.md) → [12 — Multi-material](12-database-multi-material.md) → [13 — 3D pipeline](13-3d-preview-pipeline.md) | [06 — Local setup](06-local-setup.md) → [07 — Deployment](07-deployment.md) |
| **IT / DevOps** | [07 — Deployment](07-deployment.md) → [phased-deployment](phased-deployment.md) | [INSTRUCTIONS.md](../INSTRUCTIONS.md) for open infra todos |

**Default path for new teammates:** **01 → 02 → 06**. Shipping to production? **06 → 07 → 08**. Implementing UI from design? **03** then **06**.
