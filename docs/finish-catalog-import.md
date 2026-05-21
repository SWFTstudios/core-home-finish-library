# Factory finish catalog import

The factory sends a spreadsheet with a **stable column layout** on sheet `Library`. Each delivery updates row data; structure stays the same.

**Canonical file:** [`Finish_Library_2025_AK_10.22 1.xlsx`](Finish_Library_2025_AK_10.22%201.xlsx)

**Template manifest:** [`data/factory-library-template.json`](../data/factory-library-template.json)

## Import workflow

```bash
npm run import:finishes
npm run db:migrate:local   # first time or after schema change
npm run db:seed:local
npm run dev
```

`import:finishes` regenerates [`seed.sql`](../seed.sql) from the xlsx. Do not hand-edit `seed.sql`.

Custom path:

```bash
node scripts/import-finish-library.mjs --input "docs/Your_New_File.xlsx"
```

## What gets written

| Target | Content |
|--------|---------|
| `material_types` | Ceramic, Glass, S. Steel (enabled), Plastic |
| `graphic_application_types` | Five graphic columns from the template |
| `finishes` | One row per factory finish (109 in 2025-AK file) |
| `finish_graphic_compat` | Boolean matrix from spreadsheet |

## UI consumption

The configurator loads **`GET /api/catalog?material=stainless_steel`** — all wheel, carousel, and specs options come from D1, not static JSON in the browser.

## Validation

After seeding, confirm:

```bash
curl -s "http://localhost:8787/api/catalog?material=stainless_steel" | head -c 500
```

Expect `finishes` array length 109 and five `graphicApplicationTypes`.
