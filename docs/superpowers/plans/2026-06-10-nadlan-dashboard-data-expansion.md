# Nadlan Dashboard Data Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface census demographics, street-level prices, floor/rooms/subtype analyses, and street+gush/chelka explorer filters in the nadlan unified dashboard, per `docs/superpowers/specs/2026-06-10-nadlan-dashboard-data-expansion-design.md`.

**Architecture:** Extend the nadlan-service build pipeline (`05_build_dashboard.py` computes a `D` dict → gzip+base64 bundle; `dashboard_template.html` decodes it client-side and renders with Chart.js/Leaflet). New aggregates live in a new testable module `scripts/aggregates.py`. A new `scripts/07_assemble_dashboard.py` injects the bundle into the template (this step previously had no script). Output is copied to `Ai-macro-front/public/nadlan/index.html`.

**Tech Stack:** Python 3.9 + sqlite3 + pytest (new venv), vanilla JS + Chart.js 4.4 + Leaflet 1.9 (existing), pako gzip bundles.

**Working directories:**
- Pipeline: `/Users/avichay/Downloads/knowledgebase/complaince/nadlan-service` (call it `$SVC`)
- Frontend: `/Users/avichay/repoes/Ai-macro-front`

**Key facts the engineer must know (verified 2026-06-10):**
- DB of record: `$SVC/data/nadlan_transactions.sqlite` — 759,059 raw / 682,236 clean transactions. The build script's `DB = "output/nadlan_transactions.sqlite"` points at an **empty dir** and must be fixed.
- `$SVC` is **not a git repo** (Task 0 fixes that). No venv; `pyproj` is missing from system python — **without pyproj the rebuild silently drops the rent maps** (the build script catches ImportError and skips coordinates).
- Template placeholders: `__BUNDLE_B64__` (line ~384) and `__BUILD_DATE__` (lines ~135, ~379). Header counts ("259K עסקאות מכר · 16 ערים · 1,319 שכונות") are stale hardcoded text.
- `D.txns` row format today: `[ym, city_idx, ptype_idx, sqm, rooms, price_K, ppsm, nbh_idx]` (indices 0–7). We append `street_idx(8), gush(9), parcel(10), house(11)`.
- `year_built` is 100% NULL — building age is OUT of scope.
- Known bug to fix: the "🚀 הצמיחה החזקה ביותר" insight renders `None` as a city name (NULL `settlement_name_heb` groups + no minimum-count threshold in the growth query).

---

### Task 0: Environment + git baseline for nadlan-service

**Files:**
- Create: `$SVC/.gitignore`
- Create: `$SVC/.venv/` (virtualenv, gitignored)

- [ ] **Step 1: Create venv and install deps**

```bash
cd /Users/avichay/Downloads/knowledgebase/complaince/nadlan-service
python3 -m venv .venv
.venv/bin/pip install --quiet pyproj pytest
.venv/bin/python -c "import pyproj, pytest; print('deps ok')"
```
Expected: `deps ok`

- [ ] **Step 2: git init with .gitignore**

