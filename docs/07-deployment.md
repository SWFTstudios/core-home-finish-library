# Chapter 7 — Deployment

[← 06 — Local setup](06-local-setup.md) · [Project book](README.md) · **Next:** [08 — API reference →](08-api-reference.md)

**Plain language summary:** The Finish Library is already on the internet via Cloudflare Pages; the next step is connecting the live database and login for the full portal.

---

## Overview

**For: WD, IT**

| Phase | Status | What users get |
|-------|--------|----------------|
| **Phase 1 — Pages** | **Complete (May 2026)** | Configurator UI + static `/api/catalog` |
| **Phase 2 — Worker + D1 + R2 + Access** | Not started | Live API, render uploads, team auth |

Full phased plan: [phased-deployment.md](phased-deployment.md)

---

## Phase 1 — Cloudflare Pages (live)

| Item | Value |
|------|--------|
| URL | [https://core-home-finish-library.pages.dev/](https://core-home-finish-library.pages.dev/) |
| Entry | `/` → `/configurator/` (302 via `_redirects`) |
| Build output | `public/` (`pages_build_output_dir` in `wrangler.jsonc`) |
| CI | Push to `main` → [`.github/workflows/deploy-pages.yml`](../.github/workflows/deploy-pages.yml) |
| Manual deploy | `npm run pages:deploy` |

### Why Phase 1 ships static catalog JSON

Pages hosts HTML/CSS/JS only — no Worker runtime on that hostname. The configurator still needs finish data, so the repo includes:

| File | Purpose |
|------|---------|
| [`public/api/catalog`](../public/api/catalog) | JSON snapshot (~108 finishes) |
| [`public/_headers`](../public/_headers) | `Content-Type: application/json` for `/api/catalog` |
| [`public/_redirects`](../public/_redirects) | Home → configurator |

**Why:** PD/ID/GD can use the real UI immediately without waiting for D1 provisioning.

**Trade-off:** Catalog updates require regenerating/committing `public/api/catalog` until Phase 2 serves D1 dynamically.

### GitHub secrets (Pages CI)

| Secret | Purpose |
|--------|---------|
| `CLOUDFLARE_API_TOKEN` | Deploy permission |
| `CLOUDFLARE_ACCOUNT_ID` | Target account |

If CI is not configured, run `npm run pages:deploy` locally with Wrangler logged in.

---

## Phase 2 — Worker deployment checklist

**For: WD, IT** — complete when render requests and auth are required in production.

### 1. Create D1 database

```bash
npm run db:create
```

Copy the returned **database ID** into [`wrangler.jsonc`](../wrangler.jsonc) (`database_id` field).

### 2. Apply schema (remote)

```bash
npm run db:migrate
```

### 3. Seed catalog

```bash
npm run import:finishes
npm run db:seed
```

### 4. Create R2 bucket

In the Cloudflare dashboard, create bucket **`render-portal-files`** (must match `bucket_name` in `wrangler.jsonc`).

### 5. Configure Cloudflare Access

- Add Access application for the Worker hostname  
- Restrict to Core Home team email domains / groups  
- Ensure the policy injects `Cf-Access-Authenticated-User-Email`

### 6. Seed `profiles`

Insert rows for real users (email + `team`). Without a profile, authenticated users receive **403**.

Example teams: `PD`, `ID`, `GD`, `Admin`.

### 7. Deploy Worker

```bash
npm run deploy
```

### 8. Verify

- `GET /api/health` → `{ "ok": true }`  
- `GET /api/me` (authenticated) → profile JSON  
- `GET /api/catalog?material=stainless_steel` → finishes from D1  
- Load `/configurator/` — same UI, dynamic catalog

---

## Wrangler configuration

Key settings in [`wrangler.jsonc`](../wrangler.jsonc):

| Setting | Value |
|---------|--------|
| `name` | `render-portal` |
| `main` | `src/index.ts` |
| `pages_build_output_dir` | `./public` |
| `assets.directory` | `./public` |
| `assets.binding` | **`STATIC_ASSETS`** (not `ASSETS`) |
| D1 binding | `DB` → `render-portal-db` |
| R2 binding | `RENDERS` → `render-portal-files` |

After changing bindings, run `npm run types` to refresh TypeScript definitions.

---

## Secrets

- Do **not** commit API keys, D1 IDs from other envs, or `.cursor/mcp.json` with real tokens.  
- Use Cloudflare dashboard / `wrangler secret` for production secrets if added later.

---

## Post-deploy operations

| Task | Approach |
|------|----------|
| UI-only change | Push `main` → Pages redeploys |
| Schema change | Update `schema.sql`, `db:migrate`, deploy Worker |
| Finish catalog | `import:finishes` → update seed + static `public/api/catalog` (Phase 1) or `db:seed` (Phase 2) |
| Logs | `wrangler tail` |
| Rollback | Redeploy previous version from Git |

---

## Related chapters

- [08 — API reference](08-api-reference.md) — routes and auth headers  
- [05 — Data model](05-data-model.md) — tables and catalog  
- [10 — Roadmap and status](10-roadmap-and-status.md) — remaining gaps  

---

[← 06 — Local setup](06-local-setup.md) · **Next:** [08 — API reference →](08-api-reference.md)
