# Chapter 6 — Local setup

[← 05 — Data model](05-data-model.md) · [Project book](README.md) · **Next:** [07 — Deployment →](07-deployment.md)

**Plain language summary:** Install Node, run one command, and open the configurator in your browser — finishes appear without setting up a database.

---

## Prerequisites

**For: WD**

- **Node.js** 18+ (LTS recommended)
- **npm**
- **Wrangler** v4+ (installed via `npm install` in this repo)
- Optional: **Figma MCP** for design sync — see [09 — Development workflow](09-development-workflow.md)

---

## Clone and install

```bash
git clone https://github.com/SWFTstudios/core-home-finish-library.git
cd core-home-finish-library
npm install
```

---

## Run the configurator (fastest path)

```bash
npm run dev
```

Open **http://localhost:8787/configurator/**

| What you get | Notes |
|--------------|--------|
| Finish wheel, search, filters, shelf | Loads from `public/api/catalog` |
| 3D preview | Requires network for Three.js CDN on first load |
| Theme toggle | Light/dark via navbar |

**You do not need** `db:migrate:local` or `db:seed:local` to browse finishes in the configurator.

---

## Database (optional — full API)

**For: WD** — use when working on render requests, profiles, or Worker API routes.

```bash
npm run db:migrate:local
npm run db:seed:local
```

| Script | Command |
|--------|---------|
| Migrate (local) | `npm run db:migrate:local` |
| Seed (local) | `npm run db:seed:local` |
| Migrate (remote) | `npm run db:migrate` |
| Create remote DB | `npm run db:create` |

Factory spreadsheet import (regenerates seed):

```bash
npm run import:finishes
npm run db:migrate:local
npm run db:seed:local
```

See [finish-catalog-import.md](finish-catalog-import.md).

---

## Static routes (`public/`)

| URL | Purpose |
|-----|---------|
| `/` | Redirects to `/configurator/` |
| `/configurator/` | **Finish Library (SS)** — primary entry |
| `/api/catalog` | Catalog JSON (static file in dev and on Pages) |
| `/dashboard.html` | Render request dashboard |
| `/library.html` | Finish browse (standards library) |
| `/request.html` | New render request |

Production Pages uses [`public/_redirects`](../public/_redirects) and [`public/_headers`](../public/_headers). See [07 — Deployment](07-deployment.md).

---

## 3D preview requirements

- [Import map](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap) loads `three@0.180.0` from jsDelivr
- **WebGL** must be enabled in the browser
- Corporate proxies that block CDN scripts may prevent the preview from loading

---

## Local authentication

Production uses Cloudflare Access. Locally, the Worker accepts:

1. `Cf-Access-Authenticated-User-Email` if present, or  
2. Query param `?dev_email=you@example.com`, or  
3. Default `pd@corehome.internal` (must exist in `profiles` after seed)

Example:

```text
http://localhost:8787/api/me?dev_email=pd@corehome.internal
```

Seed creates `pd@corehome.internal` and `id@corehome.internal`.

---

## Environment files

```bash
cp .env.example .env
cp .cursor/mcp.json.example .cursor/mcp.json
```

`.env` and `.cursor/mcp.json` are gitignored.

**Stitch MCP:** [stitch-reference.md](stitch-reference.md#stitch-mcp-cursor).

---

## Useful scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Local Worker + static assets |
| `npm run pages:deploy` | Deploy `public/` to Cloudflare Pages |
| `npm run deploy` | Deploy Worker (Phase 2) |
| `npm run check` | Validate Wrangler config |
| `npm run types` | Generate Worker types after binding changes |

---

## Troubleshooting

| Issue | Check |
|-------|--------|
| Empty finish list | Confirm `public/api/catalog` exists; check Network tab for `/api/catalog` 200 |
| `403 No profile found` | Run `db:seed:local` or pass `dev_email` matching a seeded profile |
| 3D preview blank | CDN blocked? WebGL disabled? Console errors in `configurator-preview-3d.js` |
| `wrangler dev` fails on `ASSETS` | Binding must be `STATIC_ASSETS` in `wrangler.jsonc` |
| API 404 on dashboard routes | Run dev server; paths must start with `/api/` |

---

[← 05 — Data model](05-data-model.md) · **Next:** [07 — Deployment →](07-deployment.md)
