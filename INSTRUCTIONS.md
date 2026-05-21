# Core Home Render Portal — Instructions

Living document for humans and AI assistants. See [PROJECT.md](./PROJECT.md) for full product context.

## Active to-do items

- [x] Project scaffold (Worker, D1 schema, static UI)
- [ ] Create remote D1: `npm run db:create` → update `database_id` in `wrangler.jsonc`
- [ ] Apply remote schema: `npm run db:migrate`
- [ ] Create R2 bucket `render-portal-files` in Cloudflare
- [ ] Configure Cloudflare Access + seed `profiles` for real team emails
- [ ] Connect Figma MCP (`.cursor/mcp.json`) and sync finishes from Maria's library
- [ ] Production deploy: `npm run deploy`
- [ ] CI (lint / `wrangler check`) when pipeline is needed

## Repository workflow

| Step | Action |
|------|--------|
| Start work | Read this file + `PROJECT.md` + `.cursorrules`; branch from `main` |
| During work | Small commits; conventional commit messages |
| Finish work | Run `npm run check`; open PR when user requests |
| Release | Merge to `main` when stable |

## Definition of done

- [ ] Matches visual-first UX (cards, not dropdowns for finishes)
- [ ] D1 uses SQLite syntax only; UUIDs via `crypto.randomUUID()` in Worker
- [ ] No secrets committed (`.env`, `mcp.json` with keys)
- [ ] `INSTRUCTIONS.md` / `PROJECT.md` status updated if scope changed

## Project notes

- **Chipotle analogy:** PD builds a spec by selecting finishes; ID executes from the same record.
- **Versioning:** `renders.version` increments per request; show history in UI (future).
- **Design merge:** Maria's Figma tokens/components → CSS + `finishes.figma_node_id` in D1.

## Links

- Remote: https://github.com/SWFTstudios/core-home-finish-library
- Product spec: [PROJECT.md](./PROJECT.md)
