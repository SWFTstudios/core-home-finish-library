# Chapter 8 — API reference

[← 07 — Deployment](07-deployment.md) · [Project book](README.md) · **Next:** [09 — Development workflow →](09-development-workflow.md)

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

### `GET /api/finishes`

**Auth:** required profile.

**Query parameters:**

| Param | Description |
|-------|-------------|
| `category` | Exact match on `finishes.category` |
| `q` | Search `name` and `description` (LIKE) |

**Response:** `{ "finishes": [ ... ] }`

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

## Error format

JSON errors use `{ "error": "message" }` with appropriate HTTP status.

---

## Client usage

[`public/js/app.js`](../public/js/app.js) wraps `fetch("/api/...")` for the scaffold UI. New UI should reuse these endpoints until the API evolves.

---

[← 07 — Deployment](07-deployment.md) · **Next:** [09 — Development workflow →](09-development-workflow.md)
