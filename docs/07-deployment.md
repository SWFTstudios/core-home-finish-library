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
| Build output | `public/` (uploaded by `wrangler pages deploy public`) |
| CI | Push to `main` or PR → [`.github/workflows/deploy-pages.yml`](../.github/workflows/deploy-pages.yml) (`wrangler pages deploy public`) |
| Manual deploy | `npm run pages:deploy` (uses current git branch; set `CF_PAGES_BRANCH=main` for production) |

> **Note:** Always deploy the `public/` directory via Wrangler. Cloudflare’s Git-connected Pages check can report “Deployed successfully” while the preview hostname stays empty/404 if the project build root is not `public/`. Prefer this workflow over relying on the Git integration alone.

### Why Phase 1 ships static catalog JSON

Pages hosts HTML/CSS/JS only — no Worker runtime on that hostname. The configurator still needs finish data, so the repo includes:

| File | Purpose |
|------|---------|
| [`public/api/catalog`](../public/api/catalog) | JSON snapshot (~108 finishes) |
| [`public/_headers`](../public/_headers) | `Content-Type: application/json` for `/api/catalog` |
| [`public/_redirects`](../public/_redirects) | Home → configurator |

**Why:** PD/ID/GD can use the real UI immediately without waiting for D1 provisioning.

**Trade-off:** Catalog updates require regenerating/committing `public/api/catalog` until Phase 2 serves D1 dynamically.

### GitHub secrets (Pages CI) — required for auto-deploy

The workflow [`.github/workflows/deploy-pages.yml`](../.github/workflows/deploy-pages.yml) runs `npm run pages:deploy` on every push to `main`. **Both secrets must exist** or the job fails immediately with a clear error.

| Secret | Where to get it |
|--------|-----------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → **My Profile** → API Tokens → Create token with **Cloudflare Pages — Edit** (and account read) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → **Workers & Pages** → right sidebar **Account ID** |

Add them in GitHub: **Repository → Settings → Secrets and variables → Actions → New repository secret**.

Or from a machine with `gh` logged in (account ID only — token must be created in the dashboard first):

```bash
gh secret set CLOUDFLARE_ACCOUNT_ID -R SWFTstudios/core-home-finish-library --body "YOUR_ACCOUNT_ID"
gh secret set CLOUDFLARE_API_TOKEN -R SWFTstudios/core-home-finish-library   # prompts; paste token from dashboard
```

**Create API token (dashboard):** [Account API tokens](https://dash.cloudflare.com/profile/api-tokens) → **Create Token** → custom token with **Account → Cloudflare Pages → Edit** (and **Account → Workers Scripts → Edit** if you will run `npm run deploy` later). Scope to **Elombe@swftstudios.com's Account** only.

**Manual deploy** (if CI secrets are not set yet):

```bash
npm install
npm run pages:deploy
```

Requires Wrangler login or `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` in your shell.

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
