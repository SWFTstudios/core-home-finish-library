# Chapter 8 — API reference

[← 07 — Deployment](07-deployment.md) · [Project book](README.md) · **Next:** [09 — Development workflow →](09-development-workflow.md)

**Plain language summary:** The configurator loads finish data from `/api/catalog`; on the live website that is a JSON file; after Phase 2 it will come from the database through the Worker.

---

## Base URL

| Environment | Base |
|-------------|------|
| Local | `http://localhost:8787` (Wrangler dev) |
| Production | Your deployed Worker URL |

All API routes are under **`/api/`**. Non-API paths serve static files from `public/`.

---

## Authentication

| Header / param | When |
|----------------|------|
| `Cf-Access-Authenticated-User-Email` | Production (Cloudflare Access) |
| `?dev_email=` | Local dev fallback |
| (default) `pd@corehome.internal` | Local if no header/param |

Responses:

- **401** — no email resolved  
- **403** — email not in `profiles` (except `/api/health`)

Implementation: [`src/index.ts`](../src/index.ts).

---

## Routes

### `GET /api/health`

No auth required.

**Response:** `{ "ok": true, "service": "render-portal" }`

---

### `GET /api/me`

**Auth:** required profile.

**Response:** `{ "profile": { "id", "email", "full_name", "team" } }`

---

### `GET /api/catalog`

Boot payload for [`/configurator/`](../public/configurator/index.html). All UI options (materials, finishes, graphic types) come from this response.

#### Phase 1 (Pages — live today)

| Item | Detail |
|------|--------|
| Source | Static file [`public/api/catalog`](../public/api/catalog) |
| Content-Type | Set by [`public/_headers`](../public/_headers): `application/json; charset=utf-8` |
| Auth | Not required (public read for internal Pages URL) |
| Update | Regenerate from seed/import and redeploy Pages |

#### Phase 2 (Worker + D1)

| Item | Detail |
|------|--------|
| Source | Worker handler in [`src/index.ts`](../src/index.ts) |
| Auth | Required profile (see Authentication) |
| Update | `npm run import:finishes` + `db:seed` on remote D1 |

**Query parameters:**

| Param | Description |
|-------|-------------|
| `material` | Material slug (default `stainless_steel`) |

**Today:** the Worker echoes `material` but returns **all** finishes regardless of param. **Planned (M2a):** filter finishes by `material_slug` after schema migration — [12 — Database and multi-material](12-database-multi-material.md).

**Response:**

```json
{
  "templateId": "finish_library_ak",
  "material": "stainless_steel",
  "materials": [{ "id", "slug", "label", "enabled", "sortOrder" }],
  "graphicApplicationTypes": [{ "id", "templateKey", "label", "uiLabel", "sortOrder" }],
  "finishes": [{
    "id", "slug", "name", "durabilityScore", "durabilityNotes",
    "priceBand", "costTier", "finishProcess", "hexColor",
    "compatibleGraphics": ["gfx-005", "..."]
  }]
}
```

---

### `GET /api/finishes`

**Auth:** required profile.

**Query parameters:**

| Param | Description |
|-------|-------------|
| `category` | Exact match on `finishes.category` |
| `q` | Search `name` and `description` (LIKE) |

**Response:** `{ "finishes": [ ... ] }` (full row including factory columns)

---

### `GET /api/requests`

**Auth:** required profile.

**Query parameters:**

| Param | Description |
|-------|-------------|
| `status` | Filter by `render_requests.status` |

**Response:** `{ "requests": [ { id, title, product_type, status, deadline, created_at, updated_at } ] }`

Ordered by `updated_at` descending.

---

### `GET /api/requests/:id`

**Auth:** required profile.

**Response:** `{ "request": { ... } }` — full request detail for dashboard and PDF export.

| Field | Description |
|-------|-------------|
| `id`, `title`, `product_type`, `status`, `notes`, `deadline` | Core request metadata |
| `material_slug`, `material_label` | Material tab from configurator |
| `graphic_application_id`, `graphic` | Graphic treatment (`{ id, label, template_key }` or null) |
| `source` | `configurator` or `request_form` |
| `spec_snapshot` | Frozen JSON copy of UI state at submit time |
| `created_at`, `updated_at` | Timestamps |
| `requested_by` | `{ id, email, full_name, team }` |
| `finishes` | Array of zone selections with joined finish catalog fields |
| `renders` | Versioned ID deliverables (`version`, `file_url`, `created_at`, …) |

