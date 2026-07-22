# Factory finish catalog import

The factory sends a spreadsheet with a **stable column layout**. Each delivery updates row data; structure stays the same.

**Stainless steel:** [`Finish_Library_2025_AK_10.22 1.xlsx`](Finish_Library_2025_AK_10.22%201.xlsx) (sheet `Library`)

**Ceramic / Glass / Plastic:** [`Finish_Library_Ceramic_Glass_Plastic_v3.xlsx`](Finish_Library_Ceramic_Glass_Plastic_v3.xlsx) (sheets `Ceramic`, `Glass`, `Plastic`)

**Cost verification (ceramic demo):** [`Finish_Library_Ceramic_Index_vs_Bands.xlsx`](Finish_Library_Ceramic_Index_vs_Bands.xlsx) (sheet `Factory Verification`; gitignored with other factory xlsx). Committed fallback: [`data/ceramic-factory-verification.json`](../data/ceramic-factory-verification.json).

**Template manifest:** [`data/factory-library-template.json`](../data/factory-library-template.json)

## Import workflow

```bash
npm run import:finishes
npm run db:migrate:local   # first time or after schema change (includes 006_cost_verification.sql)
npm run db:seed:local
npm run dev
```

`import:finishes` reads the SS workbook, CGP workbook, and (when present) the verification workbook, then regenerates [`seed.sql`](../seed.sql) and [`public/api/catalog.json`](../public/api/catalog.json). Do not hand-edit `seed.sql`.

When factory capability xlsx files are missing locally, the importer falls back to rebuilding from the existing catalog:

```bash
npm run import:finishes -- --from-catalog
```

Custom paths:

```bash
node scripts/import-finish-library.mjs \
  --input-ss "docs/Your_SS.xlsx" \
  --input-cgp "docs/Your_CGP.xlsx" \
  --input-verify "docs/Finish_Library_Ceramic_Index_vs_Bands.xlsx"
```

Remote D1 after import:

```bash
npm run db:seed
npm run deploy
npm run pages:deploy
```

## Cost bands + factory verification

Factories quote **one real number per finish** — the extra cost per piece (`unit_price_adder`) on an agreed **reference piece + MOQ**. That euro value lives on the verification sheet and is written to **seed/D1 only**.

| Public (catalog / API / UI) | Private (seed / D1 only) |
|-----------------------------|--------------------------|
| `costBand` letter A–H | `unit_price_adder` (€/pc) |
| `costBands` range key per material | `cost_index` (optional) |
| `verifiedStatus`, `factoryComments` | |
| `referencePiece`, `referenceMoq` | |

Band thresholds are provisional until real factory quotes land; defaults live under `costBands` in the template and can be overridden by the verification sheet's `Band` / `From (€/pc)` mini-table.

Migration: [`migrations/006_cost_verification.sql`](../migrations/006_cost_verification.sql)

## What gets written

| Target | Content |
|--------|---------|
| `material_types` | Ceramic, Glass, S. Steel, Plastic + reference piece / MOQ |
| `cost_bands` | Per-material A–H (or A–F) euro thresholds |
| `graphic_application_types` | Per-material graphic columns (SS: 5; Ceramic: 6; Glass: 6; Plastic: 4) |
| `finishes` | One row per finish with `material_slug` (150 total: 109 SS + 9 + 22 + 10) plus private euro / public band when verified |
| `finish_graphic_compat` | Boolean matrix from spreadsheet |

## UI consumption

The configurator and library load **`GET /api/catalog?material=…`** (or the static `public/api/catalog` snapshot on Pages). Specs and cards show the **cost band letter** and a **band-range key** — never the euro adder.

## Validation

After seeding, confirm:

```bash
curl -s "http://localhost:8787/api/catalog?material=ceramic" | head -c 800
```

Expect ceramic finishes with `costBand` (e.g. Glossy Glaze → `B`), a `costBands.ceramic` array, and **no** `unitPriceAdder` field in the JSON.