Create `$SVC/.gitignore`:
```
.venv/
data/
output/
dashboard/index.html
__pycache__/
*.pyc
mnt/
```
(`data/` is 430MB+ of sqlite/geojson; `dashboard/index.html` is a build artifact. `macro.html`/`rent.html` stay tracked — they're small and not rebuilt by this plan.)

```bash
cd /Users/avichay/Downloads/knowledgebase/complaince/nadlan-service
git init -b main
git add -A
git commit -m "chore: baseline nadlan-service before dashboard expansion"
```
Expected: initial commit created, `git status` clean except ignored paths.

---

### Task 1: Pipeline reproducibility — DB path, meta file, assembly script

**Files:**
- Modify: `$SVC/scripts/05_build_dashboard.py` (lines 18, 579–591)
- Modify: `$SVC/scripts/dashboard_template.html` (lines 130, 135)
- Create: `$SVC/scripts/07_assemble_dashboard.py`

- [ ] **Step 1: Fix DB path and write bundle metadata**

In `05_build_dashboard.py` line 18, replace:
```python
DB = "output/nadlan_transactions.sqlite"
```
with:
```python
DB = os.environ.get("NADLAN_DB", "data/nadlan_transactions.sqlite")
```

In the `__main__` block (after `f.write(b64)` / before the final print), add metadata output. Replace the whole `if __name__ == '__main__':` block with:

```python
if __name__ == '__main__':
    print("Building unified bundle...")
    t0 = datetime.now()
    D = build()
    raw = json.dumps(D, ensure_ascii=False, separators=(',',':'))
    gz = gzip.compress(raw.encode('utf-8'), compresslevel=9)
    b64 = base64.b64encode(gz).decode('ascii')
    print(f"\nSizes: raw {len(raw):,} -> gz {len(gz):,} -> b64 {len(b64):,}")
    print(f"Time: {(datetime.now()-t0).total_seconds():.1f}s")

    with open("output/unified_bundle.b64", "w") as f:
        f.write(b64)

    HEB_MONTHS = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני",
                  "יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"]
    now = datetime.now()
    meta = {
        'tx_human': f"{round(len(D['txns'])/1000)}K",
        'rent_human': f"{round(sum(len(v) for t in D['settlement_trends'].values() for v in t.values())/1000)}K",
        'cities': len(D['cities']),
        'nbhs': len(D['nbh_dict']),
        'date': f"{now.day} {HEB_MONTHS[now.month-1]} {now.year}",
    }
    with open("output/bundle_meta.json", "w") as f:
        json.dump(meta, f, ensure_ascii=False)
    print("Saved output/unified_bundle.b64 + bundle_meta.json")
```

- [ ] **Step 2: Replace hardcoded header counts in the template**

`dashboard_template.html` line 135, replace:
```html
    <div class="subtitle">259K עסקאות מכר · 148K רשומות שכירות · 16 ערים · 1,319 שכונות · מפקד 2022 · עדכון: __BUILD_DATE__</div>
```
with:
```html
    <div class="subtitle">__TX_HUMAN__ עסקאות מכר · __RENT_HUMAN__ רשומות שכירות · __CITY_COUNT__ ערים · __NBH_COUNT__ שכונות · מפקד 2022 · עדכון: __BUILD_DATE__</div>
```

Line 130, replace the loader text `פותח את הדאטה (2.7MB)...` with `פותח את הדאטה...`.

- [ ] **Step 3: Create the assembly script**

Create `$SVC/scripts/07_assemble_dashboard.py`:
```python
#!/usr/bin/env python3
"""Assemble dashboard/index.html from template + bundle + metadata."""
import json
from pathlib import Path

ROOT = Path(__file__).parent.parent
TEMPLATE = ROOT / "scripts" / "dashboard_template.html"
BUNDLE = ROOT / "output" / "unified_bundle.b64"
META = ROOT / "output" / "bundle_meta.json"
OUT = ROOT / "dashboard" / "index.html"

def main():
    html = TEMPLATE.read_text(encoding="utf-8")
    meta = json.loads(META.read_text(encoding="utf-8"))
    bundle = BUNDLE.read_text().strip()
    for ph in ("__BUNDLE_B64__", "__BUILD_DATE__", "__TX_HUMAN__",
               "__RENT_HUMAN__", "__CITY_COUNT__", "__NBH_COUNT__"):
        assert ph in html, f"placeholder {ph} missing from template"
    html = (html
            .replace("__BUNDLE_B64__", bundle)
            .replace("__BUILD_DATE__", meta["date"])
            .replace("__TX_HUMAN__", meta["tx_human"])
            .replace("__RENT_HUMAN__", meta["rent_human"])
            .replace("__CITY_COUNT__", str(meta["cities"]))
            .replace("__NBH_COUNT__", str(meta["nbhs"])))
    OUT.write_text(html, encoding="utf-8")
    print(f"Wrote {OUT} ({OUT.stat().st_size/1e6:.1f} MB)")

if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Baseline rebuild — verify the pipeline reproduces a working dashboard**

```bash
cd /Users/avichay/Downloads/knowledgebase/complaince/nadlan-service
.venv/bin/python scripts/05_build_dashboard.py && .venv/bin/python scripts/07_assemble_dashboard.py
```
Expected: bundle builds (look for `Rent settlements w/coords: 108` — proves pyproj worked), `Wrote .../dashboard/index.html (~8.5+ MB)`. If "pyproj not available" appears, STOP — the venv isn't being used.

Open `dashboard/index.html` in a browser (`open dashboard/index.html`) — loader disappears, overview KPIs render, header shows `682K עסקאות מכר`.

- [ ] **Step 5: Commit**

```bash
git add scripts/05_build_dashboard.py scripts/07_assemble_dashboard.py scripts/dashboard_template.html
git commit -m "feat: reproducible build - env DB path, bundle metadata, assembly script, dynamic header counts"
```

---

### Task 2: Fix the growth5y "None" insight bug

**Files:**
- Modify: `$SVC/scripts/05_build_dashboard.py` (lines ~558–571, the `growth_5y` block)

- [ ] **Step 1: Replace the growth query with NULL-safe + min-count version**

Replace:
```python
    growth_5y = {}
    for row in c.execute("""
        SELECT settlement_name_heb,
               (AVG(CASE WHEN deal_date>='2024-01-01' THEN price_per_sqm END) /
                AVG(CASE WHEN deal_date>='2019-01-01' AND deal_date<'2020-01-01' THEN price_per_sqm END) - 1) * 100
        FROM clean_transactions WHERE price_per_sqm > 0
        GROUP BY settlement_name_heb
    """):
        if row[1] is not None:
            growth_5y[normalize_city(row[0])] = row[1]
```
with:
```python
    growth_5y = {}
    for row in c.execute("""
        SELECT settlement_name_heb,
               AVG(CASE WHEN deal_date>='2024-01-01' THEN price_per_sqm END) a24,
               AVG(CASE WHEN deal_date>='2019-01-01' AND deal_date<'2020-01-01' THEN price_per_sqm END) a19,
               COUNT(CASE WHEN deal_date>='2024-01-01' THEN 1 END) c24,
               COUNT(CASE WHEN deal_date>='2019-01-01' AND deal_date<'2020-01-01' THEN 1 END) c19
        FROM clean_transactions
        WHERE price_per_sqm > 0 AND settlement_name_heb IS NOT NULL
        GROUP BY settlement_name_heb
    """):
        name, a24, a19, c24, c19 = row
        if a24 and a19 and c24 >= 30 and c19 >= 30:
            growth_5y[normalize_city(name)] = (a24 / a19 - 1) * 100
```

- [ ] **Step 2: Verify and commit**

```bash
.venv/bin/python - <<'EOF'
import sys; sys.path.insert(0, 'scripts')
import importlib.util
spec = importlib.util.spec_from_file_location("b", "scripts/05_build_dashboard.py")
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
D = m.build()
assert None not in D['growth5y'] and 'None' not in D['growth5y'], "None city leaked"
top = max(D['growth5y'].items(), key=lambda x: x[1])
print("top growth:", top)
EOF
git add scripts/05_build_dashboard.py && git commit -m "fix: growth5y insight - exclude NULL cities, require 30+ deals per window"
```
Expected: prints a real city name, no assertion error. (This runs the full build — a few minutes.)

---

### Task 3: `aggregates.py` — floor parsing + median helpers (TDD)

**Files:**
- Create: `$SVC/scripts/aggregates.py`
- Create: `$SVC/tests/test_aggregates.py`
- Create: `$SVC/tests/__init__.py` (empty)

- [ ] **Step 1: Write the failing tests**

Create `tests/test_aggregates.py`:
```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
from aggregates import parse_floor, med

def test_parse_floor_simple_ordinals():
    assert parse_floor("קרקע") == 0
    assert parse_floor("ראשונה") == 1
    assert parse_floor("שניה") == 2
    assert parse_floor("עשירית") == 10
    assert parse_floor("אחת עשרה") == 11
    assert parse_floor("עשרים ואחת") == 21

def test_parse_floor_kuma_with_rtl_marks():
    # real data: "קומה ‎3‏" contains U+200E/U+200F marks
    assert parse_floor("קומה ‎3‏") == 3
    assert parse_floor("קומה ‎0‏") == 0

def test_parse_floor_letters():
    assert parse_floor("א") == 1
    assert parse_floor("ב") == 2
    assert parse_floor("ג") == 3

def test_parse_floor_combos_take_lowest_dwelling():
    assert parse_floor("קרקע וראשונה") == 0
    assert parse_floor("קרקע+ראשונה") == 0
    assert parse_floor("מרתף+קרקע+ראשונה") == 0   # basement dropped
    assert parse_floor("קרקע, ראשונה") == 0
    assert parse_floor("שניה ושלישית") == 2

def test_parse_floor_unparseable():
    assert parse_floor("מרתף") == -1
    assert parse_floor("") is None
    assert parse_floor(None) is None
    assert parse_floor("בלתי ידוע") is None

def test_med():
    assert med([3, 1, 2]) == 2
    assert med([4, 1, 3, 2]) == 2   # lower median for even
    assert med([]) is None
```

- [ ] **Step 2: Run to verify failure**

```bash
cd /Users/avichay/Downloads/knowledgebase/complaince/nadlan-service
touch tests/__init__.py
.venv/bin/pytest tests/test_aggregates.py -q
```
Expected: FAIL — `ModuleNotFoundError: No module named 'aggregates'`

- [ ] **Step 3: Implement**

Create `scripts/aggregates.py`:
```python
"""Aggregate computations for the unified dashboard bundle.

Pure functions over a sqlite3 connection — testable with an in-memory DB.
"""
import re

ORDINALS = {
    'קרקע': 0, 'מרתף': -1,
    'ראשונה': 1, 'שניה': 2, 'שנייה': 2, 'שלישית': 3, 'רביעית': 4,
    'חמישית': 5, 'שישית': 6, 'שביעית': 7, 'שמינית': 8, 'תשיעית': 9,
    'עשירית': 10, 'אחת עשרה': 11, 'שתים עשרה': 12, 'שתיים עשרה': 12,
    'שלוש עשרה': 13, 'ארבע עשרה': 14, 'חמש עשרה': 15, 'שש עשרה': 16,
    'שבע עשרה': 17, 'שמונה עשרה': 18, 'תשע עשרה': 19,
    'עשרים': 20, 'עשרים ואחת': 21, 'עשרים ושתיים': 22, 'עשרים ושלוש': 23,
    'עשרים וארבע': 24, 'עשרים וחמש': 25, 'עשרים ושש': 26, 'עשרים ושבע': 27,
    'עשרים ושמונה': 28, 'עשרים ותשע': 29, 'שלושים': 30,
    'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5,
}
_RTL_MARKS = re.compile(r'[‎‏‪-‮]')
_DIGITS = re.compile(r'^\d{1,2}$')


def parse_floor(raw):
    """Hebrew floor label -> int floor (0=ground, -1=basement), None if unparseable.

    Combos ("קרקע+ראשונה") resolve to the lowest non-basement floor.
    """
    if not raw:
        return None
    s = _RTL_MARKS.sub('', str(raw)).strip()
    if not s:
        return None
    if s in ORDINALS:
        return ORDINALS[s]
    if s.startswith('קומה'):
        tail = s[4:].strip()
        if _DIGITS.match(tail):
            return int(tail)
        return None
    if _DIGITS.match(s):
        return int(s)
    parts = [p.strip() for p in re.split(r'[+,]| ו', s) if p.strip()]
    floors = [ORDINALS[p] for p in parts if p in ORDINALS]
    non_basement = [f for f in floors if f >= 0]
    if non_basement:
        return min(non_basement)
    if floors:
        return -1
    return None


def med(values):
    """Lower median; None for empty input."""
    if not values:
        return None
    vs = sorted(values)
    return vs[(len(vs) - 1) // 2]
```

- [ ] **Step 4: Run tests, expect pass**

```bash
.venv/bin/pytest tests/test_aggregates.py -q
```
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/aggregates.py tests/
git commit -m "feat: floor-label parser and median helper with tests"
```

---

### Task 4: `compute_structure` — floor premium, rooms-over-time, subtype premiums (TDD)

**Files:**
- Modify: `$SVC/scripts/aggregates.py` (append)
- Modify: `$SVC/tests/test_aggregates.py` (append)

- [ ] **Step 1: Append failing tests**

Append to `tests/test_aggregates.py`:
```python
import sqlite3
import pytest
from aggregates import compute_structure

@pytest.fixture
def db():
    conn = sqlite3.connect(":memory:")
    conn.execute("""CREATE TABLE clean_transactions (
        deal_date TEXT, settlement_name_heb TEXT, property_type TEXT,
        deal_nature TEXT, floor_no TEXT, asset_room_num REAL,
        deal_amount REAL, price_per_sqm REAL)""")
    rows = []
    # 40 ground-floor + 40 first-floor apartments, distinct pps
    for i in range(40):
        rows.append(("2024-03-01", "תל אביב-יפו", "דירה", "דירה בבית קומות",
                     "קרקע", 3, 2_000_000, 30000))
        rows.append(("2024-03-01", "תל אביב-יפו", "דירה", "דירה בבית קומות",
                     "ראשונה", 4, 2_500_000, 35000))
    # 120 subtype rows so the >=100 national threshold passes for one subtype
    for i in range(120):
        rows.append(("2023-05-01", "חיפה", "דירה", "דירת גן",
                     "קרקע", 4, 1_800_000, 20000))
    conn.executemany("INSERT INTO clean_transactions VALUES (?,?,?,?,?,?,?,?)", rows)
    return conn

def test_floor_curve(db):
    out = compute_structure(db, {"תל אביב-יפו": 0, "חיפה": 1}, min_floor_n=30)
    nat = {f: (pps, cnt) for f, pps, cnt in out["floor_curve"]["nat"]}
    assert nat[0][0] == 20000 or nat[0][0] == 30000  # ground median present
    assert 1 in nat and nat[1][0] == 35000
    assert out["quality_floor"]["total"] == 200
    assert out["quality_floor"]["parsed"] == 200

def test_rooms_yearly(db):
    out = compute_structure(db, {"תל אביב-יפו": 0, "חיפה": 1}, min_floor_n=30)
    by_bucket = dict((b, dict((y, (p, pps, c)) for y, p, pps, c in pts))
                     for b, pts in out["rooms_yearly"].items())
    assert 2024 in by_bucket["3"]
    assert by_bucket["3"][2024][0] == 2000  # median price in K

def test_subtypes(db):
    out = compute_structure(db, {"תל אביב-יפו": 0, "חיפה": 1}, min_floor_n=30)
    subs = {s[1]: s for s in out["subtypes"] if s[0] == -1}
    assert "דירת גן" in subs            # 120 rows >= 100 threshold
    assert "דירה בבית קומות" not in subs  # only 80 rows
```

- [ ] **Step 2: Run, expect ImportError/AttributeError**

```bash
.venv/bin/pytest tests/test_aggregates.py -q
```
Expected: FAIL — `cannot import name 'compute_structure'`

- [ ] **Step 3: Implement `compute_structure`**

Append to `scripts/aggregates.py`:
```python
def compute_structure(conn, city_idx, min_floor_n=30):
    """Floor premium curve, rooms-over-time, subtype premiums.

    city_idx: dict city_name -> index (already-normalized names included).
    Returns dict with keys: floor_curve, rooms_yearly, subtypes, quality_floor.
    """
    c = conn.cursor()

    # --- Floor curve (apartments only) ---
    nat_floors = {}            # floor -> [pps,...]
    city_floors = {}           # city_i -> floor -> [pps,...]
    floor_total = floor_parsed = 0
    for raw, city, pps in c.execute("""
        SELECT floor_no, settlement_name_heb, price_per_sqm FROM clean_transactions
        WHERE property_type = 'דירה' AND floor_no IS NOT NULL AND floor_no != ''
          AND price_per_sqm > 0"""):
        floor_total += 1
        f = parse_floor(raw)
        if f is None:
            continue
        floor_parsed += 1
        if f < 0 or f > 30:
            continue
        nat_floors.setdefault(f, []).append(pps)
        ci = city_idx.get(city)
        if ci is not None:
            city_floors.setdefault(ci, {}).setdefault(f, []).append(pps)

    floor_curve = {
        'nat': [[f, med(v), len(v)] for f, v in sorted(nat_floors.items())
                if len(v) >= min_floor_n],
        'city': {ci: [[f, med(v), len(v)] for f, v in sorted(fl.items())
                      if len(v) >= 20]
                 for ci, fl in city_floors.items()},
    }
    floor_curve['city'] = {ci: pts for ci, pts in floor_curve['city'].items() if pts}

    # --- Rooms over time (buckets 2,3,4,5,6+) ---
    rooms_acc = {}  # bucket -> year -> {'p': [...], 'pps': [...]}
    for date, rooms, price, pps in c.execute("""
        SELECT deal_date, asset_room_num, deal_amount, price_per_sqm
        FROM clean_transactions
        WHERE asset_room_num >= 2 AND deal_date >= '2000-01-01'
          AND deal_amount > 0 AND price_per_sqm > 0"""):
        b = str(min(6, int(rooms)))
        if b == '6':
            b = '6+'
        y = int(date[:4])
        slot = rooms_acc.setdefault(b, {}).setdefault(y, {'p': [], 'pps': []})
        slot['p'].append(price)
        slot['pps'].append(pps)
    rooms_yearly = {
        b: [[y, round(med(s['p']) / 1000), round(med(s['pps'])), len(s['p'])]
            for y, s in sorted(years.items()) if len(s['p']) >= 30]
        for b, years in rooms_acc.items()
    }

    # --- Subtype premiums (deal_nature) ---
    nat_subs = {}              # nature -> [pps,...]
    city_subs = {}             # (ci, nature) -> [pps,...]
    for nature, city, pps in c.execute("""
        SELECT deal_nature, settlement_name_heb, price_per_sqm
        FROM clean_transactions
        WHERE deal_nature IS NOT NULL AND deal_nature != '' AND price_per_sqm > 0
          AND deal_date >= '2020-01-01'"""):
        nat_subs.setdefault(nature, []).append(pps)
        ci = city_idx.get(city)
        if ci is not None:
            city_subs.setdefault((ci, nature), []).append(pps)

    subtypes = [[-1, n, len(v), med(v)] for n, v in nat_subs.items() if len(v) >= 100]
    subtypes += [[ci, n, len(v), med(v)] for (ci, n), v in city_subs.items()
                 if len(v) >= 50]
    subtypes.sort(key=lambda r: (r[0], -r[2]))

    return {
        'floor_curve': floor_curve,
        'rooms_yearly': rooms_yearly,
        'subtypes': subtypes,
        'quality_floor': {'total': floor_total, 'parsed': floor_parsed},
    }
```

- [ ] **Step 4: Run tests, expect pass; commit**

```bash
.venv/bin/pytest tests/test_aggregates.py -q
git add scripts/aggregates.py tests/test_aggregates.py
git commit -m "feat: compute_structure - floor curve, rooms-over-time, subtype premiums"
```

---

### Task 5: `compute_streets` + extended txn rows (TDD)

**Files:**
- Modify: `$SVC/scripts/aggregates.py` (append)
- Modify: `$SVC/tests/test_aggregates.py` (append)
- Modify: `$SVC/scripts/05_build_dashboard.py` (txns block, lines ~134–174)

- [ ] **Step 1: Append failing tests**

Append to `tests/test_aggregates.py`:
```python
from aggregates import compute_streets

@pytest.fixture
def street_db():
    conn = sqlite3.connect(":memory:")
    conn.execute("""CREATE TABLE clean_transactions (
        deal_date TEXT, settlement_name_heb TEXT, street_name_heb TEXT,
        deal_amount REAL, price_per_sqm REAL)""")
    rows = []
    for i in range(20):   # >= 15 threshold
        rows.append(("2024-01-01", "תל אביב-יפו", "רוטשילד", 3_000_000, 50000))
        rows.append(("2021-01-01", "תל אביב-יפו", "רוטשילד", 2_500_000, 40000))
    for i in range(5):    # below threshold
        rows.append(("2024-01-01", "חיפה", "הרצל", 1_000_000, 15000))
    conn.executemany("INSERT INTO clean_transactions VALUES (?,?,?,?,?)", rows)
    return conn

def test_street_league_threshold_and_growth(street_db):
    out = compute_streets(street_db, {"תל אביב-יפו": 0, "חיפה": 1})
    league = out["street_league"]
    assert len(league) == 1                      # only רוטשילד passes >=15
    ci, si, cnt, med_pps, med_price_k, growth = league[0]
    assert ci == 0 and cnt == 40
    assert out["streets_dict"][si] == "רוטשילד"
    assert med_price_k in (2500, 3000)
    assert growth == 25.0                        # 50000/40000 - 1

def test_city_streets_index(street_db):
    out = compute_streets(street_db, {"תל אביב-יפו": 0, "חיפה": 1})
    # both streets appear in the dict + city mapping (no threshold there)
    assert set(out["streets_dict"]) == {"רוטשילד", "הרצל"}
    assert sorted(out["city_streets"].keys()) == [0, 1]
```

- [ ] **Step 2: Run, expect import failure**

```bash
.venv/bin/pytest tests/test_aggregates.py -q
```
Expected: FAIL — `cannot import name 'compute_streets'`

- [ ] **Step 3: Implement `compute_streets`**

Append to `scripts/aggregates.py`:
```python
def compute_streets(conn, city_idx, min_deals=15):
    """Street dictionary + per-(city,street) league table.

    Returns: streets_dict (list of names), street_key (dict name->idx),
    city_streets (city_i -> sorted street idx list),
    street_league rows [city_i, street_i, cnt, med_pps, med_price_K, growth3|None].
    growth3 = median pps 2023+ vs 2020-2022, needs >=8 deals in each window.
    """
    c = conn.cursor()
    streets_dict, street_key = [], {}
    city_streets = {}
    acc = {}   # (ci, si) -> {'pps': [], 'p': [], 'new': [], 'old': []}

    for city, street, date, price, pps in c.execute("""
        SELECT settlement_name_heb, street_name_heb, deal_date, deal_amount, price_per_sqm
        FROM clean_transactions
        WHERE street_name_heb IS NOT NULL AND street_name_heb != ''
          AND price_per_sqm > 0 AND deal_amount > 0"""):
        ci = city_idx.get(city)
        if ci is None:
            continue
        name = street.strip()
        si = street_key.get(name)
        if si is None:
            si = street_key[name] = len(streets_dict)
            streets_dict.append(name)
        city_streets.setdefault(ci, set()).add(si)
        a = acc.setdefault((ci, si), {'pps': [], 'p': [], 'new': [], 'old': []})
        a['pps'].append(pps)
        a['p'].append(price)
        if date >= '2023-01-01':
            a['new'].append(pps)
        elif date >= '2020-01-01':
            a['old'].append(pps)

    league = []
    for (ci, si), a in acc.items():
        if len(a['pps']) < min_deals:
            continue
        growth = None
        if len(a['new']) >= 8 and len(a['old']) >= 8:
            growth = round((med(a['new']) / med(a['old']) - 1) * 100, 1)
        league.append([ci, si, len(a['pps']), round(med(a['pps'])),
                       round(med(a['p']) / 1000), growth])
    league.sort(key=lambda r: -r[3])

    return {
        'streets_dict': streets_dict,
        'street_key': street_key,
        'city_streets': {ci: sorted(s) for ci, s in city_streets.items()},
        'street_league': league,
    }
```

- [ ] **Step 4: Run tests, expect pass; commit**

```bash
.venv/bin/pytest tests/test_aggregates.py -q
git add scripts/aggregates.py tests/test_aggregates.py
git commit -m "feat: compute_streets - street dictionary and league table"
```

- [ ] **Step 5: Wire into the build — extend txn rows with street/gush/parcel/house**

In `05_build_dashboard.py`, add near the other imports (top of file):
```python
import sys
sys.path.insert(0, str(Path(__file__).parent))
from aggregates import compute_streets, compute_structure, compute_demographics
```
(`compute_demographics` is created in Task 6 — add the import now; Python won't fail until Task 6's build run, by which time it exists.)

Inside `build()`, replace section `[3]` (the txns loop) with this version (changes: SELECT adds 4 columns; street index uses `compute_streets`' dictionary built first; rows get indices 8–11):

```python
    print("\n[3] Street dictionary + league (aggregates module)")
    S = compute_streets(conn, city_idx)
    D['streets_dict'] = S['streets_dict']
    D['city_streets'] = S['city_streets']
    D['street_league'] = S['street_league']
    street_key = S['street_key']
    print(f"  Streets: {len(D['streets_dict'])}, league rows: {len(D['street_league'])}")

    print("\n[3b] All clean transactions (compressed array form)")
    nbh_idx = {}
    nbh_list = []
    # Row: [ym, city_i, ptype_i, sqm, rooms, price_K, ppsm, nbh_i, street_i, gush, parcel, house]
    txns = []
    for row in c.execute("""
        SELECT deal_date, settlement_name_heb, property_type, asset_area, asset_room_num,
               deal_amount, price_per_sqm, neighborhood,
               street_name_heb, gush_num, parcel_num, house_num
        FROM clean_transactions
        ORDER BY deal_date DESC
    """):
        (date, city, pt, sqm, rooms, price, ppsm, nbh,
         street, gush, parcel, house) = row
        if not city: continue
        ym = int(date[:4]) * 12 + int(date[5:7]) - 1
        ci = city_idx.get(city, -1)
        if ci < 0:
            cn = normalize_city(city)
            ci = city_idx.get(cn, -1)
        if ci < 0: continue
        pi = ptype_idx.get(pt, -1)
        ni = -1
        if nbh:
            nkey = f"{ci}|{nbh}"
            if nkey not in nbh_idx:
                nbh_idx[nkey] = len(nbh_list)
                nbh_list.append([ci, nbh])
            ni = nbh_idx[nkey]
        si = street_key.get(street.strip(), -1) if street else -1
        txns.append([
            ym, ci, pi,
            round(sqm) if sqm else 0,
            round(rooms * 2) / 2 if rooms else 0,
            round(price / 1000) if price else 0,
            round(ppsm) if ppsm else 0,
            ni, si,
            int(gush) if gush else 0,
            int(parcel) if parcel else 0,
            int(house) if house else 0,
        ])
    D['txns'] = txns
    D['nbh_dict'] = nbh_list
    print(f"  Transactions: {len(txns):,}")
```

Then at the end of `build()`, right before `return D`, add the structure aggregates (cheap to do here; demographics added in Task 6):
```python
    print("\n[14] Structure aggregates (floors/rooms/subtypes)")
    st = compute_structure(conn, city_idx)
    D['floor_curve'] = st['floor_curve']
    D['rooms_yearly'] = st['rooms_yearly']
    D['subtypes'] = st['subtypes']
    D['quality'].update({'floor_total': st['quality_floor']['total'],
                         'floor_parsed': st['quality_floor']['parsed']})
```

Note: `Path` is already imported in the file (`from pathlib import Path`).

- [ ] **Step 6: Commit**

```bash
git add scripts/05_build_dashboard.py
git commit -m "feat: txn rows carry street/gush/parcel/house; structure aggregates in bundle"
```
(Do not run the full build yet — Task 6 adds `compute_demographics` which is now imported.)

---

### Task 6: `compute_demographics` + join-rate assert (TDD)

**Files:**
- Modify: `$SVC/scripts/aggregates.py` (append)
- Modify: `$SVC/tests/test_aggregates.py` (append)
- Modify: `$SVC/scripts/05_build_dashboard.py` (call site)

- [ ] **Step 1: Append failing tests**

Append to `tests/test_aggregates.py`:
```python
from aggregates import compute_demographics

@pytest.fixture
def demo_db():
    conn = sqlite3.connect(":memory:")
    conn.execute("""CREATE TABLE clean_transactions (
        deal_date TEXT, settlement_name_heb TEXT, yishuv_stat_2022 INTEGER,
        deal_amount REAL, price_per_sqm REAL)""")
    conn.execute("""CREATE TABLE census_2022_statarea (
        our_yishuv_stat_2022 INTEGER, LocNameHeb TEXT, pop_approx INTEGER,
        pop_density TEXT, age_median REAL, size_avg REAL,
        employeesAnnual_medWage REAL, AcadmCert_pcnt REAL,
        own_pcnt TEXT, rent_pcnt TEXT)""")
    conn.execute("""INSERT INTO census_2022_statarea VALUES
        (5000001, 'תל אביב -יפו', 4000, '12000', 35.0, 2.5, 120000, 45.5, '60.0', '35.0')""")
    rows = []
    for i in range(25):   # >= 20 threshold
        rows.append(("2024-06-01", "תל אביב-יפו", 5000001, 3_000_000, 50000))
        rows.append(("2019-06-01", "תל אביב-יפו", 5000001, 2_000_000, 25000))
    # 10 unjoined transactions (no census row)
    for i in range(10):
        rows.append(("2024-06-01", "חיפה", 9999999, 1_000_000, 15000))
    conn.executemany("INSERT INTO clean_transactions VALUES (?,?,?,?,?)", rows)
    return conn

def _norm(n):
    return n.replace("תל אביב -יפו", "תל אביב-יפו") if n else n

def test_demo_area_stats(demo_db):
    out = compute_demographics(demo_db, {"תל אביב-יפו": 7464 * 1}, _norm, min_join_rate=0.5)
    areas = {a['id']: a for a in out['demo']}
    a = areas[5000001]
    assert a['wage'] == 120000 and a['acad'] == 45.5
    assert a['own'] == 60.0 and a['rent'] == 35.0   # TEXT columns cast
    assert a['cnt'] == 50
    assert a['ap5'] == 100.0                         # 50000 vs 25000 median pps
    assert a['yld'] is not None                      # rent matched via city name

def test_demo_join_rate_assert(demo_db):
    with pytest.raises(AssertionError):
        compute_demographics(demo_db, {}, _norm, min_join_rate=0.99)
```

- [ ] **Step 2: Run, expect import failure**

```bash
.venv/bin/pytest tests/test_aggregates.py -q
```
Expected: FAIL — `cannot import name 'compute_demographics'`

- [ ] **Step 3: Implement**

Append to `scripts/aggregates.py`:
```python
def _num(v):
    """Census TEXT column -> float or None (empty strings excluded, not zeroed)."""
    if v is None:
        return None
    s = str(v).strip().replace(',', '')
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def compute_demographics(conn, rent_by_city, normalize_city, min_join_rate=0.70):
    """Per-stat-area census profile joined to price stats.

    rent_by_city: city name -> avg monthly rent (room_type=3, 2024+).
    Returns {'demo': [...], 'demo_meta': {...}}; asserts census join rate.
    """
    c = conn.cursor()

    total = c.execute("SELECT COUNT(*) FROM clean_transactions").fetchone()[0]
    joined = c.execute("""
        SELECT COUNT(*) FROM clean_transactions t
        JOIN census_2022_statarea s ON t.yishuv_stat_2022 = s.our_yishuv_stat_2022
    """).fetchone()[0]
    join_rate = joined / total if total else 0
    assert join_rate >= min_join_rate, (
        f"census join rate {join_rate:.0%} below {min_join_rate:.0%} - DB schema drift?")

    # Price stats per stat area (medians computed in python)
    area_prices = {}   # said -> {'pps': [], 'p': [], 'old': [], 'new': []}
    for said, date, price, pps in c.execute("""
        SELECT yishuv_stat_2022, deal_date, deal_amount, price_per_sqm
        FROM clean_transactions
        WHERE yishuv_stat_2022 IS NOT NULL AND price_per_sqm > 0 AND deal_amount > 0"""):
        a = area_prices.setdefault(said, {'pps': [], 'p': [], 'old': [], 'new': []})
        if date >= '2023-01-01':
            a['pps'].append(pps)
            a['p'].append(price)
        if date >= '2024-01-01':
            a['new'].append(pps)
        elif '2019-01-01' <= date < '2021-01-01':
            a['old'].append(pps)

    demo = []
    for row in c.execute("""
        SELECT our_yishuv_stat_2022, LocNameHeb, pop_approx, pop_density, age_median,
               size_avg, employeesAnnual_medWage, AcadmCert_pcnt, own_pcnt, rent_pcnt
        FROM census_2022_statarea WHERE our_yishuv_stat_2022 IS NOT NULL"""):
        said, loc, pop, dens, age, hh, wage, acad, own, rent = row
        a = area_prices.get(said)
        if not a or len(a['pps']) < 20:
            continue
        city = normalize_city(loc.rstrip('*').strip()) if loc else None
        ap5 = None
        if len(a['new']) >= 20 and len(a['old']) >= 20:
            ap5 = round((med(a['new']) / med(a['old']) - 1) * 100, 1)
        mp = med(a['p'])
        yld = None
        rent_month = rent_by_city.get(city) if city else None
        if rent_month and mp:
            y = rent_month * 12 / mp * 100
            if 0.5 < y < 10:
                yld = round(y, 2)
        demo.append({
            'id': said, 'city': city,
            'pop': pop, 'dens': _num(dens), 'age': age, 'hh': hh,
            'wage': _num(wage), 'acad': _num(acad),
            'own': _num(own), 'rent': _num(rent),
            'cnt': len(a['pps']), 'mp': round(mp / 1000), 'pps': round(med(a['pps'])),
            'ap5': ap5, 'yld': yld,
        })
    demo.sort(key=lambda d: -d['cnt'])
    return {'demo': demo,
            'demo_meta': {'join_rate': round(join_rate * 100, 1), 'areas': len(demo)}}
```

- [ ] **Step 4: Run tests, expect pass**

```bash
.venv/bin/pytest tests/test_aggregates.py -q
```
Expected: all pass. Note the test passes `rent_by_city={"תל אביב-יפו": 7464}` — fix the fixture call if you typo'd the dict.

- [ ] **Step 5: Wire into `build()`**

In `05_build_dashboard.py`, the `rent_by_city` dict already exists in section `[10]` (Yields per city) but with raw `LocNameHeb` keys. Just after that dict is built (line ~485), add normalized keys:
```python
    rent_by_city_norm = {normalize_city(k.rstrip('*').strip()): v
                         for k, v in rent_by_city.items()}
```
Then in the `[14]` block added in Task 5, after the `compute_structure` lines, add:
```python
    print("\n[15] Demographics aggregates")
    dm = compute_demographics(conn, rent_by_city_norm, normalize_city)
    D['demo'] = dm['demo']
    D['demo_meta'] = dm['demo_meta']
    print(f"  Areas: {dm['demo_meta']['areas']}, join rate: {dm['demo_meta']['join_rate']}%")
```

- [ ] **Step 6: Full build run — verify all new keys + size budget**

```bash
.venv/bin/python scripts/05_build_dashboard.py 2>&1 | tail -20
.venv/bin/python - <<'EOF'
import base64, gzip, json
raw = gzip.decompress(base64.b64decode(open('output/unified_bundle.b64').read()))
D = json.loads(raw)
for k in ('streets_dict','city_streets','street_league','floor_curve',
          'rooms_yearly','subtypes','demo','demo_meta'):
    assert k in D and D[k], f"missing/empty {k}"
assert len(D['txns'][0]) == 12, f"txn row width {len(D['txns'][0])} != 12"
assert len(D['streets_dict']) > 1000
assert all(5000 < r[3] < 200000 for r in D['street_league'][:100])
nat = D['floor_curve']['nat']
assert all(5000 < p[1] < 200000 for p in nat)
print("keys ok; txns:", len(D['txns']), "streets:", len(D['streets_dict']),
      "league:", len(D['street_league']), "demo areas:", len(D['demo']))
print("b64 size MB:", round(len(open('output/unified_bundle.b64').read())/1e6, 1))
EOF
```
Expected: all asserts pass; b64 size ≤ previous size + 2MB (previous ≈ 8.3MB from Task 1 output — record it there and compare).

- [ ] **Step 7: Commit**

```bash
git add scripts/aggregates.py tests/test_aggregates.py scripts/05_build_dashboard.py
git commit -m "feat: demographics aggregates with census join-rate guard"
```

---

### Task 7: Template — street + gush/chelka filters and address columns in the explorer

**Files:**
- Modify: `$SVC/scripts/dashboard_template.html` (filter bar ~line 241; table head ~line 260; JS: `renderBuy`, `populateNeighborhoods` area, `onCityFilterChange`, `applyFilters`, `resetFilters`, `renderTxnPage`, `SORT_COLS`)

- [ ] **Step 1: Filter bar HTML**

In the filter-bar (after the `f-rooms` div, before the `🔍 סנן` button), insert:
```html
      <div><label>רחוב</label><input type="text" id="f-street" list="street-list" placeholder="הקלד רחוב..." style="min-width:130px"><datalist id="street-list"></datalist></div>
      <div><label>גוש</label><input type="number" id="f-gush" placeholder="6638" style="min-width:80px"></div>
      <div><label>חלקה</label><input type="number" id="f-parcel" placeholder="120" style="min-width:70px"></div>
```

- [ ] **Step 2: Table head — add address + gush columns**

Replace the explorer `<thead>` row with:
```html
        <thead><tr>
          <th onclick="sortTxns('date')">תאריך ⇅</th>
          <th onclick="sortTxns('city')">עיר ⇅</th>
          <th>כתובת</th>
          <th>גוש/חלקה</th>
          <th onclick="sortTxns('ptype')">סוג ⇅</th>
          <th onclick="sortTxns('sqm')">מ"ר ⇅</th>
          <th onclick="sortTxns('rooms')">חד׳ ⇅</th>
          <th onclick="sortTxns('price')">מחיר ⇅</th>
          <th onclick="sortTxns('pps')">₪/מ"ר ⇅</th>
        </tr></thead>
```

- [ ] **Step 3: JS — street datalist scoped to city**

Add after the `populateNeighborhoods` function:
```javascript
// Populate street datalist scoped to selected city (empty city => empty list;
// free text still matches by substring at filter time)
function populateStreets(cityIdxStr) {
  const dl = document.getElementById("street-list");
  dl.innerHTML = "";
  if (cityIdxStr === "") return;
  const ids = D.city_streets[cityIdxStr] || D.city_streets[parseInt(cityIdxStr)] || [];
  dl.innerHTML = ids.map(si => `<option value="${D.streets_dict[si]}">`).join('');
}
```
In `renderBuy()`, after `populateNeighborhoods("");` add: `populateStreets("");`
In `onCityFilterChange()`, after `populateNeighborhoods(cityName);` add:
```javascript
  populateStreets(idx);
  document.getElementById("f-street").value = "";
```
(note: in that function the variable holding the select value is `idx`.)

- [ ] **Step 4: JS — filtering logic**

In `applyFilters()`, after the `rooms` line add:
```javascript
  const streetQ = (document.getElementById("f-street").value || "").trim();
  const gush = parseInt(document.getElementById("f-gush").value) || null;
  const parcel = parseInt(document.getElementById("f-parcel").value) || null;
  // Street text -> set of matching street indices (exact first, substring fallback)
  let streetSet = null;
  if (streetQ) {
    streetSet = new Set();
    D.streets_dict.forEach((n, i) => { if (n === streetQ) streetSet.add(i); });
    if (!streetSet.size) {
      D.streets_dict.forEach((n, i) => { if (n.includes(streetQ)) streetSet.add(i); });
    }
  }
```
And inside the `filteredTxns = D.txns.filter(...)` predicate, before `return true;` add:
```javascript
    if (streetSet && !streetSet.has(t[8])) return false;
    if (gush !== null && t[9] !== gush) return false;
    if (parcel !== null && t[10] !== parcel) return false;
```

In `resetFilters()`, extend the id list:
```javascript
  ["f-yfrom","f-yto","f-pfrom","f-pto","f-rooms","f-street","f-gush","f-parcel"].forEach(id => document.getElementById(id).value = "");
```

Also in the filter bar HTML, make street/gush/parcel apply on Enter like other inputs do via the button — no change needed (the button calls `applyFilters()`).

- [ ] **Step 5: JS — render the new columns**

In `renderTxnPage()`, replace the row template with:
```javascript
    const addr = t[8] >= 0 ? D.streets_dict[t[8]] + (t[11] ? " " + t[11] : "") : "-";
    const gp = t[9] ? `${t[9]}/${t[10] || "-"}` : "-";
    return `<tr>
      <td>${String(mo).padStart(2,'0')}/${yr}</td>
      <td>${D.cities[t[1]]?.n || '?'}</td>
      <td>${addr}</td>
      <td class="num">${gp}</td>
      <td>${D.ptypes[t[2]] || '-'}</td>
      <td class="num">${t[3]}</td>
      <td class="num">${t[4] || '-'}</td>
      <td class="num">₪${fmtNum(t[5])}K</td>
      <td class="num">${fmtCurrency(t[6])}</td>
    </tr>`;
```
(keep the existing `const yr/mo` lines above it).

- [ ] **Step 6: Commit**

```bash
git add scripts/dashboard_template.html
git commit -m "feat: street + gush/chelka filters and address columns in transaction explorer"
```

---

### Task 8: Template — new tab 🛣️ רחובות ומבנה

**Files:**
- Modify: `$SVC/scripts/dashboard_template.html` (nav ~line 143, new tab div after `t-quality`, switchTab, new JS section)

- [ ] **Step 1: Nav button + switchTab wiring**

In the nav (after the `t-quality` button) add:
```html
    <button data-tab="t-streets" onclick="switchTab('t-streets')">🛣️ רחובות ומבנה</button>
    <button data-tab="t-demo" onclick="switchTab('t-demo')">🧬 דמוגרפיה</button>
```
In `switchTab`, extend the chain:
```javascript
    else if (name === 't-streets') renderStreets();
    else if (name === 't-demo') renderDemo();
```

- [ ] **Step 2: Tab HTML** (insert after the closing `</div>` of `t-quality`, before `</main>`):

```html
<!-- ===== TAB: רחובות ומבנה ===== -->
<div id="t-streets" class="tab-content">
  <div class="section">
    <h2>🛣️ ליגת הרחובות — <span id="street-count"></span></h2>
    <div class="sub">רחובות עם 15+ עסקאות. חציון ₪/מ"ר, וצמיחה (חציון 2023+ מול 2020-2022)</div>
    <div class="filter-bar">
      <div><label>עיר</label><select id="sl-city" onchange="renderStreetTable()"><option value="">הכל</option></select></div>
      <div><label>חיפוש רחוב</label><input type="text" id="sl-search" oninput="renderStreetTable()" placeholder="הקלד שם רחוב..."></div>
      <div class="filter-stats" id="sl-stats"></div>
    </div>
    <div class="txn-table" style="max-height:440px">
      <table><thead><tr>
        <th>#</th><th>רחוב</th><th>עיר</th>
        <th onclick="sortStreets(2)">עסקאות ⇅</th>
        <th onclick="sortStreets(3)">₪/מ"ר חציוני ⇅</th>
        <th onclick="sortStreets(4)">מחיר חציוני ⇅</th>
        <th onclick="sortStreets(5)">צמיחה ⇅</th>
      </tr></thead><tbody id="sl-tbody"></tbody></table>
    </div>
  </div>
  <div class="section">
    <h2>🏢 פרמיית קומה</h2>
    <div class="sub">חציון ₪/מ"ר לפי קומה (דירות בלבד). קרקע=0</div>
    <div class="filter-bar">
      <div><label>עיר</label><select id="fl-city" onchange="renderFloorChart()"><option value="">ארצי</option></select></div>
    </div>
    <div class="chart-box" style="height:320px"><canvas id="floor-chart"></canvas></div>
  </div>
  <div class="section">
    <h2>🚪 מחיר לפי חדרים לאורך זמן</h2>
    <div class="sub">חציון לפי קבוצת חדרים, משנת 2000</div>
    <div class="filter-bar">
      <div><label>מדד</label><select id="rm-metric" onchange="renderRoomsChart()">
        <option value="price">מחיר (אלפי ₪)</option><option value="pps">₪/מ"ר</option>
      </select></div>
    </div>
    <div class="chart-box" style="height:320px"><canvas id="rooms-chart"></canvas></div>
  </div>
  <div class="section">
    <h2>🏘️ פרמיות לפי תת-סוג נכס</h2>
    <div class="sub">חציון ₪/מ"ר לפי deal_nature, עסקאות 2020+ (סף 100 ארצי / 50 עירוני)</div>
    <div class="filter-bar">
      <div><label>עיר</label><select id="st-city" onchange="renderSubtypeChart()"><option value="-1">ארצי</option></select></div>
    </div>
    <div class="chart-box" style="height:360px"><canvas id="subtype-chart"></canvas></div>
  </div>
</div>
```

- [ ] **Step 3: JS renderers** (add a new `// ============ TAB 7: STREETS & STRUCTURE ============` section before `// ============ TAB 6: QUALITY` or after it — order doesn't matter):

```javascript
// ============ TAB: STREETS & STRUCTURE ============
let slSort = { col: 3, dir: -1 };
let _floorCh, _roomsCh, _subCh;

function renderStreets() {
  document.getElementById("street-count").textContent = `${fmtNum(D.street_league.length)} רחובות`;
  // City dropdowns: only cities present in the relevant data
  const leagueCities = [...new Set(D.street_league.map(r => r[0]))].sort((a,b) => a-b);
  document.getElementById("sl-city").innerHTML = '<option value="">הכל</option>' +
    leagueCities.map(ci => `<option value="${ci}">${D.cities[ci].n}</option>`).join('');
  const floorCities = Object.keys(D.floor_curve.city).map(Number).sort((a,b) => a-b);
  document.getElementById("fl-city").innerHTML = '<option value="">ארצי</option>' +
    floorCities.map(ci => `<option value="${ci}">${D.cities[ci].n}</option>`).join('');
  const subCities = [...new Set(D.subtypes.filter(s => s[0] >= 0).map(s => s[0]))].sort((a,b) => a-b);
  document.getElementById("st-city").innerHTML = '<option value="-1">ארצי</option>' +
    subCities.map(ci => `<option value="${ci}">${D.cities[ci].n}</option>`).join('');
  renderStreetTable();
  renderFloorChart();
  renderRoomsChart();
  renderSubtypeChart();
}

function sortStreets(col) {
  if (slSort.col === col) slSort.dir *= -1; else { slSort.col = col; slSort.dir = -1; }
  renderStreetTable();
}

function renderStreetTable() {
  const ci = document.getElementById("sl-city").value;
  const q = (document.getElementById("sl-search").value || "").trim();
  let rows = D.street_league;
  if (ci !== "") rows = rows.filter(r => r[0] === parseInt(ci));
  if (q) rows = rows.filter(r => D.streets_dict[r[1]].includes(q));
  rows = [...rows].sort((a, b) => ((a[slSort.col] ?? -1) - (b[slSort.col] ?? -1)) * slSort.dir);
  document.getElementById("sl-stats").textContent = `${fmtNum(rows.length)} רחובות`;
  document.getElementById("sl-tbody").innerHTML = rows.slice(0, 500).map((r, i) => {
    const g = r[5];
    const cls = g == null ? '' : g >= 0 ? 'yoy-pos' : 'yoy-neg';
    return `<tr><td>${i+1}</td><td>${D.streets_dict[r[1]]}</td><td>${D.cities[r[0]].n}</td>
      <td class="num">${fmtNum(r[2])}</td><td class="num">${fmtCurrency(r[3])}</td>
      <td class="num">₪${fmtNum(r[4])}K</td>
      <td class="num ${cls}">${g != null ? (g >= 0 ? '+' : '') + g + '%' : '-'}</td></tr>`;
  }).join('');
}

function renderFloorChart() {
  const ci = document.getElementById("fl-city").value;
  const pts = ci === "" ? D.floor_curve.nat : (D.floor_curve.city[ci] || []);
  if (_floorCh) _floorCh.destroy();
  _floorCh = new Chart(document.getElementById("floor-chart"), {
    type: "line",
    data: { labels: pts.map(p => p[0]),
      datasets: [{ label: "₪/מ\"ר חציוני", data: pts.map(p => p[1]),
        borderColor: "#1e40af", backgroundColor: "#1e40af22", borderWidth: 2.5, tension: 0.25, fill: true }]},
    options: { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false },
        tooltip: { callbacks: { label: c => `${fmtCurrency(c.parsed.y)} (${fmtNum(pts[c.dataIndex][2])} עסקאות)` }}},
      scales: { x: { title: { display: true, text: "קומה" }},
                y: { ticks: { callback: v => "₪" + (v/1000).toFixed(0) + "K" }}}}
  });
}

function renderRoomsChart() {
  const metric = document.getElementById("rm-metric").value;
  const vi = metric === "price" ? 1 : 2;
  const colors = { "2": "#6b7280", "3": "#3b82f6", "4": "#10b981", "5": "#f59e0b", "6+": "#dc2626" };
  const allYears = [...new Set(Object.values(D.rooms_yearly).flat().map(p => p[0]))].sort();
  const datasets = Object.entries(D.rooms_yearly).map(([b, pts]) => {
    const m = Object.fromEntries(pts.map(p => [p[0], p[vi]]));
    return { label: b + " חד׳", data: allYears.map(y => m[y] ?? null),
      borderColor: colors[b] || "#888", borderWidth: 2, tension: 0.25, spanGaps: true };
  });
  if (_roomsCh) _roomsCh.destroy();
  _roomsCh = new Chart(document.getElementById("rooms-chart"), {
    type: "line", data: { labels: allYears, datasets },
    options: { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: "top" }},
      scales: { y: { ticks: { callback: v => metric === "price" ? "₪" + fmtNum(v) + "K" : "₪" + fmtNum(v) }}}}
  });
}

function renderSubtypeChart() {
  const ci = parseInt(document.getElementById("st-city").value);
  const rows = D.subtypes.filter(s => s[0] === ci).sort((a, b) => b[3] - a[3]);
  if (_subCh) _subCh.destroy();
  _subCh = new Chart(document.getElementById("subtype-chart"), {
    type: "bar",
    data: { labels: rows.map(r => r[1]),
      datasets: [{ label: "₪/מ\"ר חציוני", data: rows.map(r => r[3]), backgroundColor: "#3b82f6" }]},
    options: { responsive: true, maintainAspectRatio: false, indexAxis: "y",
      plugins: { legend: { display: false },
        tooltip: { callbacks: { label: c => `${fmtCurrency(c.parsed.x)} · ${fmtNum(rows[c.dataIndex][2])} עסקאות` }}},
      scales: { x: { ticks: { callback: v => "₪" + (v/1000).toFixed(0) + "K" }}}}
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add scripts/dashboard_template.html
git commit -m "feat: streets & structure tab - street league, floor premium, rooms trend, subtype premiums"
```

---

### Task 9: Template — new tab 🧬 דמוגרפיה

**Files:**
- Modify: `$SVC/scripts/dashboard_template.html` (tab div + JS; nav button already added in Task 8)

- [ ] **Step 1: Tab HTML** (insert after the `t-streets` div):

```html
<!-- ===== TAB: דמוגרפיה ===== -->
<div id="t-demo" class="tab-content">
  <div class="section">
    <h2>🧬 דמוגרפיה ↔ מחירים — <span id="demo-count"></span> אזורים סטטיסטיים</h2>
    <div class="sub">מפקד 2022 × עסקאות 2023+. כל נקודה = אזור סטטיסטי עם 20+ עסקאות. כיסוי join: <span id="demo-join"></span></div>
    <div class="grid g-2">
      <div><div class="tabhead">שכר שנתי חציוני ↔ ₪/מ"ר</div>
        <div class="chart-box" style="height:340px"><canvas id="demo-wage"></canvas></div></div>
      <div><div class="tabhead">% אקדמאים ↔ <select id="demo-edu-metric" onchange="drawDemoEdu()" style="font-size:12px"><option value="pps">₪/מ"ר</option><option value="ap5">התייקרות 19→24</option></select></div>
        <div class="chart-box" style="height:340px"><canvas id="demo-edu"></canvas></div></div>
    </div>
    <div class="grid g-2" style="margin-top:14px">
      <div><div class="tabhead">% שוכרים ↔ תשואת שכירות</div>
        <div class="chart-box" style="height:340px"><canvas id="demo-yield"></canvas></div></div>
      <div><div class="tabhead">נגישות לדיור — שנות שכר לרכישה (קיצוניים)</div>
        <div class="chart-box" style="height:340px"><canvas id="demo-afford"></canvas></div></div>
    </div>
  </div>
  <div class="section">
    <h2>📋 פרופיל אזורים סטטיסטיים</h2>
    <div class="sub">חיפוש לפי עיר. ממוין לפי נפח עסקאות, מציג עד 300 שורות</div>
    <div class="filter-bar">
      <div><label>חיפוש עיר</label><input type="text" id="demo-search" oninput="renderDemoTable()" placeholder="שם עיר..."></div>
      <div class="filter-stats" id="demo-stats"></div>
    </div>
    <div class="txn-table" style="max-height:480px">
      <table style="font-size:11.5px"><thead><tr>
        <th>אזור</th><th>עיר</th><th>אוכלוסייה</th><th>גיל חציוני</th><th>גודל מ"ב</th>
        <th>שכר שנתי</th><th>% אקדמאים</th><th>% בעלות</th><th>% שוכרים</th>
        <th>עסקאות</th><th>₪/מ"ר</th><th>מחיר חציוני</th><th>התייקרות 19→24</th><th>תשואה</th>
      </tr></thead><tbody id="demo-tbody"></tbody></table>
    </div>
  </div>
</div>
```

- [ ] **Step 2: JS renderers** (append after the streets section):

```javascript
// ============ TAB: DEMOGRAPHICS ============
let _demoWageCh, _demoEduCh, _demoYieldCh, _demoAffCh;

function demoScatter(canvasId, rows, xKey, yKey, xLabel, yLabel, chartRef) {
  const pts = rows.filter(d => d[xKey] != null && d[yKey] != null)
    .map(d => ({ x: d[xKey], y: d[yKey], r: Math.min(12, 3 + Math.sqrt(d.cnt) / 4), d }));
  if (window[chartRef]) window[chartRef].destroy();
  window[chartRef] = new Chart(document.getElementById(canvasId), {
    type: "bubble",
    data: { datasets: [{ data: pts, backgroundColor: "rgba(59,130,246,0.45)", borderColor: "rgba(30,64,175,0.7)", borderWidth: 1 }]},
    options: { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false },
        tooltip: { callbacks: { label: c => {
          const d = c.raw.d;
          return `${d.city || '?'} ${d.id} · ${xLabel}: ${fmtNum(c.raw.x)} · ${yLabel}: ${fmtNum(c.raw.y)} · ${fmtNum(d.cnt)} עסקאות`;
        }}}},
      scales: { x: { title: { display: true, text: xLabel }}, y: { title: { display: true, text: yLabel }}}}
  });
}

function renderDemo() {
  document.getElementById("demo-count").textContent = fmtNum(D.demo.length);
  document.getElementById("demo-join").textContent = D.demo_meta.join_rate + "%";
  demoScatter("demo-wage", D.demo, "wage", "pps", "שכר שנתי (₪)", "₪/מ\"ר", "_demoWageCh");
  drawDemoEdu();
  demoScatter("demo-yield", D.demo, "rent", "yld", "% שוכרים", "תשואה %", "_demoYieldCh");
  drawDemoAfford();
  renderDemoTable();
}

function drawDemoEdu() {
  const m = document.getElementById("demo-edu-metric").value;
  demoScatter("demo-edu", D.demo, "acad", m, "% אקדמאים",
    m === "pps" ? "₪/מ\"ר" : "התייקרות %", "_demoEduCh");
}

function drawDemoAfford() {
  const rows = D.demo.filter(d => d.wage && d.mp)
    .map(d => ({ ...d, yrs: d.mp * 1000 / d.wage }))
    .sort((a, b) => a.yrs - b.yrs);
  const ext = [...rows.slice(0, 15), ...rows.slice(-15)];
  if (_demoAffCh) _demoAffCh.destroy();
  _demoAffCh = new Chart(document.getElementById("demo-afford"), {
    type: "bar",
    data: { labels: ext.map(d => `${d.city || '?'} ${d.id}`),
      datasets: [{ data: ext.map(d => +d.yrs.toFixed(1)),
        backgroundColor: ext.map((_, i) => i < 15 ? "#047857" : "#dc2626") }]},
    options: { responsive: true, maintainAspectRatio: false, indexAxis: "y",
      plugins: { legend: { display: false },
        tooltip: { callbacks: { label: c => `${c.parsed.x} שנות שכר · שכר ${fmtCurrency(ext[c.dataIndex].wage)}` }}},
      scales: { y: { ticks: { font: { size: 9 }}}}}
  });
}

function renderDemoTable() {
  const q = (document.getElementById("demo-search").value || "").trim();
  let rows = D.demo;
  if (q) rows = rows.filter(d => d.city && d.city.includes(q));
  document.getElementById("demo-stats").textContent = `${fmtNum(rows.length)} אזורים`;
  document.getElementById("demo-tbody").innerHTML = rows.slice(0, 300).map(d => {
    const apCls = d.ap5 == null ? '' : d.ap5 >= 0 ? 'yoy-pos' : 'yoy-neg';
    return `<tr><td>${d.id}</td><td>${d.city || '-'}</td>
      <td class="num">${fmtNum(d.pop)}</td><td class="num">${d.age ?? '-'}</td><td class="num">${d.hh ?? '-'}</td>
      <td class="num">${d.wage ? fmtCurrency(d.wage) : '-'}</td><td class="num">${d.acad ?? '-'}</td>
      <td class="num">${d.own ?? '-'}</td><td class="num">${d.rent ?? '-'}</td>
      <td class="num">${fmtNum(d.cnt)}</td><td class="num">${fmtCurrency(d.pps)}</td>
      <td class="num">₪${fmtNum(d.mp)}K</td>
      <td class="num ${apCls}">${d.ap5 != null ? (d.ap5 >= 0 ? '+' : '') + d.ap5 + '%' : '-'}</td>
      <td class="num">${d.yld != null ? d.yld + '%' : '-'}</td></tr>`;
  }).join('');
}
```

- [ ] **Step 3: Quality tab additions**

In `renderQuality()`, after the `alerts.push({ t: 'info', ...clean_transactions' })` line, add:
```javascript
  if (q.floor_total) {
    const fp = (q.floor_parsed / q.floor_total * 100).toFixed(1);
    alerts.push({ t: 'info', i: '🏢', tit: `זיהוי קומה: ${fp}% מתוך ${fmtNum(q.floor_total)} רשומות`,
      body: 'ערכי קומה בעברית נורמלו למספרים; ערכים לא ניתנים לפענוח הוחרגו מגרף הקומות.' });
  }
  alerts.push({ t: 'warn', i: '🏗️', tit: 'שנת בנייה (year_built) ריקה ב-100% מהרשומות',
    body: 'nadlan.gov.il לא מחזיר שדה זה. ניתוח גיל מבנה לא זמין — יעד איסוף עתידי.' });
```

- [ ] **Step 4: Commit**

```bash
git add scripts/dashboard_template.html
git commit -m "feat: demographics tab - wage/education/yield/affordability vs prices + area profiles; quality notes"
```

---

### Task 10: Full rebuild, browser QA, deploy to Ai-macro-front

- [ ] **Step 1: Rebuild + assemble**

```bash
cd /Users/avichay/Downloads/knowledgebase/complaince/nadlan-service
.venv/bin/pytest tests/ -q
.venv/bin/python scripts/05_build_dashboard.py && .venv/bin/python scripts/07_assemble_dashboard.py
```
Expected: tests pass; `Wrote .../dashboard/index.html (≤ ~10.8 MB)`.

- [ ] **Step 2: Browser QA (chrome-devtools MCP against the local file or dev server)**

Copy to the frontend and use the running Next.js dev server:
```bash
cp dashboard/index.html /Users/avichay/repoes/Ai-macro-front/public/nadlan/index.html
```
Open `http://localhost:3000/nadlan` in Chrome. Verify ALL of:
1. No console errors; loader disappears; header shows `682K עסקאות מכר` and current build date.
2. Overview: growth insight shows a real city (not "None").
3. Explorer: street filter — type `רוטשילד` with city תל אביב-יפו → results show רוטשילד addresses in the כתובת column; gush filter with a real gush (e.g. pick one from a result row's גוש/חלקה column) narrows results; reset restores 682,043.
4. 🛣️ tab: street league sorts and searches; floor chart shows a rising curve; rooms chart has 5 series; subtype chart shows penthouse above apartment baseline.
5. 🧬 tab: 4 charts render with hundreds of bubbles; table search "ירושלים" filters; join coverage shows ~75%.
6. Quality tab: floor-parse alert + year_built alert present.
7. Edge: street text that matches nothing → "0 תוצאות", no crash.

- [ ] **Step 3: Commit both repos**

```bash
cd /Users/avichay/Downloads/knowledgebase/complaince/nadlan-service
git add -A && git commit -m "build: regenerate dashboard with demographics/streets/structure tabs"

cd /Users/avichay/repoes/Ai-macro-front
git add public/nadlan/index.html
git commit -m "feat: nadlan dashboard - demographics, streets, floors, subtype analyses + street/gush filters"
```

- [ ] **Step 4: Report**

Summarize: bundle size delta vs the ~8.3MB baseline (budget: +2MB max), QA results, and any thresholds that produced thin data (e.g., if street league < 2,000 rows, mention lowering `min_deals`).

---

## Self-review notes

- **Spec coverage:** demographics items 1–5 → Tasks 6+9 (wage scatter, affordability, education+appreciation, renter↔yield, profile table). Streets item 6 → Tasks 5+8. Floor item 7 → Tasks 3+4+8. Rooms item 8 → Tasks 4+8. Subtypes item 9 → Tasks 4+8. Street filter → Task 7. Gush/chelka filter → Task 7. Quality additions → Task 9 Step 3. Header-count bug + assembly reproducibility → Task 1. "None" insight bug → Task 2. Join-rate assert → Task 6.
- **Types:** txn row indices 8–11 consistent across Tasks 5 (producer) and 7 (consumer). `D.floor_curve.{nat,city}`, `D.street_league` row shape `[ci,si,cnt,med_pps,med_price_K,growth]`, and `D.demo` object keys match between Python producers and JS consumers.
- **YAGNI:** no per-city rooms chart, no neighborhood-level rent-yield matching (settlement fallback only, per spec).
