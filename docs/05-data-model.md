# Chapter 5 — Data model

[← 04 — Architecture](04-architecture.md) · [Project book](README.md) · **Next:** [06 — Local setup →](06-local-setup.md)

**Plain language summary:** Finish names, colors, and graphic options are stored in a database design; today the live website reads a snapshot JSON file until the production database is connected.

---

## What powers the live configurator today

**For: Everyone · detail for WD**

| Source | Location | When used |
|--------|----------|-----------|
| **Static catalog (live on Pages)** | [`public/api/catalog`](../public/api/catalog) | Production and local dev without D1 seed |
| **D1 via Worker** | `GET /api/catalog` in [`src/index.ts`](../src/index.ts) | After Phase 2 deploy + remote seed |

The static file is generated from the same seed data (~108 finishes for stainless steel). The configurator does not hardcode finish lists in the browser — it always fetches `/api/catalog?material=…`.

When IT completes Phase 2, replace or remove the static file so D1 becomes the single source of truth.

---

## D1 conventions

- **SQLite syntax only** — no PostgreSQL `gen_random_uuid()`, `SERIAL`, or array types.
- **IDs** — stable text IDs for factory imports (`fin-{slug}`, `gfx-001`); UUIDs for requests/renders.
- **Foreign keys** — enabled per request: `PRAGMA foreign_keys = ON` in [`src/index.ts`](../src/index.ts).

Canonical schema: [`schema.sql`](../schema.sql). Factory import: [finish-catalog-import.md](finish-catalog-import.md).

---

## Entity relationship

```mermaid
erDiagram
  profiles ||--o{ render_requests : requests
  profiles ||--o{ renders : uploads
  render_requests ||--o{ request_finishes : selections
  finishes ||--o{ request_finishes : selected
  finishes ||--o{ finish_graphic_compat : supports
  graphic_application_types ||--o{ finish_graphic_compat : defines
  render_requests ||--o{ renders : deliverables

  material_types {
    text id PK
    text slug UK
    int enabled
  }
  graphic_application_types {
    text id PK
    text template_key UK
    text ui_label
  }
  finishes {
    text id PK
    text slug UK
    int durability_score
    text price_band
  }
  finish_graphic_compat {
    text finish_id FK
    text graphic_id FK
    int compatible
  }
```

---

## Factory capability tables

### `material_types`

UI material chips (Figma zone 1). `enabled = 1` only for stainless steel in v1.

### `graphic_application_types`

One row per spreadsheet boolean column (Water Decal, Laser Engraved, etc.). `template_key` matches [`factory-library-template.json`](../data/factory-library-template.json).

### `finishes`

Factory capability rows — one per spreadsheet line on sheet `Library`.

| Column | Source column |
|--------|----------------|
| `slug` | Derived from finish name |
| `name` | Finish Name |
| `durability_score` | Durability Score |
| `durability_notes` | Durability / Finish Notes |
| `price_band` | Price (`$` … `$$$$$`) |
| `cost_tier` | Derived from price band length |
| `finish_process` | Finish Process |
| `process_steps` | # of Steps (numeric when possible) |
| `description` | Combined notes |
| `hex_color` | Generated swatch placeholder |
| `template_id` | `finish_library_ak` |

### `finish_graphic_compat`

Junction: which graphic applications each finish supports (`compatible = 1`).

---

## Workflow tables

### `profiles`

Team membership tied to Cloudflare Access email (`PD`, `ID`, `GD`, `Admin`).

### `render_requests` / `request_finishes` / `renders`

Unchanged — PD specs and ID deliverables. See prior chapters in git history for column detail.

---

## Seed data

[`seed.sql`](../seed.sql) is **generated** by `npm run import:finishes` from the factory xlsx:

```bash
npm run import:finishes
npm run db:migrate:local
npm run db:seed:local
```

---

## Implementation notes

- Configurator boot: **`GET /api/catalog`** returns materials, graphic types, and finishes with `compatibleGraphics`.
- **Browse UI** filters and sorts on the client via [`public/js/finish-wheel-filters.js`](../public/js/finish-wheel-filters.js) after the catalog loads.
- Finish **search** (API): `GET /api/finishes?q=` when Worker + D1 are live; configurator uses client-side filter today.
- Re-import when the factory sends an updated spreadsheet (same template structure) — see [finish-catalog-import.md](finish-catalog-import.md).

---

[← 04 — Architecture](04-architecture.md) · **Next:** [06 — Local setup →](06-local-setup.md)
