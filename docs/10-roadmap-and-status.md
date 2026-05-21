# Chapter 10 — Roadmap and status

[← 09 — Development workflow](09-development-workflow.md) · [Project book](README.md) · [Back to start →](01-purpose.md)

---

## Current phase

**Initial scaffold — base build in progress** (May 2026)

The Worker, D1 schema, seed data, and a three-page static UI exist. Production Cloudflare resources and Figma-aligned configurator UI are not complete.

---

## Completed

- [x] GitHub repository and `main` branch  
- [x] Cursor project rules (`.cursorrules`, `.cursor/rules/`)  
- [x] Project book documentation (`docs/`)  
- [x] Worker API scaffold ([`src/index.ts`](../src/index.ts))  
- [x] D1 schema ([`schema.sql`](../schema.sql)) and local seed ([`seed.sql`](../seed.sql))  
- [x] Static UI scaffold (`public/`)  
- [x] Figma file linked and layout documented ([03 — Design and Figma](03-design-and-figma.md))  

---

## In progress / not started

- [ ] Remote D1 created (`npm run db:create`) and `database_id` in `wrangler.jsonc`  
- [ ] Schema applied to production D1 (`npm run db:migrate`)  
- [ ] R2 bucket `render-portal-files` in Cloudflare  
- [ ] Cloudflare Access policies and real `profiles` seed  
- [ ] Production deploy (`npm run deploy`)  
- [ ] Finish Library data synced from Figma (GD team components → `finishes`)  
- [ ] UI rebuilt to match Figma configurator (SS screen first)  
- [ ] CI: `wrangler check` / lint in pipeline  

Track day-to-day todos in [`INSTRUCTIONS.md`](../INSTRUCTIONS.md).

---

## Figma vs code gap

| Figma (target) | Code (today) |
|----------------|--------------|
| Single 1920×1080 configurator | Three separate pages |
| Circular finish picker | Card grid on `/library.html` |
| Material → Finish → Graphic flow on one screen | Split across pages |
| SS front/back + `FinishSpecs` | Not implemented |
| `Wheel_Button` carousels | Not implemented |

**Recommended build order:** implement **`SS` frame** interaction first (full prototype path), then other materials.

---

## Milestones

```mermaid
flowchart LR
  M1[Scaffold done]
  M2[Production infra]
  M3[Figma SS UI]
  M4[Catalog sync]
  M5[PD ID rollout]

  M1 --> M2
  M2 --> M3
  M3 --> M4
  M4 --> M5
```

| Milestone | Outcome |
|-----------|---------|
| M1 — Scaffold | Worker, schema, docs, basic UI (current) |
| M2 — Production infra | D1, R2, Access, deploy |
| M3 — Figma SS UI | Parity with `SS` / `study_SS` screens |
| M4 — Catalog sync | Finishes populated from Figma / CMS process |
| M5 — Rollout | PD/ID using portal instead of Excel/PPT |

---

## Design and product notes

- UI must stay **visual-first** for PD.  
- **Finish Library** quality determines adoption.  
- **Render versioning** (V1, V2, V3) must remain visible in the dashboard.  
- Prefer **D1/SQLite** patterns documented in [05 — Data model](05-data-model.md).

---

## Owners

| Area | Owner |
|------|--------|
| Web / API / deploy | Elombe Kisala (WD) |
| Figma / visual design | Maria T, Jacinta Correia (GD) |
| PD workflow input | Product Development |
| ID fulfillment input | Industrial Design |

---

[← 09 — Development workflow](09-development-workflow.md) · [Project book](README.md) · [01 — Purpose →](01-purpose.md)
