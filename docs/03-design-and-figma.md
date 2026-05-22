# Chapter 3 — Design and Figma

[← 02 — How it works](02-how-it-works.md) · [Project book](README.md) · **Next:** [04 — Architecture →](04-architecture.md)

**Plain language summary:** Figma is where Graphic Design defines how the Finish Library should look; the live website is catching up to the `study_SS` screen, and this chapter explains what matches today and what is still different.

---

## Figma source file

**For: GD, WD**

**File:** [InteractiveFinishLibrary_COPY](https://www.figma.com/design/XY8ZVNYLrbK6OMVWNNqSBt/InteractiveFinishLibrary_COPY)  
**File key:** `XY8ZVNYLrbK6OMVWNNqSBt`  
**Graphic Design team:** Maria T, Jacinta Correia

This file is the **UI and interaction reference** for the Finish Library and configurator. Code in `public/` should converge toward these screens, not the other way around.

**How design changes land in `main`:** [09 — Development workflow](09-development-workflow.md) (Figma link + PR screenshots + preview URL → merge).

---

## What's implemented vs. Figma (May 2026)

| Figma (`study_SS` / `SS`) | Live configurator | Notes |
|---------------------------|-------------------|--------|
| Single full-screen layout | Yes | `/configurator/` |
| Material tabs (top) | Yes | Ceramic, Glass, S. Steel, Plastic |
| Finish wheel (right) | Yes | Scroll, fade, arc offset, active state |
| Finish search + filters | Yes | Sort and 2×2 filter grid in search card |
| Graphic Application shelf | Yes | Bottom center HUD card |
| Specs / durability panel | Yes | Left `specs-card` |
| Product hero (photo/render) | Partial | **Three.js cube** stand-in, not final tumbler mesh |
| SS front/back views | Not yet | Single 3D viewport |
| Custom Pattern section | Not yet | Shelf only |
| Circular ring picker (exact Figma geometry) | Partial | Vertical wheel + arc styling |

**Primary frame for QA:** `study_SS` / `SS` at 1920×1080.

---

## HUD layout (live code)

**For: GD, WD**

Implemented in [`public/css/configurator.css`](../public/css/configurator.css) on [`public/configurator/index.html`](../public/configurator/index.html).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Core Home navbar — Library | Projects | Standards | theme | profile        │
├─────────────────────────────────────────────────────────────────────────────┤
│  [Material tabs]              │                              │ Finish Selector│
│                               │     3D preview (WebGL)       │  (scroll wheel)│
│  LEFT: specs card             │                              │  + search card │
│  durability, cost, notes      │                              │                │
├───────────────────────────────┴──────────────────────────────┴────────────────┤
│  [zoom pill]   GRAPHIC APPLICATION shelf (carousel cards)                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Panel | CSS / DOM | Behavior |
|-------|-----------|----------|
| Left specs | `.hud-panel--left`, `.specs-card` | Fixed card; does not grow with long finish names |
| Right wheel | `.finish-panel`, `#wheel-viewport`, `#wheel-list` | Transparent rail (~22% width); does not block 3D |
| Search card | `.finish-dial-search` | Aligned with top of graphic shelf on desktop |
| Bottom shelf | `.hud-panel--bottom`, `.graphic-shelf` | Graphic application cards |
| Zoom pill | `.preview-zoom` | Left of shelf; zoom + 360° rotate |
| Wheel arrows | `.wheel-controls` | Track vertical focus line of active finish |

**3D viewport:** [`public/js/configurator-preview-3d.js`](../public/js/configurator-preview-3d.js) — cube stand-in until product GLTF. Theme sync via `lumina-theme-change` from the navbar.

---

## Comparing design to the live site (GD checklist)

**For: GD**

1. Open Figma frame **`study_SS`** side by side with [live configurator](https://core-home-finish-library.pages.dev/configurator/).
2. Check material tabs, wheel position, shelf labels, and typography against Lumina tokens in `public/css/`.
3. Use reference screenshots in [`inspiration/viewport-hud/`](../inspiration/viewport-hud/) — e.g. search/shelf alignment before/after fixes.
4. Log gaps in a GitHub issue or PR comment with **frame name + screenshot + expected behavior**.
5. Do not change production CSS without a PR; link the Figma node in the PR description.

---

## Prototype note

The file includes copy that **any material can be opened to preview the layout**, but in the test prototype **only stainless steel (SS) supports full customization**. When implementing features, treat the **`SS` / `study_SS` frames** as the primary interactive reference.

---

## Main screens (1920×1080)

| Frame | Role |
|-------|------|
| `study_HomePage` | Entry / overview with onboarding copy |
| `TemplatePage` | Full template with flow labels |
| `study_Glass` / `Glass` | Glass material path |
| `study_Plastic` / `Plastic` | Plastic material path |
| `study_SS` / `SS` | **Full SS customization** (primary build target) |
| `study_Ceramic` / `Ceramic` | Ceramic path (+ finish variants) |
| `study_Finish Option - Buckets` | Finish bucket exploration |

**Standards library (`/library.html`)** maps the bucket model to **Material → Process → Style family**, then finish cards. Process labels align with catalog `category` / `finish_process`; style families are grouped in [`public/js/library-grouping.js`](../public/js/library-grouping.js).

---

## Mapping Figma → data model

| Figma concept | D1 / API |
|---------------|----------|
| Finish swatch | `finishes` row (`hex_color`, `image_url`, `figma_node_id`) |
| Material choice | `material_types` + UI state |
| Graphic application card | `graphic_application_types` + `finish_graphic_compat` |
| Delivered render file | `renders` + R2 `file_url` (Phase 2) |

---

## Figma MCP in Cursor

**For: WD**

```bash
cp .cursor/mcp.json.example .cursor/mcp.json
# Add your Figma API key — never commit mcp.json with real keys
```

Use Figma MCP tools to extract tokens, components, and frame structure. See [09 — Development workflow](09-development-workflow.md).

---

[← 02 — How it works](02-how-it-works.md) · **Next:** [04 — Architecture →](04-architecture.md)
