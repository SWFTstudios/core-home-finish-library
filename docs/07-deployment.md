# Chapter 7 — Deployment

[← 06 — Local setup](06-local-setup.md) · [Project book](README.md) · **Next:** [08 — API reference →](08-api-reference.md)

---

## Overview

Production runs on **Cloudflare**: one Worker serves the API and static `public/` assets. **D1** stores relational data; **R2** stores render uploads; **Access** gates internal users.

Complete local verification first — [06 — Local setup](06-local-setup.md).

---

## Deployment checklist

### 1. Create D1 database

```bash
npm run db:create
```

Copy the returned **database ID** into [`wrangler.jsonc`](../wrangler.jsonc) (`database_id` field).

### 2. Apply schema (remote)

```bash
npm run db:migrate
```

### 3. Create R2 bucket

In the Cloudflare dashboard, create bucket **`render-portal-files`** (must match `bucket_name` in `wrangler.jsonc`).

### 4. Configure Cloudflare Access

- Add Access application for the Worker hostname  
- Restrict to Core Home team email domains / groups  
- Ensure the Access policy injects `Cf-Access-Authenticated-User-Email`

### 5. Seed `profiles`

Insert rows for real users (email + `team`). Without a profile, authenticated users receive **403**.

Example teams: `PD`, `ID`, `GD`, `Admin`.

### 6. Deploy Worker

```bash
npm run deploy
```

### 7. Verify

- `GET /api/health` → `{ "ok": true }`  
- `GET /api/me` (authenticated) → profile JSON  
- Load `/` and confirm static assets

---

## Wrangler configuration

Key settings in [`wrangler.jsonc`](../wrangler.jsonc):

| Setting | Value |
|---------|--------|
| `name` | `render-portal` |
| `main` | `src/index.ts` |
| `assets.directory` | `./public` |
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
| Schema change | Update `schema.sql`, run `db:migrate`, deploy Worker |
| Finish catalog | Insert/update `finishes` (future: Figma sync job) |
| Logs | `wrangler tail` |
| Rollback | Redeploy previous Worker version from Git |

---

## Related chapters

- [08 — API reference](08-api-reference.md) — routes and auth headers  
- [05 — Data model](05-data-model.md) — tables and constraints  
- [10 — Roadmap and status](10-roadmap-and-status.md) — remaining production gaps  

---

[← 06 — Local setup](06-local-setup.md) · **Next:** [08 — API reference →](08-api-reference.md)
