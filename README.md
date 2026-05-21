# Core Home — Render Portal / Finish Library

Internal tool for Core Home (NYC housewares) that replaces Excel and PowerPoint render specs with a **visual Finish Library** and a shared **PD ↔ ID** dashboard.

**Read the project book →** [docs/README.md](docs/README.md)

---

## Quick start

```bash
git clone https://github.com/SWFTstudios/core-home-finish-library.git
cd core-home-finish-library
npm install
npm run db:migrate:local && npm run db:seed:local
npm run dev
```

Open the URL Wrangler prints (usually `http://localhost:8787`).

**Finish Library configurator (SS):** [http://localhost:8787/configurator.html](http://localhost:8787/configurator.html) — requires `npm run import:finishes` and `db:seed:local`.

**Finish Library (Pages):** [https://core-home-finish-library.pages.dev/](https://core-home-finish-library.pages.dev/) — `/` opens the configurator; deploy with `npm run pages:deploy` or push to `main` (see [phased deployment](docs/phased-deployment.md)).

---

## Documentation

| Resource | Description |
|----------|-------------|
| [Project book](docs/README.md) | Full documentation — purpose, workflow, setup, API |
| [Ch. 9 — Development workflow](docs/09-development-workflow.md) | **Version-control bible** — Git, PRs, design + engineering handoff |
| [INSTRUCTIONS.md](INSTRUCTIONS.md) | Active todos for contributors and AI assistants |
| [Figma design](https://www.figma.com/design/XY8ZVNYLrbK6OMVWNNqSBt/InteractiveFinishLibrary_COPY) | UI reference (GD: Maria T, Jacinta Correia) |

**Chapters:** [Purpose](docs/01-purpose.md) · [How it works](docs/02-how-it-works.md) · [Development workflow](docs/09-development-workflow.md) · [Local setup](docs/06-local-setup.md) · [Deployment](docs/07-deployment.md) · [Roadmap](docs/10-roadmap-and-status.md)

---

## Stack

Cloudflare Workers · D1 · R2 · Access · vanilla HTML/CSS/JS

---

## Team

**WD** — Elombe Kisala · **GD** — Maria T, Jacinta Correia · **PD / ID** — Core Home product and design teams
