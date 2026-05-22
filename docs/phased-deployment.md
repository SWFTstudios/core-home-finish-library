# Phased deployment — Finish Library on Cloudflare

[← Project book](README.md) · [07 — Deployment](07-deployment.md)

---

## Goal

Ship the **Finish Library** (configurator) as the primary experience at [core-home-finish-library.pages.dev](https://core-home-finish-library.pages.dev/), then add live catalog data and PD/ID workflows in later phases.

---

## Phase overview

| Phase | What ships | URL | Catalog API |
|-------|------------|-----|-------------|
| **1** | Static UI (`public/`) via Pages | `*.pages.dev` | **Done** — `public/api/catalog` + `_headers` (static JSON) |
| **2** | Worker + D1 + R2 + Access | `*.workers.dev` or custom domain | `GET /api/catalog` from D1 (replaces static file) |
| **3** | Same-origin API on Pages domain | `*.pages.dev` | Worker route or Pages Functions + bindings |
| **4** | CI, Access policies, Figma sync | Production | Full PD/ID rollout |

---

## Phase 1 — Pages (Finish Library visible) — **complete May 2026**

**Outcome:** Pushing to `main` deploys `public/` so `/` opens the Finish Library configurator with working finish data.

### Repo setup

- `public/_redirects` — `/` → `/configurator/` (302)
- `public/api/catalog` — static JSON for configurator boot
- `public/_headers` — JSON content-type for `/api/catalog`
- `public/index.html` — fallback redirect for local/dev
- `.github/workflows/deploy-pages.yml` — `wrangler pages deploy public`

### One-time Cloudflare / GitHub setup

1. **Pages project** named `core-home-finish-library` (must match workflow `project-name`).
2. **GitHub secrets** on the repo:
   - `CLOUDFLARE_API_TOKEN` — API token with *Cloudflare Pages — Edit* (and account read).
   - `CLOUDFLARE_ACCOUNT_ID` — from Cloudflare dashboard → Workers & Pages → right sidebar.
3. **Disconnect conflicting dashboard builds** (optional): If the Pages project already builds from Git with the wrong output directory (e.g. repo root), either:
   - Set **Build output directory** = `public`, **Build command** = empty, or
   - Rely on the GitHub Action only and disable automatic Git builds in the dashboard.

### Manual deploy (without waiting for CI)

```bash
npx wrangler pages deploy public --project-name=core-home-finish-library
```

### Verify

- [https://core-home-finish-library.pages.dev/configurator](https://core-home-finish-library.pages.dev/configurator) → Finish Library (served from `public/configurator/index.html`).
- [https://core-home-finish-library.pages.dev/](https://core-home-finish-library.pages.dev/) redirects to `/configurator/`.
- `/dashboard.html` opens the render-request table (needs Worker API in Phase 2).

---

## Phase 2 — Worker (live catalog + auth)

**Outcome:** `npm run deploy` publishes API + static assets on one Worker origin.

### Checklist

1. `npm run db:create` → paste `database_id` in `wrangler.jsonc`
2. `npm run db:migrate` and `npm run import:finishes` + seed
3. Create R2 bucket `render-portal-files`
4. Cloudflare Access on Worker hostname
5. `npm run deploy` or enable `.github/workflows/deploy-worker.yml` (set `on.push` when ready)

### Link from Pages to Worker (until Phase 3)

After deploy, note the Worker URL (e.g. `https://render-portal.<account>.workers.dev`). Use it for:

- Full API-backed configurator: `https://<worker>/configurator.html`
- Health: `GET /api/health`

---

## Phase 3 — Single domain (optional)

Options (pick one with infra owner):

- **Custom domain** on the Worker (e.g. `finish.corehome.internal`) and retire static-only Pages, or
- **Pages + Worker service binding** so `*.pages.dev` proxies `/api/*` to the Worker, or
- **Migrate** to Workers-only hosting per [Cloudflare migration guide](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/).

---

## Phase 4 — Product rollout

- Figma MCP catalog sync (GD)
- Real `profiles` for Access emails
- Render request workflow end-to-end
- CI: `wrangler check`, lint

Track day-to-day items in [`INSTRUCTIONS.md`](../INSTRUCTIONS.md).

---

## Local development

| Command | Serves |
|---------|--------|
| `npm run dev` | Worker + `public/` on `http://localhost:8787` |
| `/` | Redirects to configurator (via `index.html` or Worker) |
| `/configurator.html` | Finish Library (SS) — **main focus** |

```bash
npm run import:finishes
npm run db:migrate:local && npm run db:seed:local
npm run dev
```

Open [http://localhost:8787/configurator.html](http://localhost:8787/configurator.html).
