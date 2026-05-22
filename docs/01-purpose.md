# Chapter 1 — Purpose

[← Project book](README.md) · **Next:** [02 — How it works →](02-how-it-works.md)

**Plain language summary:** Core Home built this tool so teams stop emailing Excel files and start sharing one visual place to pick finishes and render specs.

---

## Why this project exists

Core Home's Product Development (PD) and Industrial Design (ID) teams coordinate render requests through **Excel spreadsheets and PowerPoint decks**. That workflow is note-heavy, easy to version-confuse ("which file is latest?"), and forces extra email back-and-forth. PD and ID often work from different copies of the truth.

The **Render Portal / Finish Library** is an internal web tool that replaces that process with a **structured, visual dashboard** both teams share. PD builds a spec by choosing finishes from a library; ID receives an unambiguous, visual brief and returns versioned deliverables to the same place.

Think of it like ordering a **Chipotle bowl**: PD picks exactly what they want (material, finish, color, texture, logo treatment) from a visual menu; ID executes from that order without decoding scattered spreadsheet cells.

---

## Live today (May 2026)

The **Finish Library configurator** is deployed and usable:

- **URL:** [https://core-home-finish-library.pages.dev/](https://core-home-finish-library.pages.dev/)
- **What works:** Material tabs, scrollable finish wheel, search and filters, graphic application shelf, live 3D preview, specs card
- **What is next:** Full render-request dashboard, file uploads, and team login via Cloudflare Access (Phase 2)

Anyone on the team can open the link and explore finishes without installing software. Sales and leadership can use it to see how finishes are presented to PD and ID.

---

## The problem it solves

| Before (current state) | After (Render Portal) |
|------------------------|------------------------|
| Excel spreadsheets with scattered notes | Structured render request |
| "Which file is latest???" | Version-controlled, timestamped requests |
| Back-and-forth clarification emails | Visual finish selection — less ambiguity |
| Multiple PPTs per project | Single dashboard per project |
| PD and ID not aligned | Shared source of truth |

---

## Teams and roles

| Team | Abbreviation | Role in this tool |
|------|--------------|-------------------|
| Product Development | PD | Places render requests — the "customer" |
| Industrial Design | ID | Fulfills requests — the "kitchen" |
| Graphic Design | GD | Owns the Figma Finish Library (Maria T, Jacinta Correia) |
| Web Development | WD | Builds and deploys the portal (Elombe Kisala) |
| Sales | Sales | References finish names and visuals in customer conversations |
| IT / DevOps | IT | Cloudflare accounts, Access policies, deploy pipelines |
| Leadership | C-Suite | Sponsorship, adoption, prioritization |

---

## Origin: two workstreams merging

This repository unifies two efforts:

**Graphic Design — Maria T & Jacinta Correia (Figma)**

- Visual Finish Library prototype in Figma
- Swatches, materials, textures, and request-flow mockups
- Design source of truth for what finishes exist and how they look

**Elombe Kisala (WD / code)**

- Render Portal web app on Cloudflare (Worker, D1, R2, Access)
- Cursor-assisted development and GitHub for version control

**Goal:** The GD team's design system (synced via Figma MCP) becomes the UI layer; the WD stack becomes data, API, auth, and deployment.

---

## What lives in this repo

| Area | Location | Purpose |
|------|----------|---------|
| Documentation | `docs/` | This project book |
| Configurator UI | `public/configurator/`, `public/css/configurator.css`, `public/js/` | Finish Library experience |
| API | `src/index.ts` | Cloudflare Worker |
| Data | `schema.sql`, `seed.sql`, `public/api/catalog` | D1 schema + static catalog for Pages |
| Config | `wrangler.jsonc`, `.env.example` | Deploy and bindings |

---

[← Project book](README.md) · **Next:** [02 — How it works →](02-how-it-works.md)
