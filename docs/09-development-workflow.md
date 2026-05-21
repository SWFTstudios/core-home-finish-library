# Chapter 9 — Development workflow

[← 08 — API reference](08-api-reference.md) · [Project book](README.md) · **Next:** [10 — Roadmap and status →](10-roadmap-and-status.md)

---

## Before you start

1. Read [01 — Purpose](01-purpose.md) for product context.  
2. Read [03 — Design and Figma](03-design-and-figma.md) if touching UI.  
3. Check active items in [`INSTRUCTIONS.md`](../INSTRUCTIONS.md).  
4. Follow [`.cursorrules`](../.cursorrules) when using Cursor.

---

## Git workflow

| Rule | Detail |
|------|--------|
| Default branch | `main` — keep production-ready |
| Feature branches | `feature/<short-slug>` |
| Fixes | `fix/<short-slug>` |
| Housekeeping | `chore/<short-slug>` |
| Docs only | `docs/<short-slug>` |

Sync from `main` before starting work. Keep PRs small and focused.

---

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — new capability  
- `fix:` — bug fix  
- `docs:` — documentation only  
- `chore:` — tooling, deps  
- `refactor:` — behavior-preserving restructure  
- `test:` — tests  

One logical change per commit; message explains **why**.

**Do not:** force-push `main`, skip hooks without approval, commit secrets, or amend pushed commits unless explicitly requested.

---

## Pull requests

When opening a PR (human-requested only):

- Summary of what and why  
- Test plan (commands run, pages checked)  
- Screenshots for UI changes  
- Link related Figma frames if applicable  

Use `gh` for GitHub operations when asked.

---

## Definition of done

- [ ] Matches existing code style and patterns  
- [ ] Visual-first UX for PD-facing surfaces (see [02 — How it works](02-how-it-works.md))  
- [ ] D1 changes use SQLite syntax; UUIDs via `crypto.randomUUID()` in Worker  
- [ ] No secrets in git (`.env`, `mcp.json` with keys)  
- [ ] `npm run check` passes when Wrangler config changed  
- [ ] `INSTRUCTIONS.md` / [10 — Roadmap](10-roadmap-and-status.md) updated if scope shifted  
- [ ] Relevant project book chapter updated if behavior or setup changed  

---

## Code standards

- **Smallest correct diff** — no drive-by refactors  
- **Reuse** existing helpers and conventions in `public/` and `src/`  
- **Comments** only for non-obvious business rules  
- **Tests** when behavior is non-trivial (not required for trivial scaffolding)  
- **Accessibility** — semantic HTML, keyboard-friendly controls where possible  

---

## Secrets and environment

| File | Purpose |
|------|---------|
| [`.env.example`](../.env.example) | Documented env vars |
| [`.cursor/mcp.json.example`](../.cursor/mcp.json.example) | Figma MCP template |

Never commit filled-in `.env` or `.cursor/mcp.json`.

---

## Figma MCP setup

```bash
cp .cursor/mcp.json.example .cursor/mcp.json
# Add Figma API key locally
```

Use MCP to pull design context from [InteractiveFinishLibrary_COPY](https://www.figma.com/design/XY8ZVNYLrbK6OMVWNNqSBt/InteractiveFinishLibrary_COPY). Map `figma_node_id` when adding finishes to D1.

---

## Documentation changes

Product and technical docs live in **`docs/`** (this book). When you change setup, API, or architecture:

- Update the relevant chapter  
- Keep [`README.md`](../README.md) as a short hub  
- Use `INSTRUCTIONS.md` only for **active todos**, not long-form spec  

Suggested commit prefix: `docs:`.

---

## Session handoff

Before ending a session with open work:

- Note branch name and blockers in `INSTRUCTIONS.md` if needed  
- List follow-up commands (`npm run dev`, migrations, etc.)  

---

[← 08 — API reference](08-api-reference.md) · **Next:** [10 — Roadmap and status →](10-roadmap-and-status.md)
