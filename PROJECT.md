# Render Portal / Finish Library

**Status:** Initial scaffold — base build in progress
**Company:** Core Home (NYC-based housewares brand)
**Owner:** Elombe Kisala — Web Developer
**Design Collaborator:** Maria T — Graphic Design
**Last updated:** May 2026

---

## What This Is

An internal web tool that replaces the current render request workflow at Core Home.

Right now, Product Development (PD) communicates render specs to Industrial Design (ID) through Excel spreadsheets and PowerPoint decks — janky, note-heavy, version-confused, and unclear. This portal replaces all of that with a structured, visual dashboard that both teams share.

Think of it like ordering a Chipotle bowl: PD selects exactly what they want (material, finish, color, texture, logo treatment) from a visual library, and ID receives a clean, unambiguous spec they can execute immediately.

---

## The Problem It Solves

| Before (Current State) | After (Render Portal) |
|---|---|
| Excel spreadsheets with scattered notes | Structured render request form |
| "Which file is latest???" | Version-controlled, timestamped requests |
| Back-and-forth clarification emails | Visual finish selection — no ambiguity |
| Multiple PPTs per project | Single dashboard per project |
| PD and ID not aligned | Both teams see the same source of truth |

---

## Teams & Roles

| Team | Abbreviation | Role in This Tool |
|---|---|---|
| Product Development | PD | Places render requests — the "customer" |
| Industrial Design | ID | Fulfills render requests — the "chefs" |
| Graphic Design | GD | Built the Figma finish library (Maria T) |
| Web Development | WD | Building the portal (Elombe K) |

---

## How It Works (User Flow)

1. **PD opens the Render Portal dashboard**
2. **PD starts a new render request** — selects product type (e.g. water bottle)
3. **PD picks finish specs** from the visual Finish Library:
   - Body color / material (e.g. matte pink)
   - Logo finish (e.g. reflective silver)
   - Texture, coating type, any special treatments
4. **PD submits the request** — structured, visual, no notes crammed into cells
5. **ID receives the request** on their dashboard view — specs are clear, visual, ready to execute
6. **ID delivers the render** — uploaded back to the project, versioned, logged
7. **Both teams can see history**, revisions, and status at any time

---

## Origin: Two Projects Merging

This project started as two separate efforts:

**Maria T (GD / Figma)**
- Built a visual Finish Library prototype in Figma
- Color swatches, material finishes, textures, UI mockups for the request flow
- Source of truth for what finishes exist and how they look

**Elombe K (WD / Code)**
- Building the Render Portal as a full web app
- HTML, CSS, JS frontend (served via Cloudflare Pages)
- Cloudflare D1 for the database
- Cloudflare R2 for render file/image storage
- Cloudflare Workers for the API layer
- Cloudflare Access for internal auth (Zero Trust)
- Cursor for AI-assisted development
- GitHub for version control

The goal is to **merge these two workstreams** into one project: Maria's visual design system (pulled via Figma MCP) becomes the UI/design layer, and Elombe's web stack becomes the backend and deployment layer.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript (vanilla) |
| API Layer | Cloudflare Workers (TypeScript, ES modules) |
| Database | Cloudflare D1 (SQLite) |
| File / Image Storage | Cloudflare R2 |
| Auth | Cloudflare Access (Zero Trust) — internal only |
| Dev Environment | Cursor + Wrangler CLI |
| Design Reference | Figma (Maria's Finish Library prototype) |
| Figma Integration | Figma MCP via `.cursor/mcp.json` |
| Version Control | GitHub |
| Deployment | Cloudflare Pages (frontend) + Workers (API) |

---

## Core Features (MVP Scope)

### Finish Library
- Browse all available materials, finishes, colors, textures
- Visual cards — not dropdowns, not text lists
- Sourced from / synced with Maria's Figma design system
- Searchable and filterable

### Render Request Form
- Structured, visual spec builder
- PD selects from the Finish Library (not freeform text)
- Product type, finish selections, notes field, target deadline
- Submission creates a record in D1 via a Worker

### Dashboard (Shared)
- PD view: active requests, drafts, history
- ID view: incoming requests queue, in-progress, delivered
- Status labels: Draft, Submitted, In Progress, Delivered, Revision Requested

### Role-Based Access
- Handled via Cloudflare Access policies (team email groups)
- Worker reads the `Cf-Access-Authenticated-User-Email` header
- Team role (`PD`, `ID`, `GD`, `Admin`) stored in the `profiles` D1 table

---

## D1 Database Schema

> D1 uses SQLite syntax. UUIDs are generated in Workers via `crypto.randomUUID()` and stored as TEXT.
> Foreign keys require `PRAGMA foreign_keys = ON` — set this in your Worker before queries.

See `schema.sql` in the repository root.

---

## Wrangler Config

See `wrangler.jsonc` in the repository root.

---

## Worker Auth Pattern

Cloudflare Access injects a verified header on every request. Read team role from D1. Implementation in `src/index.ts`.

---

## Figma MCP Setup (Cursor)

Copy `.cursor/mcp.json.example` to `.cursor/mcp.json` and add your Figma API key.

---

## Creating the D1 Database

Via Wrangler CLI:

```bash
npm run db:create
npm run db:migrate
```

Local dev:

```bash
npm run dev
```

---

## Current Status

- [x] Initial GitHub repo created
- [x] Cursor project initialized
- [x] Project scaffold (Worker, schema, static UI)
- [ ] D1 database created in Cloudflare (`npm run db:create`)
- [ ] Schema applied to remote D1 (`npm run db:migrate`)
- [ ] R2 bucket created in Cloudflare dashboard
- [ ] Cloudflare Access policy configured
- [ ] Finish Library synced from Figma (Maria's design system)
- [ ] Render Request form wired to API
- [ ] Cloudflare Pages / Workers production deployment

---

## Notes

- Keep the UI visual-first. PD team members are not technical — everything should feel like browsing, not filling out a form.
- The Finish Library is the heart of this product. If the library is incomplete or hard to browse, the whole workflow breaks.
- Version control on renders matters. ID teams often deliver V1, V2, V3 — the portal should make that history visible and clean.
- D1 is SQLite. Do not write PostgreSQL-specific syntax (no `gen_random_uuid()`, no `SERIAL`, no array types).
- All UUIDs are generated in the Worker with `crypto.randomUUID()` before being inserted.
