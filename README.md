# Core Home — Render Portal / Finish Library

**In plain language:** Core Home teams used to share render specs in Excel and PowerPoint. This project is a shared web app where you **pick a material, scroll through finishes, choose a graphic treatment, and see a live 3D preview** — so Product Development and Industrial Design work from the same visual source of truth.

**Read the project book →** [docs/README.md](docs/README.md)

---

## Live site (Phase 1)

| What | URL |
|------|-----|
| **Finish Library configurator** | [https://core-home-finish-library.pages.dev/](https://core-home-finish-library.pages.dev/) |
| Opens at | `/configurator/` (home redirects automatically) |
| Catalog data | Static JSON at `/api/catalog` (108 finishes) — works without a live database |

Push to `main` deploys via GitHub Actions. See [Deployment](docs/07-deployment.md).

---

## Quick start (developers)

```bash
git clone https://github.com/SWFTstudios/core-home-finish-library.git
cd core-home-finish-library
npm install
npm run dev
```

Open **http://localhost:8787/configurator/** — finishes load from the bundled catalog; no database setup required for the configurator UI.

**Optional (full API + dashboard):** `npm run db:migrate:local && npm run db:seed:local` for D1-backed routes (`/api/requests`, profiles, etc.).

---

## What you can do today

| Feature | Status |
|---------|--------|
| Material tabs (Ceramic, Glass, S. Steel, Plastic) | Live |
| Finish scroll wheel with search, sort, and filters | Live |
| Graphic application shelf | Live |
| Real-time 3D preview (Three.js) with light/dark theme | Live |
| Specs card (durability, cost, notes) | Live |
| Cloudflare Pages deploy | Live |
| Render request dashboard + file uploads | Needs Phase 2 Worker + D1 + R2 |

---

## Documentation

| Resource | Who it's for |
|----------|----------------|
| [Project book](docs/README.md) | Everyone — read like a book, chapter by chapter |
| [Ch. 1 — Purpose](docs/01-purpose.md) | C-Suite, new teammates — *why we built this* |
| [Ch. 2 — How it works](docs/02-how-it-works.md) | PD, ID, Sales — *what you see on screen* |
| [Ch. 9 — Development workflow](docs/09-development-workflow.md) | WD, IT — Git, PRs, design handoff |
| [INSTRUCTIONS.md](INSTRUCTIONS.md) | Contributors — active todos |
| [Figma design](https://www.figma.com/design/XY8ZVNYLrbK6OMVWNNqSBt/InteractiveFinishLibrary_COPY) | GD — UI reference (Maria T, Jacinta Correia) |

**More chapters:** [Local setup](docs/06-local-setup.md) · [Deployment](docs/07-deployment.md) · [Roadmap](docs/10-roadmap-and-status.md)

---

## Stack

Cloudflare Pages · Workers · D1 · R2 · Access · vanilla HTML/CSS/JS · Three.js (3D preview)

---

## Team

**WD** — Elombe Kisala · **GD** — Maria T, Jacinta Correia · **PD / ID** — Core Home product and design teams
