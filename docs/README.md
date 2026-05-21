# Core Home Render Portal — Project Book

Internal documentation for the **Render Portal / Finish Library**: why it exists, how it works, how to run it, and how the team builds on it.

**Repository:** https://github.com/SWFTstudios/core-home-finish-library  
**Company:** Core Home (NYC housewares)  
**Last updated:** May 2026

---

## Table of contents

| Ch. | Title | For |
|-----|--------|-----|
| [01](01-purpose.md) | Purpose | Stakeholders, new teammates — *why we built this* |
| [02](02-how-it-works.md) | How it works | PD, ID, GD — *day-to-day workflow* |
| [03](03-design-and-figma.md) | Design and Figma | GD, WD — *UI source of truth* |
| [04](04-architecture.md) | Architecture | WD — *system diagram and stack* |
| [05](05-data-model.md) | Data model | WD — *D1 tables and relationships* |
| [06](06-local-setup.md) | Local setup | WD — *run on your machine* |
| [07](07-deployment.md) | Deployment | WD — *Cloudflare production* |
| [08](08-api-reference.md) | API reference | WD — *Worker routes and auth* |
| [09](09-development-workflow.md) | Development workflow | Contributors — *Git, PRs, standards* |
| [10](10-roadmap-and-status.md) | Roadmap and status | Everyone — *what’s done and what’s next* |

---

## Quick links

- **Figma prototype:** [InteractiveFinishLibrary_COPY](https://www.figma.com/design/XY8ZVNYLrbK6OMVWNNqSBt/InteractiveFinishLibrary_COPY)
- **Schema:** [`schema.sql`](../schema.sql)
- **Worker API:** [`src/index.ts`](../src/index.ts)
- **Active todos:** [`INSTRUCTIONS.md`](../INSTRUCTIONS.md)

---

## Read in order

New to the project? Read **01 → 02 → 06**. Implementing UI from design? Read **03** then **06**. Shipping to production? Read **06 → 07 → 08**.
