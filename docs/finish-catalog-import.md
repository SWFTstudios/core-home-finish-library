# Factory finish catalog import

Each material comes from its own factory sheet. Sources, column mapping and graphic techniques live in [`data/factory-library-template.json`](../data/factory-library-template.json) (template v5).

| Material | Source file (in `docs/factory/` or `docs/`, not committed) | Sheet | Status |
|----------|-----------------------------------------------------------|-------|--------|
| Ceramic | `Finish_Library_Ceramic_260922.xlsx.txt` | `Ceramic` | Factory confirmed (prices dated 2026-09-22) |
| Glass | `Finish_Library_Ceramic_Glass_Plastic_v3.xlsx` | `Glass` | Internal draft; no factory sheet yet. Carried over from the current catalog when the file is absent |
| Stainless steel | `Finish_Library_Stainless_Steel_261117_pending_factory_review.xlsx.txt` | `Library` | Internal draft sent to the factory 2026-11-17, **pending factory review** |
| Plastic | `Finish_Library_Plastic_261009.xlsx.txt` | `Plastic` | Factory confirmed 2026-10-09; cost bands from factory emails of 2026-10-22 / 10-28 (see below) |

Sources can be `.xlsx` workbooks or text exports of them (`.xlsx.txt`: `## Sheet: <name>` sections with tab-separated rows). The header row is found automatically (the row containing `Finish Name`); headers match exactly or by prefix, so long factory headers such as `Price USD / piece — 14oz mug MOQ: 1,000 pcs` still map.

## Factory updates that came by email

Some factory answers arrive in an email reply, not in an updated sheet. They live in `factoryUpdates` in the template, each with its source and date, and are applied on top of the sheet on every import. When a later factory sheet carries the same information, remove the entry.

| Material | What | Source |
|----------|------|--------|
| Plastic | High-Gloss and Dull/Textured come straight from the mould: no added cost (band A) | Factory email, 22 Oct 2026 |
| Plastic | Pearlescent adds a spray-coating step; quoted per unit (band E, relative to the two above) | Factory email, 28 Oct 2026 |
| Plastic | Quotes are on a 24oz double-wall AS tumbler at **MOQ 2,000 pcs** (not 1,000) | Factory email, 22 Oct 2026 |
| Ceramic | Water-slide decal, precious metal / lustre, direct-to-shape print, sandblast and raised enamel are **not offered by this factory yet**. They are not incompatible with the finishes | Factory email, 23 Sep 2026 |

Finish updates go into `finishes.extensions` (`costNote`, `costBand`, `factoryUpdate`), so the Worker API serves them too. Graphic-technique notes (`availability`, `factoryNote`) and the material `quoteBasis` are in the static catalog only. The D1 tables have no column for them.

## Import workflow

```bash
npm run import:finishes
npm run db:migrate:local   # first time or after schema change
npm run db:seed:local
npm run dev
```

`import:finishes` regenerates [`seed.sql`](../seed.sql) and [`public/api/catalog.json`](../public/api/catalog.json). Do not hand-edit either.

Source sheets are not committed. To rebuild after a template change without them, carry the current catalog over and re-apply `factoryUpdates`:

```bash
node scripts/import-finish-library.mjs --carry-over-missing
```

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

## Finish renders

Each finish can show a product render: a transparent PNG cutout saved as

```
public/assets/renders/<materialSlug>/<finishSlug>.png
```

for example `public/assets/renders/ceramic/ceramic-matte-glaze.png`. When the file exists, the importer sets `imageUrl` on that finish in `catalog.json` and adds an `UPDATE finishes SET image_url = …` line to `seed.sql`. The library cards, the detail panel and the configurator finish wheel show the render instead of the flat colour swatch.

To add or replace renders without re-reading the factory sheets:

```bash
npm run renders:attach   # patches catalog.json, public/api/catalog and seed.sql
```

Factory photos take priority whenever one exists (`imageFieldsFor` in the attach script). The remaining finishes without a factory photo use AI product photos on the same hero silhouette as the 3D models.

### AI product photos (finishes without a factory photo)

**Scope:** 28 finishes (22 glass, 5 stainless steel PVD-reveal, 1 ceramic rubberize). Plastic finishes that are not offered are skipped.

1. Collect references: 3D-exported product shell (`public/assets/<material>/front.png`), a factory photo of the same material for lighting, and the QA 3D render for colour.
2. Generate a 3:4 studio photo (plain white background, no logos or text).
3. Stage the file under `data/ai-photos-raw/<material>/<slug>.jpg`.
4. Run `npm run photos:prepare` — trims, makes the near-white background transparent, writes `public/assets/renders/<material>/<slug>.png`, and updates [`data/ai-photos.json`](../data/ai-photos.json) (`reviewStatus`: `pending` | `approved` | `rejected`).
5. Run `npm run renders:attach` then `npm run render:colors`.

GD / PD review on `/render-qa.html`. Rejected images: regenerate, re-prepare, re-attach. A real factory photo always replaces the AI sample once one exists.

## Validation

```bash
curl -s "http://localhost:8787/api/catalog?material=ceramic" | head -c 500
```

Expect 14 ceramic finishes and 11 `graphicApplicationTypes`; `?material=stainless_steel` returns 114 finishes.

## Finish images: factory photos first, AI renders as fallback

Each finish shows the best image available:

1. **Factory photo.** Real swatch photos extracted from the factory sheets, stored in the R2 bucket `core-home-finish-photos` at `swatches/<material>/<slug>.webp` and served from its public r2.dev URL. [`data/factory-photos.json`](../data/factory-photos.json) lists which finishes have one and which sheet it came from. The photos themselves are **not** in this public repo.
2. **AI render.** `public/assets/renders/<material>/<slug>.png`, used when there is no factory photo.

The catalog records which one a finish uses (`imageSource`: `factory_photo` or `ai_render`; `photoSource`; `renderUrl` for the AI render). The library shows it under "Image", and AI renders are labelled "AI sample render, not a real sample".

Current coverage: 125 factory photos (ceramic 13, stainless 109, plastic 3). Glass has none because no factory sheet came back. Six photos are held back because they show third-party or customer branding (`heldBack` in the manifest); those finishes keep their AI render.

To add or replace photos: extract the images from the sheet, upload them to the bucket under the finish slug, add the slug to the manifest, then run `npm run renders:attach`.
