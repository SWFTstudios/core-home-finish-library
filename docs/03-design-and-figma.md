# Chapter 3 — Design and Figma

[← 02 — How it works](02-how-it-works.md) · [Project book](README.md) · **Next:** [04 — Architecture →](04-architecture.md)

---

## Figma source file

**File:** [InteractiveFinishLibrary_COPY](https://www.figma.com/design/XY8ZVNYLrbK6OMVWNNqSBt/InteractiveFinishLibrary_COPY)  
**File key:** `XY8ZVNYLrbK6OMVWNNqSBt`  
**Collaborator:** Maria T (Graphic Design)

This file is the **UI and interaction reference** for the Finish Library and configurator. Code in `public/` should converge toward these screens, not the other way around.

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

---

## Shared layout pattern

Every configurator screen follows the same **single-page “bowl builder”** structure:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Finish Library                                          [product thumb]   │
├─────────────────────────────────────────────────────────────────────────────┤
│  (1) Material          │                              │  (2) Finish         │
│  [Ceramic][Glass]      │     CENTER: product hero      │  [search____]     │
│  [SS][Plastic]         │     + finish preview          │  circular swatches│
├────────────────────────┴──────────────────────────────┴───────────────────┤
│  (3) Graphic Application    │  (4) Custom Pattern                          │
│  [search]  ◀ carousel ▶   │                                              │
│  [144×143 cards: Embossed, Debossed, Wax Resist, Laser Decal, …]         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### (1) Material — top left

Component instances (not dropdowns):

- Ceramic, Glass, SS (stainless steel), Plastic  
- Product silhouettes with labels  
- Selected material uses a highlight state

### (2) Finish — top right

- Section label and **search** field  
- **Circular finish picker** — ring of swatches around `#image` / `#imagetwo` preview ellipses on the product

### Center — hero product

- Material-specific large render  
- **SS screen:** front/back views, `FinishSpecs` panel (finish name, durability indicators)  
- Finish choices reflected on the product preview

### (3) Graphic Application — bottom band

- Horizontal **144×143** cards: Embossed, Debossed, Wax Resist, Laser Decal, Silk Print, Embossed + Decal  
- `Wheel_Button` components for carousel navigation  
- Search under the section header

### (4) Custom Pattern

- Tab/section paired with Graphic Application (pattern options in wider layouts)

### TemplatePage extras

- Explicit flow text: **(1) Material → (2) Finish → (3) Graphic Application**  
- Vertical controls on the right edge of the product (finish zones)  
- Pagination / step indicator near finish search

---

## Mapping Figma → data model

| Figma concept | D1 / API |
|---------------|----------|
| Finish swatch | `finishes` row (`hex_color`, `image_url`, `figma_node_id`) |
| Material choice | `product_type` + request context / UI state |
| Zone (body, logo, lid) | `request_finishes.zone` |
| Graphic application card | `finishes` or future `category` / tagging |
| Delivered render file | `renders` + R2 `file_url` |

---

## Figma MCP in Cursor

For design-to-code sync:

```bash
cp .cursor/mcp.json.example .cursor/mcp.json
# Add your Figma API key — never commit mcp.json with real keys
```

Use Figma MCP tools to extract tokens, components, and frame structure. See [09 — Development workflow](09-development-workflow.md).

---

## Gap vs current code

The repo scaffold (`public/index.html`, `library.html`, `request.html`) is a **three-page** app (dashboard, card grid, form). The Figma design is a **single full-screen configurator** with a finish wheel and SS-specific panels. Closing that gap is on the [roadmap](10-roadmap-and-status.md).

---

[← 02 — How it works](02-how-it-works.md) · **Next:** [04 — Architecture →](04-architecture.md)
