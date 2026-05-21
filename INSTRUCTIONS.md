# Core Home Finish Library — Instructions

Living document for humans and AI assistants. Update this file when priorities, architecture, or workflow change.

## Active to-do items

- [ ] Define library scope (finishes, materials, swatches, metadata schema)
- [ ] Choose stack and folder layout (e.g. `packages/`, `data/`, `docs/`)
- [ ] Add `.env.example` when external services are introduced
- [ ] Set up CI (lint / test / build) once code exists
- [ ] Publish initial consumer documentation in `README.md`

## Repository workflow

| Step | Action |
|------|--------|
| Start work | Read this file + `.cursorrules`; branch from `main` |
| During work | Small commits; conventional commit messages |
| Finish work | Run checks; open PR (when user requests); update todos here |
| Release | Merge to `main` only when stable; tag releases if versioning applies |

## Branch strategy

- `main` — deployable / canonical
- `feature/*` — new capability
- `fix/*` — bug fixes
- `chore/*` — tooling, deps, housekeeping
- `docs/*` — documentation only

## Definition of done

- [ ] Change matches existing project conventions
- [ ] No secrets or local paths committed
- [ ] Lint / test / build pass (when configured)
- [ ] `INSTRUCTIONS.md` todos updated if scope shifted
- [ ] README or inline docs updated if public API or usage changed

## Project notes

_Add decisions here (schema format, naming conventions, export targets, design tool integrations, etc.) as the library grows._

## Links

- Remote: `https://github.com/SWFTstudios/core-home-finish-library` (after first push)
- Primary maintainer: configure in GitHub repository settings
