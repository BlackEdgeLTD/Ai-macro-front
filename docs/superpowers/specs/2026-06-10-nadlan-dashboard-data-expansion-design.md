# Nadlan Dashboard — Full Data Extraction Expansion

**Date:** 2026-06-10
**Status:** Approved design, pending implementation
**Goal:** Surface every analysis the collected data supports but the dashboard doesn't show — census demographics, street-level prices, floor/rooms/subtype structure.

## Context

The deployed dashboard (`Ai-macro-front/public/nadlan/{index,macro,rent}.html`) is a self-contained static HTML built by the **nadlan-service** pipeline:

- Build script: `/Users/avichay/Downloads/knowledgebase/complaince/nadlan-service/scripts/05_build_dashboard.py` (591 lines)
- Template: `.../scripts/dashboard_template.html` (1,188 lines; tabs: t-overview, t-national, t-buy, t-rent, t-compare, t-quality)
- DB: `.../data/nadlan_transactions.sqlite` (same schema as the copy in `Ai-macro-front/src/nadlan/`)
- Data embedding: aggregates packed as JSON, gzip+base64 (`pako` decompresses client-side); charts via Chart.js 4.4, maps via Leaflet.

Output is copied into `Ai-macro-front/public/nadlan/` and served via Next.js rewrites (`/nadlan` → `/nadlan/index.html`).

### Unused data confirmed in the DB

| Dataset | Size | Current usage |
|---|---|---|
| `census_2022_statarea` | 2,193 stat areas × ~60 demographic columns | Only national avg wage (1 KPI) + per-locality wage |
| Street fields on transactions | 5,164 distinct streets, 223,867 tx (86%) | None |
| `floor_no` | 243,978 tx (94%), Hebrew ordinals, 1,178 distinct raw values | None |
| `asset_room_num` | 97% coverage | Partial (filter only) |
| `deal_nature` | Property subtype (דירה בבית קומות, קוטג', דירת גן, פנטהאוז…), 90% coverage | None |
| Census ↔ transactions join | `clean_transactions.yishuv_stat_2022 = census_2022_statarea.our_yishuv_stat_2022`, **89% of clean tx (231,529) match** | Unused |

### Not supported (dropped from scope)

- **Building age:** `year_built` is 100% NULL across all 285K rows. Noted as a future collection target; no dashboard work.
- **New-build vs second-hand:** `deal_nature` is subtype, not sale-order. Replaced by subtype premium analysis.

## Approach (chosen: A)

Extend the nadlan-service build pipeline — new aggregate computations in `05_build_dashboard.py`, new tab + sections in `dashboard_template.html` — rebuild, copy output to `Ai-macro-front/public/nadlan/`. Reproducible across future data refreshes.

Rejected: hand-editing the deployed 8.8MB HTML (wiped on next rebuild); runtime-loaded JSON (architecture change for no benefit).

## New content

### New tab 1: 🧬 דמוגרפיה ושכונות (Demographics × Prices)

All charts join census stat areas to price stats computed from `clean_transactions` over the **last 3 years**, with a **minimum 20 deals per stat area** to be plotted. Census TEXT columns are cast via `CAST(NULLIF(col,'') AS REAL)`.

1. **Wage ↔ price scatter** — x: `employeesAnnual_medWage`, y: median ₪/m² per stat area, point size: deal count, color: city. Tooltip: area id, city, wage, price, deals. Reveals over/under-priced areas relative to local income.
2. **Affordability by area** — years-to-buy = (median deal_amount) / (median annual wage) per stat area. Horizontal bar of 15 hardest + 15 easiest areas, plus full searchable table.
3. **Education ↔ price scatter** — x: `AcadmCert_pcnt`, y: median ₪/m²; second series: 5-year price appreciation % (areas with ≥20 deals in both windows).
4. **Renter share ↔ yield scatter** — x: `rent_pcnt` (renter household %), y: gross yield (annual rent from `rent_monthly` settlement/neighborhood join ÷ median price). Only areas where a rent series matches; if neighborhood-level rent match is too sparse, fall back to settlement-level yield with a note.
5. **Area profile table** — searchable/sortable: stat area, city, population (`pop_approx`), density, median age, household size (`size_avg`), wage, academic %, own %, rent %, median ₪/m², deal count, YoY. One row per stat area with ≥20 deals.

### New tab 2: 🛣️ רחובות ומבנה (Streets & Property Structure)

6. **Street league table** — aggregate `clean_transactions` by (city, street): median ₪/m², median price, deal count, last-3y YoY. **Threshold: ≥15 deals.** Searchable + sortable; per-city top-10 most expensive / cheapest streets as quick chips. Streets are city-scoped (same name across cities = separate rows).
7. **Floor premium curve** — normalize `floor_no` Hebrew ordinals → integers (קרקע=0, ראשונה=1 … עשרים=20; multi-part values like "ראשונה+מרתף" take the primary dwelling floor; unparseable → excluded, with parse-rate reported in the quality tab). Line chart: median ₪/m² by floor (0–20+) nationally + selectable per city, apartments only (`property_type='דירה'`).
8. **Rooms over time** — median price and ₪/m² by room bucket (2, 3, 4, 5, 6+) per year, 2000–present. Line chart, bucket toggle.
9. **Subtype premiums** — median ₪/m² by `deal_nature` subtype (apartment-in-building baseline; garden apt, cottage, penthouse, duplex…), national + per-city bar chart, ≥100 deals per subtype.

### Existing tab updates

- **Quality tab:** add floor-parse coverage stat and the `year_built`-is-empty note.
- **Overview tab:** one new insight card if a striking demographics finding emerges from the computed data (e.g., strongest wage-price outlier).

## Data flow

```
05_build_dashboard.py
  └─ new functions: compute_demographics(), compute_streets(), compute_structure()
       └─ append to D dict → gzip+base64 → embedded in template (same as existing keys)
dashboard_template.html
  └─ 2 new tabs, ~9 chart/table blocks, JS renderers following existing patterns
       (Chart.js scatter/line/bar + existing table/search components)
copy output → Ai-macro-front/public/nadlan/index.html
```

Page weight budget: ≤1MB increase over the current 8.8MB (all data pre-aggregated; raw rows never embedded for new sections — the heaviest item, the street table, is ~5K rows of small tuples).

## Error handling

- Census TEXT columns: empty strings → NULL → excluded from that chart (not zero).
- Stat areas/streets below deal thresholds: excluded from charts, included in tables only if ≥5 deals with a low-sample flag.
- Floor strings that don't map: excluded; parse-rate surfaced in quality tab.
- Build script asserts the census join rate ≥ 80% and aborts with a clear error if the DB schema drifts.

## Testing

- Build-script level: run `05_build_dashboard.py`, assert new D-dict keys exist, are non-empty, and within sane ranges (e.g., floor premium values within 5K–200K ₪/m²; street count > 1,000).
- Visual: open the rebuilt HTML in Chrome (chrome-devtools MCP), verify each new chart renders with data, tables search/sort, no console errors, RTL layout intact.
- Deployment: verify `Ai-macro-front` serves the new file at `/nadlan` locally.

## Out of scope

- Collecting new data (year_built backfill, more cities).
- Changing the React app or Next.js routing.
- The separate macro.html / rent.html pages (unchanged).
