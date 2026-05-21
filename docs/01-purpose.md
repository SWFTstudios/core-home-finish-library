# Chapter 1 — Purpose

[← Project book](README.md) · **Next:** [02 — How it works →](02-how-it-works.md)

---

## Why this project exists

Core Home’s Product Development (PD) and Industrial Design (ID) teams coordinate render requests through **Excel spreadsheets and PowerPoint decks**. That workflow is note-heavy, easy to version-confuse (“which file is latest?”), and forces extra email back-and-forth. PD and ID often work from different copies of the truth.

The **Render Portal / Finish Library** is an internal web tool that replaces that process with a **structured, visual dashboard** both teams share. PD builds a spec by choosing finishes from a library; ID receives an unambiguous, visual brief and returns versioned deliverables to the same place.

Think of it like ordering a **Chipotle bowl**: PD picks exactly what they want (material, finish, color, texture, logo treatment) from a visual menu; ID executes from that order without decoding scattered spreadsheet cells.

---

## The problem it solves

| Before (current state) | After (Render Portal) |
|------------------------|------------------------|
| Excel spreadsheets with scattered notes | Structured render request |
| “Which file is latest???” | Version-controlled, timestamped requests |
| Back-and-forth clarification emails | Visual finish selection — less ambiguity |
| Multiple PPTs per project | Single dashboard per project |
| PD and ID not aligned | Shared source of truth |

---

## Teams and roles

| Team | Abbreviation | Role in this tool |
|------|--------------|-------------------|
| Product Development | PD | Places render requests — the “customer” |
| Industrial Design | ID | Fulfills requests — the “kitchen” |
| Graphic Design | GD | Owns the Figma Finish Library (Maria T, Jacinta Correia) |
| Web Development | WD | Builds and deploys the portal (Elombe K) |

---

## Origin: two workstreams merging

This repository unifies two efforts:

**Graphic Design — Maria T & Jacinta Correia (Figma)**

- Visual Finish Library prototype in Figma
- Swatches, materials, textures, and request-flow mockups
- Design source of truth for what finishes exist and how they look

**Elombe K (WD / code)**

- Render Portal web app on Cloudflare (Worker, D1, R2, Access)
- Cursor-assisted development and GitHub for version control

**Goal:** The GD team’s design system (synced via Figma MCP) becomes the UI layer; Elombe’s stack becomes data, API, auth, and deployment.

---

## What lives in this repo

- **Documentation** — this project book (`docs/`)
- **Frontend** — vanilla HTML/CSS/JS in `public/` (evolving toward Figma parity)
- **API** — Cloudflare Worker in `src/index.ts`
- **Data** — D1 schema in `schema.sql`, seed data in `seed.sql`
- **Config** — `wrangler.jsonc`, `.env.example`, Cursor rules

---

[← Project book](README.md) · **Next:** [02 — How it works →](02-how-it-works.md)