**Errors:** `404` if request ID not found.

---

### `POST /api/requests`

**Auth:** profile with `team` = `PD` or `Admin`.

**Body (JSON):**

```json
{
  "title": "24oz bottle — Spring 2026",
  "product_type": "Water bottle",
  "notes": "Optional",
  "deadline": "2026-06-15",
  "status": "Submitted",
  "material_slug": "stainless_steel",
  "graphic_application_id": "gfx-005",
  "source": "configurator",
  "spec_snapshot": { "title": "24oz bottle — Spring 2026", "finishes": [] },
  "finishes": [
    { "finish_id": "fin-matte-pink", "zone": "body", "notes": null }
  ]
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `title` | Yes | Trimmed non-empty |
| `product_type` | No | |
| `notes` | No | |
| `deadline` | No | ISO date string |
| `status` | No | Default `Draft` |
| `material_slug` | No | From configurator material tab |
| `graphic_application_id` | No | FK to `graphic_application_types` |
| `source` | No | `configurator` or `request_form` (default `request_form`) |
| `spec_snapshot` | No | JSON object stored as TEXT for stable PDF export |
| `finishes` | No | Array of `{ finish_id, zone, notes? }` |

**Response:** `201` — `{ "id", "status" }`

**Errors:** `400` missing title, `403` wrong team.

---

### `POST /api/renders/upload`

**Auth:** profile with `team` = `ID` or `Admin`.

**Body:** `multipart/form-data`

| Field | Required |
|-------|----------|
| `file` | Yes |
| `request_id` | Yes |
| `notes` | No |

Stores file in R2 at `renders/{requestId}/{uuid}-{filename}`, inserts `renders` row with next `version`.

**Response:** `201` — `{ "id", "file_url", "version" }`

---

### `GET /api/folder`

**Auth:** any authenticated profile.

Returns the user's default folder and saved configurator items (newest first).

**Response:**

```json
{
  "folder": { "id": "…", "name": "My folder" },
  "items": [
    {
      "id": "…",
      "material_slug": "stainless_steel",
      "finish_id": "fin-…",
      "graphic_application_id": "gfx-…",
      "notes": "",
      "selected_for_review": true,
      "spec_snapshot": { }
    }
  ]
}
```

---

### `POST /api/folder/items`

**Auth:** any authenticated profile.

**Body:** `{ "spec_snapshot": { … } }` — must include `finish_id` and `material_slug` (see [`public/js/folder-store.js`](../public/js/folder-store.js)).

**Response:** `201` — `{ "item": { … } }`  
**409** — duplicate finish + graphic combo in folder.

---

### `PATCH /api/folder/items/:id`

**Auth:** owner only (via profile's default folder).

**Body:** `{ "notes"?: string, "selected_for_review"?: boolean }`

**Response:** `{ "item": { … } }`

---

### `DELETE /api/folder/items/:id`

**Auth:** owner only.

**Response:** `204`

---

## Planned routes (catalog + 3D)

**Not implemented yet** — documented for Phase 3+ in [12 — Database and multi-material](12-database-multi-material.md) and [13 — 3D preview pipeline](13-3d-preview-pipeline.md).

| Route | Purpose |
|-------|---------|
| `GET /api/models` | List product models (optional `?material=`) |
| `GET /api/models/:slug` | Model metadata, zone map, signed or public GLB URL |
| `POST /api/models` | Admin/ID upload — multipart GLB → R2 + D1 |

---

## Error format

JSON errors use `{ "error": "message" }` with appropriate HTTP status.

---

## Client usage

[`public/js/app.js`](../public/js/app.js) wraps `fetch("/api/...")` for the scaffold UI. [`public/js/render-request-pdf.js`](../public/js/render-request-pdf.js) generates shareable PDF exports from `GET /api/requests/:id` on submit and from [`public/request-detail.html`](../public/request-detail.html).

---

[← 07 — Deployment](07-deployment.md) · **Next:** [09 — Development workflow →](09-development-workflow.md)
