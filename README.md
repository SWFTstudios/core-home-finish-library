# Core Home — Render Portal / Finish Library

Internal web tool for Core Home (NYC housewares) that replaces Excel/PPT render specs with a visual Finish Library and shared PD ↔ ID dashboard.

**Full spec:** see [PROJECT.md](./PROJECT.md)

## Stack

| Layer | Tech |
|-------|------|
| Frontend | HTML, CSS, vanilla JS (`public/`) |
| API | Cloudflare Workers (`src/index.ts`) |
| Database | Cloudflare D1 (SQLite) |
| Files | Cloudflare R2 |
| Auth | Cloudflare Access (Zero Trust) |

## Quick start

```bash
git clone https://github.com/SWFTstudios/core-home-finish-library.git
cd core-home-finish-library
npm install
npm run db:migrate:local
npm run db:seed:local
npm run dev
```

Open the URL Wrangler prints (usually `http://localhost:8787`).

- **Dashboard** — `/`
- **Finish Library** — `/library.html`
- **New request** — `/request.html`

Local API uses `dev_email` fallback (`pd@corehome.internal`) when Cloudflare Access headers are absent.

## Cloudflare setup (production)

1. `npm run db:create` — paste returned `database_id` into `wrangler.jsonc`
2. `npm run db:migrate` — apply `schema.sql` to remote D1
3. Create R2 bucket `render-portal-files` in the dashboard
4. Configure Cloudflare Access policies for internal emails
5. Seed `profiles` for team members (`PD`, `ID`, `GD`, `Admin`)
6. `npm run deploy`

## Figma MCP

```bash
cp .cursor/mcp.json.example .cursor/mcp.json
# Add your Figma API key (never commit mcp.json with real keys)
```

## API routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/me` | Current profile (Access email → D1) |
| GET | `/api/finishes` | List finishes (`?category`, `?q`) |
| GET | `/api/requests` | List render requests |
| POST | `/api/requests` | Create request (PD / Admin) |
| POST | `/api/renders/upload` | Upload deliverable (ID / Admin) |

## Contributing

Branch from `main`, use [Conventional Commits](https://www.conventionalcommits.org/). See `INSTRUCTIONS.md` and `.cursorrules`.

## Team

- **WD** — Elombe Kisala
- **GD** — Maria T (Figma Finish Library)
- **PD / ID** — request and fulfillment workflows
