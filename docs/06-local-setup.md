# Chapter 6 — Local setup

[← 05 — Data model](05-data-model.md) · [Project book](README.md) · **Next:** [07 — Deployment →](07-deployment.md)

---

## Prerequisites

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

## Database (local D1)

Apply schema and optional seed data to the **local** D1 instance:

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

---

## Run the dev server

```bash
npm run dev
```

Wrangler prints a URL (typically **http://localhost:8787**). The Worker serves both static files and `/api/*` on the same origin.

---

## Pages (current scaffold)

| URL | File | Purpose |
|-----|------|---------|
| `/` | `public/index.html` | Request dashboard |
| `/library.html` | `public/library.html` | Finish Library browse |
| `/request.html` | `public/request.html` | New render request |

These will evolve toward the Figma configurator described in [03 — Design and Figma](03-design-and-figma.md).

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

Copy secrets template (do not commit real keys):

```bash
cp .env.example .env
cp .cursor/mcp.json.example .cursor/mcp.json
```

`.env` and `.cursor/mcp.json` are gitignored.

---

## Useful scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Local Worker + assets |
| `npm run deploy` | Deploy to Cloudflare |
| `npm run check` | Validate Wrangler config |
| `npm run types` | Generate Worker types after binding changes |

---

## Troubleshooting

| Issue | Check |
|-------|--------|
| `403 No profile found` | Run `db:seed:local` or pass `dev_email` matching a seeded profile |
| Empty finish list | Run `db:seed:local` |
| API 404 | Ensure path starts with `/api/` and dev server is running |

---

[← 05 — Data model](05-data-model.md) · **Next:** [07 — Deployment →](07-deployment.md)
