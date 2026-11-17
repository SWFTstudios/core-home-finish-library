# Factory finish catalog import

Each material comes from its own factory sheet. Sources, column mapping and graphic techniques live in [`data/factory-library-template.json`](../data/factory-library-template.json) (template v4).

| Material | Source file (in `docs/factory/` or `docs/`, not committed) | Sheet | Status |
|----------|-----------------------------------------------------------|-------|--------|
| Ceramic | `Finish_Library_Ceramic_260922.xlsx.txt` | `Ceramic` | Factory confirmed (prices dated 2026-09-22) |
| Glass | `Finish_Library_Ceramic_Glass_Plastic_v3.xlsx` | `Glass` | Internal draft; no factory sheet yet. Carried over from the current catalog when the file is absent |
| Stainless steel | `Finish_Library_Stainless_Steel_261117_pending_factory_review.xlsx.txt` | `Library` | Internal draft sent to the factory 2026-11-17, **pending factory review** |
| Plastic | `Finish_Library_Plastic_261009.xlsx.txt` | `Plastic` | Factory confirmed 2026-10-09; prices still TBC |

Sources can be `.xlsx` workbooks or text exports of them (`.xlsx.txt`: `## Sheet: <name>` sections with tab-separated rows). The header row is found automatically (the row containing `Finish Name`); headers match exactly or by prefix, so long factory headers such as `Price USD / piece — 14oz mug MOQ: 1,000 pcs` still map.

## Import workflow

```bash
npm run import:finishes
npm run db:migrate:local   # first time or after schema change
npm run db:seed:local
npm run dev
```

`import:finishes` regenerates [`seed.sql`](../seed.sql) and [`public/api/catalog.json`](../public/api/catalog.json). Do not hand-edit either.

Override one source:

```bash
node scripts/import-finish-library.mjs --source ceramic=docs/factory/Your_Ceramic.xlsx
```

Remote D1 after import:

```bash
npm run db:seed
npm run deploy
npm run pages:deploy
```

## What gets written

| Target | Content |
|--------|---------|
| `material_types` | Ceramic, Glass, S. Steel, Plastic |
| `graphic_application_types` | Per-material techniques (SS: 5; Ceramic: 11; Glass: 6; Plastic: 4) |
| `finishes` | 160 rows (114 SS + 14 ceramic + 22 glass + 10 plastic) |
| `finishes.extensions` | JSON: `availability`, `reviewStatus`, `costBand`, `graphicAdhesion`, `microwaveSafe`, `dishwasherSafe`, `colourLimitation`, `printingLimitations`, `matteGlossyOk` |
| `finish_graphic_compat` | Boolean matrix from the ✓ / ✗ (or TRUE / FALSE) columns |

Mapping notes:

- `durabilityNotes` comes from **Finish Description & Surface Character** (old sheets: **Durability / Finish Notes**); production notes are appended to `description`.
- Price bands: `$`–`$$$$$` where the sheet has them (stainless steel). Ceramic and plastic use the factory **Cost Band** A–E, shown as `Band A` with `costTier` 1–5. Bands are relative within one material.
- Finishes listed under "Finishes currently not available" get `availability: "not_offered"` and are hidden in the configurator and library.
- TBC, "Not offered" and similar placeholders become `null`.

## Prices and public output

The factory USD unit prices are read but **not written** by default, because `public/api/catalog` is served publicly and this repository is public. Pass `--include-usd-prices` to add `priceUsd` once the catalog is behind Cloudflare Access. The importer also refuses to write output that contains client names.

## Validation

```bash
curl -s "http://localhost:8787/api/catalog?material=ceramic" | head -c 500
```

Expect 14 ceramic finishes and 11 `graphicApplicationTypes`; `?material=stainless_steel` returns 114 finishes.
