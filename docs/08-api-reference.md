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

Everyone signs in with their **@corehome.com** email ([`src/auth.ts`](../src/auth.ts), rules in [`src/auth-policy.ts`](../src/auth-policy.ts)):

1. `/login/` posts the address to `POST /api/auth/request-code`. Only addresses ending exactly in `@corehome.com` (`ALLOWED_EMAIL_DOMAIN`) get a code.
2. A 6-digit code is emailed through the Cloudflare Email Service `EMAIL` binding, sent from `AUTH_EMAIL_FROM`. Codes expire after 10 minutes and allow 5 tries; one address can ask for 5 codes an hour, at least 30 seconds apart. Only a hash of the code is stored.
3. `POST /api/auth/verify` checks the code, creates the profile on first sign-in, and sets the `ch_session` cookie (`HttpOnly; Secure; SameSite=Lax`, 30 days). Only a hash of the session token is stored (`sessions` table).
4. New profiles go to `/welcome/` to enter their name and team, then to the Finish Library, where the walkthrough starts automatically once.

Every page, data file and API route needs a session except `/login/`, `/css/`, `/js/`, `/vendor/`, `/assets/brand/`, `/api/auth/*` and `/api/health`. Signed-out page requests redirect to `/login/?next=…`; API and data requests get **401**.

---

## Routes

### `GET /api/health`

No auth required.

**Response:** `{ "ok": true, "service": "render-portal", "database": true }`

---

### `POST /api/auth/request-code` · `POST /api/auth/verify` · `POST /api/auth/sign-out`

No session required. Bodies: `{ "email" }`, `{ "email", "code" }`, none.

| Status | Meaning |
|--------|---------|
| 403 `code: "domain"` | Not an @corehome.com address |
| 429 | Too many codes or wrong tries (`retryAfter` seconds when waiting helps) |
| 400 `code: "wrong" \| "expired" \| "locked"` | Code problems |

`verify` returns `{ "profile", "needsProfile" }` and the session cookie.

---

### `GET /api/me` · `PATCH /api/me`

**Response:** `{ "profile": { "id", "email", "full_name", "team", "department", "job_title", "onboarding_completed_at", "created_at" } }`

`PATCH` accepts `full_name`, `department` (one of the listed teams) and `job_title`. Product Development, Industrial Design and Graphic Design also set `team` (PD / ID / GD), which controls who can create requests and upload renders.

### `POST /api/me/onboarding`

`{ "completed": true }` marks the Finish Library walkthrough as seen (`false` resets it).

### `DELETE /api/me/sessions`

Signs the person out on every device.

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

[`public/js/app.js`](../public/js/app.js) wraps `fetch("/api/...")` for the scaffold UI. New UI should reuse these endpoints until the API evolves.

---

[← 07 — Deployment](07-deployment.md) · **Next:** [09 — Development workflow →](09-development-workflow.md)
