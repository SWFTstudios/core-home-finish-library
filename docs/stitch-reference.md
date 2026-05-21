# Stitch design reference

Vendored export from Google Stitch (`stitch_core_home_finish_library`), aligned with the Figma Finish Library prototype.

**Location:** [`reference/stitch-core-home-finish-library/`](../reference/stitch-core-home-finish-library/)

## Lumina design systems

| Folder | Theme | Used in configurator |
|--------|--------|----------------------|
| `lumina_finish_system/` | Light — Hanken Grotesk, `#f9f9ff` | `data-lumina-theme="light"` |
| `lumina_finish/` | Dark — Geist, `#051424` | `data-lumina-theme="dark"` |

Tokens are implemented in [`public/css/lumina-finish.css`](../public/css/lumina-finish.css).

## Layout reference screens

| File | Purpose |
|------|---------|
| `finish_library_dashboard/screen.png` | Light desktop layout QA |
| `finish_library_dashboard_dark_mode/screen.png` | Dark desktop layout QA |
| `finish_library_mobile/screen.png` | Mobile stack |
| `finish_library_mobile_dark_mode/screen.png` | Mobile dark |

## Stitch MCP (Cursor)

Use the **HTTP** Stitch server with an API key (not OAuth-only), so agents get tools like `list_projects`, `get_screen`, and `export_frontend`.

1. Create a key at [Stitch settings](https://stitch.withgoogle.com/settings) → API Keys.
2. Copy [`.cursor/mcp.json.example`](../.cursor/mcp.json.example) to `.cursor/mcp.json` (gitignored) and set `X-Goog-Api-Key`.
3. In **Cursor → Settings → MCP**, enable **stitch** and run **Reload MCP** (or restart Cursor).
4. Confirm tools appear (not “No tools, prompts, or resources”).

Expected Stitch project: **Core Home Finish Library** (`projects/13547050496274311906`).

**MCP export cache:** [`reference/stitch-mcp-specs/`](../reference/stitch-mcp-specs/) — `screens.json`, HTML from `list_screens` / `htmlCode.downloadUrl`. Refresh with `npm run fetch:stitch-specs`.

**UI parity:** [`public/configurator.html`](../public/configurator.html) layout matches Stitch *Finish Library Dashboard* (12-col grid, app bar, finish dial, graphic shelf). Tokens in [`public/css/lumina-finish.css`](../public/css/lumina-finish.css) are copied from the Stitch HTML `tailwind.config` export.

## Sync

Re-copy from Stitch when GD publishes an updated export. Do not edit `DESIGN.md` in place — replace the folder and re-diff tokens in `lumina-finish.css` if colors change.
