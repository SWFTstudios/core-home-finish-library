# Factory finish catalog import

The factory sends a spreadsheet with a **stable column layout** on sheet `Library`. Each delivery updates row data; structure stays the same.

**Stainless steel:** [`Finish_Library_2025_AK_10.22 1.xlsx`](Finish_Library_2025_AK_10.22%201.xlsx) (sheet `Library`)

**Ceramic / Glass / Plastic:** [`Finish_Library_Ceramic_Glass_Plastic_v3.xlsx`](Finish_Library_Ceramic_Glass_Plastic_v3.xlsx) (sheets `Ceramic`, `Glass`, `Plastic`)

**Template manifest:** [`data/factory-library-template.json`](../data/factory-library-template.json)

## Import workflow

```bash
npm run import:finishes
npm run db:migrate:local   # first time or after schema change
npm run db:seed:local
npm run dev
```

`import:finishes` reads the SS workbook and `docs/Finish_Library_Ceramic_Glass_Plastic_v3.xlsx` by default, regenerates [`seed.sql`](../seed.sql) and [`public/api/catalog.json`](../public/api/catalog.json). Do not hand-edit `seed.sql`.

Custom paths:

```bash
node scripts/import-finish-library.mjs --input-ss "docs/Your_SS.xlsx" --input-cgp "docs/Your_CGP.xlsx"
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
| `material_types` | Ceramic, Glass, S. Steel, Plastic (all enabled after v3 import) |
| `graphic_application_types` | Per-material graphic columns (SS: 5; Ceramic: 6; Glass: 6; Plastic: 4) |
| `finishes` | One row per finish with `material_slug` (150 total: 109 SS + 9 + 22 + 10) |
| `finish_graphic_compat` | Boolean matrix from spreadsheet |

## UI consumption

The configurator loads **`GET /api/catalog?material=stainless_steel`** — all wheel, carousel, and specs options come from D1, not static JSON in the browser.

## Validation

After seeding, confirm:

```bash
curl -s "http://localhost:8787/api/catalog?material=stainless_steel" | head -c 500
```

Expect `finishes` array length 109 and five `graphicApplicationTypes`.
