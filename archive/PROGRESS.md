# Transfer Analytics Dashboard — Progress Log

## Project Goal
Build a full-stack football transfer analytics dashboard as a resume project.
Teaching/learning format — understand every line before moving on.

## Tech Stack
- **Backend**: Python 3.9, FastAPI, pandas, scikit-learn
- **Frontend**: React + Vite + Recharts (not started yet)
- **Data**: Transfermarkt dataset (CSV files in /archive)

## Project Structure
```
transfer-data-analysis/
├── archive/                          ← CSVs + this file
├── backend/
│   ├── __init__.py
│   ├── data.py                       ← master DataFrame + filters + net_spend (DONE)
│   ├── analytics.py                  ← 4 functions DONE (inflation_trends, big_money_caliber,
│   │                                    recruitment_by_source, recruitment_trends)
│   ├── model.py                      ← NOT STARTED
│   ├── main.py                       ← WALKING SKELETON: 1 endpoint wired (DONE)
│   ├── requirements.txt              ← DONE (+fastapi/uvicorn/scikit-learn)
│   └── data_extraction/
│       ├── __init__.py
│       ├── transfers.py              ← DONE
│       ├── clubs.py                  ← DONE
│       ├── players.py                ← DONE
│       ├── valuations.py             ← DONE
│       ├── stats_big5.py             ← DONE  (load_stats(); log previously called this stats.py)
│       └── stats_external.py        ← DONE
└── frontend/                         ← NOT STARTED
```

---

## Data Files Available
- `transfers.csv` — 175K rows, one per transfer
- `clubs.csv` — 796 clubs
- `players.csv` — player profiles
- `appearances.csv` — 1.87M rows, one per player per game
- `player_valuations.csv` — 656K market value snapshots
- `competitions.csv`, `games.csv`, `game_events.csv`, etc. (unused)

## Big 5 League IDs
- GB1 = Premier League
- ES1 = La Liga
- FR1 = Ligue 1
- IT1 = Serie A
- L1  = Bundesliga

## Season Data Quality
- Pre-2009: near-zero fee data, unreliable
- 2009–25/26: good data (25/26 = sort key 2025, now COMPLETE: ~3,480 transfers)
- 26/27 (2026): no rows yet (forward cap)
- SEASON_MAX constant (data.py = 2026) is the SINGLE default for every function +
  endpoint. Don't hardcode season_max anywhere — import SEASON_MAX. (One stray 2030-
  dated row exists, correctly tagged 25/26 — harmless Transfermarkt quirk.)

---

## What Each Extraction File Does

### `transfers.py` → `load_transfers()`
Loads transfers.csv. Key derived columns:
- `fee_in_millions` — transfer_fee / 1M, rounded to 2dp
- `market_value_in_millions` — market_value_in_eur / 1M
- `is_free_transfer` — fee == 0
- `is_paid_transfer` — fee > 0 and not null
- `is_undisclosed_fee` — fee is NaN
- `is_real_transfer` — excludes "Without Club", "Retired"
- `transfer_season` — kept as-is e.g. "23/24"
- `season_sort_key` — integer e.g. 2023 for sorting/filtering

### `clubs.py` → `load_clubs()`
Derives club_id + season → club_name + league_id from player_valuations.csv.
Key insight: clubs.csv only stores last known league (inaccurate for relegated clubs).
We fix this by using player_valuations.csv which tracks league per date.
Output: one row per club per season with accurate league_id.

### `players.py` → `load_players()`
Loads player profiles. Key columns:
- date_of_birth, position, sub_position, foot, height_in_cm
- country_of_citizenship, international_caps
- peak_value_in_millions (highest_market_value_in_eur / 1M)

### `valuations.py` → `load_squad_values_by_season()`
Calculates total squad value per club per season from player_valuations.csv.
Method: for each player+club+season keep latest valuation, then sum per club per season.
Output: club_id + transfer_season → squad_value_in_millions + player_count

### `stats.py` → `load_stats()`
Aggregates Big 5 league appearances per player per season PER LEAGUE.
Keeps competition_id so each league's stats are separate (Bundesliga goal ≠ PL goal).
Key columns: games, goals, assists, minutes, yellow_cards, red_cards,
             goal_contributions, goals_per_90, season_sort_key

### `stats_external.py` → `load_external_stats()`
Same as stats.py but for NON Big 5 leagues combined.
Useful for inbound transfers — how did a player perform before joining Big 5?
Key columns prefixed with ext_: ext_games, ext_goals, ext_assists, etc.

---

## data.py — Current State (DONE)

Master DataFrame `DF` is built by `_build()` function.
Current shape: 32,589 rows, 44 columns. Verified: no row explosion, 0 dups,
ages 15.5–43.3, fees 0–222 (222 = Neymar record), filter_transfers works.

### Joins completed:
1. transfers + clubs (buying club) → buying_club_league per season
2. transfers + clubs (selling club) → selling_club_league per season
3. Filter: buying OR selling club in Big 5
4. transfers + squad_values (buying) → buying_squad_value_in_millions (98% filled)
5. transfers + squad_values (selling) → selling_squad_value_in_millions (94% filled)
6. transfers + players → position, foot, caps, dob, etc.
7. transfers + stats_big5 PREVIOUS season → big5_* stats (39% filled)
   Key = season_sort_key - 1. Leakage-safe for summer AND winter windows
   (season N-1 ends before either window of season N opens).
   Includes big5_prior_league = which Big5 league the stats came from
   (primary = most minutes). NOTE: stats_big5 now recovers competition_id
   for this — earlier version dropped it despite the log claiming otherwise.
8. transfers + stats_external PREVIOUS season → ext_* stats (non-Big5 form).
   Raises any-prior-stats coverage 38.8% -> 51%. Only European feeder
   leagues have appearance data (NL1/PO1/TR1/BE1/RU1); Saudi/Brazil/MLS
   have zero appearances so no ext stats (verified).

### Derived columns:
- `transfer_direction`: "internal" / "inbound" / "outbound"
- `league_id`: Big 5 league involved (buying club takes priority)
- `age_at_transfer`: (transfer_date - date_of_birth).days / 365.25
- `fee_to_value_ratio`: fee_in_millions / market_value_in_millions
- `is_cross_league_transfer`: selling_club_league != buying_club_league
  (NaN / non-Big5 counts as "different" — a move out of the Big 5 is cross-league)

### net_spend_by_club_season() — standalone function (NOT a column on DF):
Returns club_id, club_name, transfer_season, gross_spend, income, net_spend.
Undisclosed (NaN) fees DROPPED; free (0) kept. Deliberately kept off DF to
avoid leaking the fee into itself if used as a model feature.
Sanity-checked: Chelsea 22/23 = +557m (real record); top sellers Benfica/Monaco/Ajax.

### Deferred (revisit if model needs it):
- Date-aware (pre-transfer-date) stats for winter buys — see TODO in data.py
- Career-to-date stats aggregate with date cutoff
- ABLATE big5_prior_league at model time: market_value likely already
  encodes most league-quality signal (descriptive check: PL fees higher
  but market value rises in lockstep). Measure incremental value, don't assume.
- League universe stays Big5 for the TRANSFER filter (clean scope story);
  non-Big5 leagues enter only as ext_* prior-form FEATURES, not as transfers.

### filter_transfers() function:
```python
filter_transfers(
    league: Optional[str] = None,    # e.g. "GB1"
    season_min: int = 2009,
    season_max: int = 2024,
    paid_only: bool = False,
    free_only: bool = False,
) -> pd.DataFrame
```

---

## Next Steps (in order)

### 1. Finish data.py
- Decide how to join stats (previous season? career totals?)
- Add net spend per club per season
- Final sanity check on master DataFrame

### 2. analytics.py (IN PROGRESS)
Pure pandas functions, one per dashboard chart. All call filter_transfers()
to share league/season/paid filters. Each = one endpoint + one chart.

- `inflation_trends()` — DONE. Per season: median & mean fee, median & mean
  market value, deal count, median premium (fee - value).
    DECISION: paid_only=True — free (0) deals would drag averages to zero and
              measure Bosman volume, not price.
    DECISION: report MEDIAN as headline (fees are right-skewed; mean chases
              megadeals). Mean kept for reference only.
    DECISION: compare fee vs market value on the SAME paid subset (like-for-like).
    Validated: median rises ~3.3m→4m (modest); mean 2-3x higher & noisy
               (proves the skew point); PL medians >> Big5 avg.
- `performance_adjusted_inflation()` — DONE. Cost-per-output by position group,
  indexed to each group's 2013/14 base = 100. Runs 2013-2024 (earlier too sparse).
    METRIC per group: attack = G+A/90; midfield = COMBINED (G+A/90 + clean-sheet
      rate, to credit defensive mids — hacky, see limitations); defence = clean-sheet rate.
    DECISION: cost = MEDIAN of PER-PLAYER ratios (fee/output), not ratio-of-medians
      — reflects what was actually paid per deal. Median not mean (heavy tails).
    DECISION: index to own base (units differ across groups -> never compare absolute).
    Result: defence inflated most (~186 by 24/25 = cost per clean sheet ~2x);
      attack moderate (peak ~170 in 18/19, now ~120-130); midfield flat/below base (~76).
- `big_money_caliber()` — STAR ANALYSIS. Top-N most expensive paid deals per
  season (constant sample = no composition artifact), fee vs caliber (age,
  prior Big-5 minutes, G+A/90), each indexed to base season = 100.
    STORY: fee index ~2.4x (100->234) while age/minutes stay flat ~100. Same
      caliber of player costs far more now — price inflation, NOT quality decline.
      (Tested & REJECTED the "big money buys worse players" thesis: top-25 median
      age flat ~24, prior minutes flat, % unproven fell 32%->16%. Data won't support it.)
    league param: money spent BY a league (buying_club_league==league), top_n=15.
      Fee inflated in ALL leagues (La Liga peaked ~5x in 18/19-19/20; PL steady high).
    PER-LEAGUE CAVEAT: prior-Big5-minutes proxy BREAKS for La Liga/Ligue1/Bundesliga
      (they buy from outside Big5 -> no prior Big5 minutes -> index 0/explodes).
      Use AGE as the caliber proxy per league (stable & flat everywhere); PL is the
      only league with a reliable minutes proxy.
    Companion viz: 2013-vs-2024 "what €25m vs €58m bought" cards
      (De Bruyne €22m 2013 vs Olise €53m 2024, same age 22.6, similar output).

    CALIBER-PROXY REFINEMENT (important, corrects earlier framing):
    - AGE is NOT caliber — it's a CONTROL. Flat age only rules out "buying younger",
      says nothing about quality. Keep it as a footnote, not a caliber line.
    - Snapshot columns are BROKEN for time-of-transfer caliber: international_caps
      and peak_value_in_millions are career totals as of the 2024 data pull, so old
      transfers look inflated (11 extra yrs to accumulate). The "caps crashed to 26"
      is an ARTIFACT — do not use. Only market_value_in_millions is contemporaneous.
    - Blended on-pitch output (G+A/90 over ALL top-25) is INVALID: only 43% of top
      signings are attackers; the rest are mids/defenders whose job isn't scoring,
      and the position mix shifted over time. Flat blended output was contaminated.
    - CLEAN CUT = ATTACKERS ONLY (top-15 attacking deals/season), where G+A/90 is a
      fair measure. Result (indexed 13/14=100): fee -> 408 (4x), market value -> 357
      (3.6x), G+A/90 -> 95 (FLAT, even slightly down). Age flat ~24.
    - DEFENSIBLE HEADLINE: "Top attacker fees quadrupled and valuations tripled while
      their goal output didn't move." Scope claim to attackers; for def/mid we can show
      fee/value inflation but NOT output (no defensive/creative stats in dataset).
    - Market value co-moves with fees (~circular: TM valuations inflate with the market),
      so it confirms the pricing ecosystem inflated, not that quality independently rose.

    DASHBOARD = TWO graphs, per league (5 small-multiple panels each):
      GRAPH 1 "all top-25 signings per league": FEE vs AGE (indexed). Cross-position
        overview. SHORTCOMING (state it on the chart): mixes all positions, so on-pitch
        output is NOT a valid caliber measure here (only 43% attackers); age is just a
        control. Shows "price up, player profile flat" at a high level.
      GRAPH 2 "attacker deep dive per league": FEE vs MARKET VALUE vs G+A/90 (indexed),
        top-10 attackers/season. The deeper dive into position-RELEVANT output. Finding
        holds in every league: fee + value climb, G+A/90 stays flat near 100.
        Caveats: output line uses only the 47-69% of top attackers with prior Big-5
        record (foreign signings excluded); Bundesliga's cheap 2013 base inflates its
        index magnitude (read shape, not level). top_n small per league.
      Engine: big_money_caliber(league=, position=, top_n=) returns fee/market_value/
        age/prior_minutes/ga_per_90 + *_idx columns.
      GRAPH 3 "fee vs value by position group" (Attack/Midfield/Defender, aggregate
        Big5, top-15/season): output OMITTED for mid/def (no valid on-pitch measure).
        Finding: fee+value inflated for ALL positions but unevenly —
          Attack fee 4.1x (outran value 3.6x); Defender fee 3.7x but VALUE 4.4x
          (market re-rated defenders faster than it paid; cheap ~10m base in 2013);
          Midfield most modest ~2x. Base-year sensitivity again (defender low base).

## Relevance audit (post-deep-dive)
- inflation_trends() — KEEP but demote to CONTEXT: whole-market (not top-N), from 2009
  (4 extra yrs), carries median_premium (fee above assessed value) nothing else has.
  Complements big_money_caliber (top deals). Drop only the blended all-Big5 single chart.
- performance_adjusted_inflation() — FULLY RETIRED (removed from code, not just dashboard).
  Superseded by the attacker deep-dive which does fee-vs-output properly for the one valid
  position; this one forced it on all positions via the hacky combined metric + double
  exclusion. Deleted with it: POSITION_GROUP, GROUP_METRIC, mid_combined (orphaned once the
  function went). KEPT: big5_clean_sheet_rate (derived in stats_big5.py, stays on DF) — a
  validated base feature reserved for model.py. Rule applied: base data survives on its own
  merit; analysis-specific constructs die with their analysis.
  analytics.py now = inflation_trends() + big_money_caliber() only.
- `recruitment_by_source()` — DONE. How each league recruits. Incoming transfers
  (buying club in league), split domestic / other_big5 / outside_big5. Real transfers,
  2009-2024. Returns counts + shares (shares = the fair comparison; volumes differ).
    Finding: Serie A most insular (45% domestic, only 12.5% from other Big5); Ligue 1
      & Bundesliga feeder-importers (54-56% from outside Big5); Premier League the apex
      buyer (poaches other Big5 most at 20%, + 51% outside); La Liga S.American pipeline (47%).
    Viz: GROUPED BAR (horizontal) — grouped BY SOURCE (3 groups), 5 league bars per
      group, every bar %-labelled. Lets you compare the SAME source type across all
      leagues side by side (what the user wanted). Tried & rejected: 100%-stacked bar
      (hard to compare) and Sankey (cluttered). Frontend: Recharts grouped BarChart +
      LabelList; consistent per-league color scheme.
- `recruitment_trends()` — DONE. Per-league, per-SEASON version of the above (one row
  per league+season, 3 source shares + total). Median 261 signings/cell, only 2 thin
  cells (<30) in early seasons.
    Viz: INTERACTIVE drill-down — line chart of a chosen source's share over seasons
      (source-toggle buttons), CLICK a year -> grouped bar re-renders to that season's
      full 3-source x 5-league breakdown. Frontend: shared per-league colors; click
      handler sets selected season.
    Finding: cross-Big5 poaching ROSE for all leagues (PL 'other Big5' 1.9%->~23%),
      so reliance on outside-Big5 signings gently DECLINED over 2009-2024.
- `top_transfers()` — DONE. Top-N most expensive paid buys per season, display-ready
  columns (player, pos, age, from/to club, fee, mkt value, fee_to_value_ratio). Filters
  on buying_club_league (NOT filter_transfers' league arg, which leaks outbound sales).
  Endpoint /api/top-transfers (?league,&top_n). Frontend: TopTransfers.jsx = slidable
  league pager (All Big5 + 5) + shared SEASON dropdown ("All time" + each season, filtered
  client-side), top-7 table; fee/value >1.5x highlighted. NOTE: watch for duplicate defs
  when user + assistant both edit analytics.py — last def wins (bit us once here).
- `best_free_transfers()` — DONE. Most valuable FREE (zero-fee) signings/season, ranked
  by market value. DATA CAVEAT: no loan flag; loans also have fee=0, and sorting by value
  surfaces loans. Mitigation: drop non-real transfers + drop ROUND-TRIP loans (reverse
  to->from move exists for same player). Still leaks in-progress-season loans (no return
  row yet). Validated: after filter, 23/24 = Messi/Škriniar/Thuram/Asensio (real Bosmans),
  25/26 = De Bruyne/J.David/Sané. Endpoint /api/best-free-transfers.
  Frontend: folded into TopTransfers.jsx as a MODE TAB at top ("Most expensive" |
  "Best free signings") — switches endpoint + table columns (free shows market value,
  no ×Val since fee/value=0). Refetches 6 league datasets on mode change.
- `list_clubs()` + `club_transfer_activity(club_id)` — DONE. Per-club transfer ledger:
  money_spent (incoming fees) / money_earned (sales) / net_spend, per season, fee-known
  only, handles buy-only & sell-only seasons. list_clubs = 176 Big5 clubs sorted by total
  activity. Endpoints /api/clubs, /api/club-activity?club_id=. Frontend: ClubActivity.jsx
  = club dropdown + 3 scrollable tabs (Net / Spent / Earned) of per-season bar charts;
  net colored by sign (coral = net spender, teal = net earner). Validated: Chelsea 22/23
  net +557m (Boehly era). list_clubs now also returns league + total_activity for a
  two-step LEAGUE -> CLUB picker; club dropdown shows top 8 by activity with a
  "Show all N" expand (selected club always kept visible).
  DRILL-DOWN: club_season_transfers(club_id, season) + /api/club-transfers -> every deal
  in/out for a club-season (direction in/out, counterpart club, fee; free/undisclosed
  labeled). Frontend: season dropdown in ClubActivity header -> itemized table below the
  charts (↓In teal / ↑Out coral). Validated: Chelsea 22/23 = Enzo/Fofana/Mudryk window.
- `top_net_earners()` — DONE (SMALL panel). Best buy-low-sell-high clubs = biggest NET
  EARNERS from the Big 5 (fees received selling TO Big5 − fees paid buying FROM Big5),
  over the range. Endpoint /api/net-earners. Frontend: NetEarners.jsx = compact ranked
  list w/ inline mini-bars (no chart lib) — deliberately small so the dashboard can mix
  panel sizes later. Top 10 + SEASON dropdown (All time + each season; endpoint ?season=),
  smooth transition (neFade keyframe on season change + bar width CSS transition).
  Validated: all-time Benfica +915m/Ajax +843m; 23/24 Southampton top.
  CAVEAT: only Big5-involved deals exist, so for non-Big5 feeders it's net cash pulled
  FROM the Big 5 (their RoW purchases aren't in the data) — which is the intended metric.
- `league_nationalities()` / `country_leagues()` / `list_countries()` — DONE (donut panel).
  Source = player_valuations (each player's LATEST domestic league) + players.csv country,
  built once & cached (_PLC). Two views: league -> nationality pie, country -> league pie
  (top 10 + Other). Endpoints /api/countries, /api/league-nationalities, /api/country-leagues.
  Frontend PlayerOrigins.jsx: 2 top tabs (By league / By country) + selector + donut.
  Validated: PL = 807 English + British Isles; France players cluster in Ligue 1 (928).
  NOTE: "latest league" per player (snapshot), so it's a current-composition view, not
  historical; player_valuations skews to Big5-level coverage.
- `value_efficiency()` — fee vs market value ratio by league (not built)

### PRUNED from the dashboard (kept in code, dropped from the story):
- `performance_adjusted_inflation()` — too fragile for the headline: hacky combined
  midfield metric (invented weighting), double lower-bound from prospect/zero-output
  exclusion, noisy denominator. big_money_caliber tells the same "price vs quality"
  story far more defensibly. Don't put a weak chart next to a strong one.
- Blended all-Big5 inflation chart — redundant; per-league inflation shows the real
  (PL-driven) story instead.
- ~~`fee_drivers()`~~ — CUT. It's the model in disguise (correlating factors
  vs fee). Let model.py feature importance tell that story; avoids a hand-rolled
  correlation function duplicating/contradicting the model.

### 3. model.py
scikit-learn fee prediction model.
Features: age_at_transfer, position, market_value_in_millions, international_caps,
          foot, is_cross_league_transfer, squad_value_in_millions
Target: fee_in_millions (paid transfers only)

### 4. main.py — WALKING SKELETON WIRED (one slice end-to-end)
FastAPI. So far ONE data endpoint proven: GET /api/attacker-caliber (+ /api/health).
KEY PATTERN — records(df) = json.loads(df.to_json(orient="records")): df.to_json
converts NaN->null and numpy->native, dodging FastAPI's encoder which chokes on both.
Reuse records() for every future endpoint. CORS allows :5173. Import builds DF (slow boot).
Endpoints wired: /api/health, /api/attacker-caliber (?league,&top_n),
  /api/recruitment-trends (?season_min,&season_max -> 80 rows, all tested valid JSON).
Run:  python3 -m uvicorn backend.main:app --reload   (from project root; -m dodges PATH)
TODO: add endpoints for inflation_trends / recruitment_by_source if needed by UI.

### MODEL + MFE ARCHITECTURE — DONE
- model.py: fee prediction, temporal split (train<=2022, test>2022), log1p(fee) target,
  HistGradientBoostingRegressor (native NaN). FULL + LEAN models cached. Dropped caps/
  peak_value (broken snapshots) & net_spend (circular). FINDING: model ~ties naive
  "fee=market value" baseline (MAE €3.32 vs €3.45, R² .807 vs .814) -> market value IS a
  fee predictor; model's residual value = buyer squad value + age (permutation importance:
  market_value 0.92, buying_squad_value 0.10, age 0.06). Framed as insight, not accuracy.
  Endpoints /api/predict-fee, /api/model-insights.
- FRONTEND now SHELL + 2 MICRO-FRONTENDS: src/App.jsx = shell (side nav) lazy-imports
  src/mfe-analytics/AnalyticsApp.jsx (the 6 panels) and src/mfe-predictor/PredictorApp.jsx
  (form + honest insights). Each MFE = own code-split bundle. PredictorApp WARNS on
  out-of-range inputs (mv>90 or teen+high-mv): trees can't extrapolate (MV100 & MV150 both
  -> €88.7m), 99th-pct MV ~€60m, only 15 train rows >=90, max teen MV €11m; such predictions
  shown coral + "unreliable" instead of a confident figure. README.md written (architecture
  diagram, rigor story, honest model table, run steps). RESUME framing: lead with full-stack
  + data-rigor, NOT model R². Do NOT claim strong fee-prediction accuracy in a bullet.

### 5. frontend/ (analytics MFE) — DARK, PAGED attacker panel wired
Vite + React + Recharts, DARK THEME (bg #0f1115). vite.config proxies /api -> :8000.
AttackerDeepDive.jsx = horizontal scroll-snap PAGER: page 1 All Big 5 (top-25), then
Premier League / La Liga / Bundesliga / Serie A / Ligue 1 (top-12 each). Tabs jump to a
page; active tab tracks scroll position. All 6 datasets fetched in parallel on mount
from /api/attacker-caliber (?league=&top_n=). JSX syntax-verified via esbuild.
NOTE: `npm run build` fails in the Linux sandbox only (npm rollup optional-dep bug —
node_modules holds the user's macOS binary); user's Mac dev/build works fine. Dev uses
esbuild not rollup, so hot-reload is unaffected.
GRID DASHBOARD (analytics MFE): AnalyticsApp = KPI StatCards row (/api/summary: 32,149
transfers, €66.8bn fees, record €222m Neymar, 176 clubs) -> 2-col OVERVIEW GRID of compact
tiles [InflationChart (/api/inflation, median/mean fee vs value — the original inflation viz,
brought back), EraCompare (/api/caliber first vs last season = 2013 €25m vs 25/26 €67m cards,
brought back), NetEarners, PlayerOrigins] -> full-width interactive Sections [AttackerDeepDive,
TopTransfers, ClubActivity, RecruitmentTrends]. New endpoints /api/summary, /api/inflation,
/api/caliber. Layout modelled on a KPI-tiles + chart-grid reference.

POLISH + RESPONSIVE PASS: shell (App.jsx) uses CSS classes + @media(max-width:820px) ->
sidebar becomes a top bar (nav items row, subs hidden); sidebar slimmed to 208px, nav-sub
now block (fixed label/sub run-in). Cards unified: radius 16, soft shadow, colored title
dots, equal-height overview tiles. KEY RESPONSIVE FIX: cardBase minWidth:0 (+overflow hidden)
so Recharts containers shrink with the window instead of overflowing (grid/flex min-width:auto
trap); overview grid minmax 320; main min-width:0 max-width 1360. Predictor cards match + its
grids use auto-fit minmax so form/result stack on narrow.

TOP-LEVEL NAV (App.jsx): 2 views — "Fee vs caliber" (AttackerDeepDive pager) and
"Recruitment" (RecruitmentTrends). RecruitmentTrends.jsx = source-toggle line chart
(5 league lines over seasons) + click a point -> grouped-bar season breakdown below
(reshapes /api/recruitment-trends rows client-side). All 3 components esbuild-verified.
Run:  cd frontend && npm install && npm run dev   (then open :5173, backend on :8000)
TODO: add inflation + net-spend views; consider a shared chart theme/config module.

### DESIGN DECISION — walking skeleton over batch integration:
Wired ONE stable analysis end-to-end now (not all) to de-risk integration early. This
surfaced the NaN/numpy JSON landmine while cheap to fix. Rule: wire each analysis only
once it stabilizes (we deleted performance_adjusted_inflation — glad it wasn't wired).

---

## Key Design Decisions Made
- Season stored as "23/24" string, sort by season_sort_key integer
- Fees in millions rounded to 2dp (23.45, not 23450000)
- Free / paid / undisclosed fees treated as three separate categories
- Big 5 filter: include transfers where EITHER club is in Big 5
- Club league derived per-season from player_valuations (not static from clubs.csv)
- Stats split: Big 5 per league (stats_big5.py) vs external combined (stats_external.py)
- Default season range: 2009–2024
- Performance-adjusted inflation = Path A (in-dataset metrics only): attackers on
  G+A/90, mids on assists, defenders/GK on derived clean-sheet rate. See Known
  Limitations for the full disadvantage list.

## Code structure refactor (for readability + deploy)
- BACKEND split: main.py now THIN (app + CORS-from-config + include 3 routers + /health).
  New: config.py (ALLOWED_ORIGINS from env), serialization.py (records()),
  routers/{analytics,clubs,model}.py. requirements pinned. analytics.py reorganised into
  3 bannered sections (MARKET TRENDS / CLUBS / PLAYER ORIGINS) — kept one module because
  the mount is read-only for deletes (can't make it a package cleanly).
- 2 NEW dashboard tiles (fill the 3x2 grid): top_net_spenders (/api/net-spenders) +
  spend_by_position (/api/spend-by-position). Frontend NetSpenders + SpendByPosition.
  Validated: Man Utd/Chelsea/City top spenders; Attack €23.7bn leads positional spend.
- FIXES: removed overflow:hidden on analytics cards (was clipping the origins donut);
  removed the maxHeight scroll on the predictor team-picker (was clipping the bottom club row).
- STILL TODO for deploy (IMPORTANT): frontend hardcodes "/api/..." in ~15 files (works only
  via Vite dev proxy). Need src/api.js reading VITE_API_URL so prod (different origin) works.
  Also extract src/theme.js (colors duplicated in ~11 files). These are the last deploy-blockers.

## Model shortcomings (fee predictor — be upfront about these)
1. BARELY BEATS THE BASELINE. Model MAE €3.32m / R² .807 vs naive "fee=market value"
   €3.45m / .814 (baseline R² is actually higher). The model ~ties a one-liner.
2. MARKET VALUE DOES ~ALL THE WORK. Permutation importance: market_value 0.92, everything
   else tiny. Because market_value is itself a crowd/expert fee estimate -> the high R² is
   partly TAUTOLOGICAL (predicting a fee-like number from a fee-like number).
3. CAN'T EXTRAPOLATE. Trees saturate at the training ceiling: MV €100m and €150m both ->
   €88.7m. Only 15 train rows have MV>=90 (99th pct ~€60m) and no teen is highly valued,
   so high-MV / young-star inputs are unreliable (UI now warns).
4. PAID DEALS ONLY. Free (0) and undisclosed (NaN) fees excluded; model says nothing about them.
5. NO UNCERTAINTY. Point estimates only — no interval, despite fees being high-variance.
6. PREDICTS RAW FEE, not the premium. Modelling fee/market-value RATIO (deferred) would make
   age/position/club actually matter and be far more informative; current lean model ≈ MV.
7. PRIOR-SEASON STATS ADD ~NOTHING to fee (already priced into market value) — so the rich
   feature set is mostly decorative for prediction (still useful for the importance story).
8. REGIME SHIFTS. Trained <=22/23, tested 23/24+; COVID/inflation mean past fee patterns may
   not transfer, and older-season data is incomplete (see below) so the train set is patchy.

### PIVOT: shipped model is now the MARKET-VALUE predictor (fee model kept but demoted)
- Fee was pointless (≈ market value). VALUE prediction is a real task (no giveaway feature).
- model.py train_value()/predict_value()/value_importance(); target log1p(market_value),
  temporal split, HistGBR. Endpoints /api/predict-value, /api/value-insights, /api/top-clubs.
- Features (HONEST set): buying_squad_value + age + big5 stats + EXT (non-Big5) stats +
  height + season_sort_key + position/league/prior_league/foot. R² 0.627, MAE €2.58m
  (baseline predict-median MAE €4.39). Drivers: big5_minutes .30, buying_squad_value .27,
  ext_minutes .09, age .08. => playing time + team stature drive value.
- FEATURE-ENG PROGRESSION (honest): buying-squad-only .504 -> +ext stats .559 -> +height/
  prior_league/foot .586 -> +season .627. EXCLUDED AS LEAKAGE (would give .65-.68): selling
  squad value (sum includes the player himself) and peak_value (career-max ≈ target) and
  international_caps/peak_value (2024 snapshots, anachronistic). Honest 0.627 ≈ leaky ceiling,
  so cleanliness costs ~nothing.
- Frontend: PredictorApp rebuilt as VALUE predictor with a TEAM CLICKER (grid of top-24 clubs
  by squad value -> feeds buying_squad_value) + age/position/league/opt goals&minutes.
  Shell nav item = "Value Predictor". Honest insights panel (R², baseline, drivers, caveats).
  OUT-OF-RANGE GUARD (value): warns when inputs are unseen/implausible — goals>20 (NO
  midfielder in train scored >=20), minutes>3200, or age<19 & minutes>2000 (only 1 such row).
  Trees SATURATE at the training ceiling (~€40m; 25 goals & 40 goals both -> €38.8m), so
  generational-outlier inputs under-predict; shown coral + "unreliable" instead of a fake figure.
  ACCURACY-VS-TRANSFERMARKT: value_agreement() + /api/value-insights.agreement -> corr r=0.81,
  86% within €5m, 95% within €10m, + sampled predicted-vs-actual SCATTER (Recharts) with y=x
  diagonal in the insights panel. NOTE (honest): the value model's TARGET *is* TM market value,
  so R²/MAE already ARE the accuracy vs TM; the scatter/corr just visualise it. within-5m looks
  high partly because most players are low-value; corr r=0.81 is the fairer overall measure, and
  the scatter shows top-end under-prediction (ceiling).

### ONE-LINE VERDICT: the value model is a GOOD AVERAGE valuer, POOR SUPERSTAR valuer.
Typical players priced well (MAE €2.58m, r=0.81); elite outliers badly under-predicted,
because superstar value lives in intangibles the dataset lacks (talent/potential/hype/
bidding) + trees can't exceed their ~€45m training ceiling.

### WIRTZ EXAMPLE (the "poor superstar valuer" case — pairs with Semenyo)
Florian Wirtz, Leverkusen->Liverpool 25/26: real market value €140m (fee €125m), age 22,
midfielder, 10 goals / 2,356 min. Model predicts ~€20m for that profile — off by ~7x.
Why: the model sees "young mid, 10 goals, big club" = a typical ~€20m profile; what makes
him €140m (generational talent, hype, bidding) is invisible in the features, and there are
almost no €100m+ players in training so trees can't output that high. On the predicted-vs-
actual scatter he'd be off the top (predicted ~20, actual 140).

### SEMENYO EXAMPLE (fee vs value, in one real case — great interview anecdote)
Antoine Semenyo, Bournemouth->Man City, 25/26: FEE €72m, but MARKET VALUE €65m (age 26,
11 goals, 3210 min). Three lessons in one row:
1. The model predicts VALUE (~€65m target), NOT fee — the €7m gap up to €72m is the
   fee-over-value PREMIUM we proved unpredictable (needs contract/bidder data we lack).
2. €65m is ABOVE the model's ceiling (99th-pct value €40m), so it under-predicts him —
   trees saturate, can't reach elite outliers.
3. His 3210 min trips the out-of-range guard (>3200), so the UI correctly flags him as
   beyond reliable range rather than printing a confident low number.
So "the model missed Semenyo's €72m" is EXPECTED and correct: wrong target (fee vs value)
+ beyond-ceiling outlier. Good story: shows I know what the model does and doesn't claim.

### TESTED: per-position models (GK/def) — REJECTED, unified is better
Hypothesis: train separate models for GK/defenders since attacking stats don't capture them.
Result: separate models WORSE for every position (test MAE, unified vs separate):
  Attack 2.91 vs 3.04 | Mid 2.80 vs 2.87 | Def 2.29 vs 2.34 | GK 1.65 vs 1.74.
Why: a single GBM already specialises via the `position` feature (splits on position, then
uses different features per branch); separating starves each model of data and loses shared
signal (squad value/minutes/age patterns transfer across positions). Also GK & DEF are the
MOST accurately valued (lowest MAE) — value tracks squad value+minutes+age (not attacking
stats), and their values are lower/less spiky. GK R² lowest (.52) = their value variance is
hardest to EXPLAIN, but a separate model doesn't help. => keep the unified model.

### INTERVIEW TALKING POINTS (see README "Notable findings" for the polished list)
Lead point: SELLING-SQUAD-VALUE = LEAKAGE and was deliberately excluded. A club's squad value
sums its players' market values, so the player being predicted sits inside his own selling
club's total -> the model would read the answer off the input. Would lift R² .63->~.65 but
it's cheating; honest .63 ~= leaky ceiling (.65-.68) so integrity cost ~nothing. Same reasoning
excludes peak_value & international_caps (2024 snapshots = anachronistic/leaky). Other gems:
fee prediction ties the market-value baseline (pivoted to value); premium unpredictable from
this data (needs contract/clause/bidder data); leakage-safe prior-season stats join; loans
masquerade as free transfers; fees 4x while output flat; trees can't extrapolate.

### Settled experiments (why the FEE model is what it is)
- DROP market value -> WORSE: MAE €3.32 -> €4.36, R² .807 -> .656. MV is the best feature; not a crutch.
- PREDICT THE PREMIUM (target = fee - market value, "value in price terms") -> UNPREDICTABLE:
  MAE €3.45m, R² -0.02 (worse than assuming premium=0). Also true for the ratio framing.
  CONCLUSION (corrected framing): the premium is NOT predictable FROM THIS DATA — which is a
  DATA limitation, not proof it's random. The premium is almost certainly systematic, driven
  by factors absent from a fees+valuations dataset: CONTRACT YEARS REMAINING (biggest lever),
  RELEASE CLAUSES, number of COMPETING BIDDERS, selling-club FINANCIAL DISTRESS, buyer urgency,
  add-ons/sell-on/agent fees. To model the premium you'd need contract & clause data (a
  provider that tracks it). With current features, "fee = market value" is the honest ceiling.
  A descriptive "avg premium by age bucket" view is the only sound way to surface the age hint.

## Known Limitations
- PLAYER-ORIGINS ACCURACY SUSPECT (user-flagged; treat pies as approximate):
  1. "latest league" per player from player_valuations = a snapshot — counts RETIRED
     players' final league, youth players, and loanees' current club; not a clean
     "who plays top-flight now" census.
  2. player_valuations coverage skews to Big5-level clubs, so lower leagues are undercounted.
  3. Dual-nationality players collapse to ONE country_of_citizenship.
  4. CONTINENT tagging via countries.csv name-match is only 84/107; the other 23 fall to
     "Other" — mostly AFRICAN nations (Cote d'Ivoire, Cameroon, Mali, DR Congo...) due to
     name-spelling mismatches. So Africa is undercounted and "Other" is inflated. Fixable
     later with a name-normalization map; left as-is for now.
- TOO MANY CLUBS TAGGED "TOP-FLIGHT" (unavoidable). Each Big-5 league shows 31-39 clubs in
  our data (176 total), but a league only holds ~18-20 at a time. Cause: we aggregate over
  2013-25 and take each club's LATEST league, so promotion/relegation piles every club that's
  EVER been in the division into it (and a since-relegated club keeps its top-flight tag). So
  the team picker / league membership over-counts the top flight vs any single real season.
  Inherent to multi-season aggregation without a season-specific current-league filter; not
  cleanly fixable with this data, so left as-is.
- OLDER-SEASON COVERAGE INCOMPLETE (source data gap, not our pipeline): the raw
  transfers.csv under-records older transfers. Raw counts: 09/10 ~2,028 -> 24/25 ~16,662
  (~8x). Marquee deals are missing pre-~2015 — e.g. Agüero's 2011 €40m Atlético->Man City
  move is ENTIRELY ABSENT; City's raw 11/12 incoming list is just 3 minor rows. So
  top_transfers / inflation_trends / club activity are unreliable for early seasons
  (progressively worse further back); ~2018+ looks well-covered. DECISION: left the
  2009 start as-is; not trimmed. Treat historical/early-season figures as lower bounds.
- Clubs.csv league data unreliable for relegated clubs (mitigated by valuations-based derivation)
- Only ~17K of 175K transfers have recorded fees (rest are free or undisclosed)
- player_valuations.csv only reliably tracks Big 5 level clubs
- 25/26 and later seasons are incomplete

### Performance-adjusted inflation — data limitations (Path A chosen)
This is Transfermarkt SUMMARY data, not Opta/StatsBomb tracking data. The only
per-player performance fields that exist are: goals, assists, minutes_played,
yellow_cards, red_cards (appearances.csv), plus goal/card/sub events and final
match scores. Consequences:
- NO advanced defensive metrics (tackles, interceptions, blocks, clearances).
  Defenders' only available quality signal = CLEAN-SHEET RATE, which we DERIVE
  from goals conceded (appearances -> games.csv). Caveats: clean sheets are a
  team-level outcome pinned to an individual (noisy for a single CB; better for
  GKs); credited only if player played >=60 min in a match that conceded 0.
- NO creative metrics (key passes, chance creation, xA, xG). Midfielders' only
  creation signal = ASSISTS (a completed chance). Key-pass/xA-level nuance absent.
- Attackers are well served (goals, assists, G+A per 90).
- PROSPECT-EXCLUSION BIAS (important): the metric divides fee by prior output, so
  young/unproven high-fee buys (e.g. Yan Diomande type) have ~no prior Big-5 data
  and drop out. The performance-adjusted curve therefore UNDERSTATES the "big fees
  for unproven talent" effect — treat it as a LOWER BOUND on cost-per-output inflation.
- Cross-position ratios use different units (G+A/90 vs clean-sheet rate), so groups
  are NOT comparable in absolute terms — compare each group's trend vs its own base.
- COMBINED MIDFIELD METRIC (hacky): midfield output = G+A/90 + clean-sheet rate,
  to credit defensive mids. This ADDS an individual per-90 rate to a 0-1 team rate
  with an invented ~50/50 weighting — units aren't comparable. Only defensible as a
  rough "two-sided contribution" proxy; the within-midfield trend depends on this blend.
  (assists/90 alone rejected: 39.8% of mids have 0 assists -> unstable/NaN median.)
- PER-PLAYER RATIO exclusion compounds the bias: ratio fee/output is undefined at
  output=0, so zero-output signings are dropped IN ADDITION to no-prior-data players.
  Both removals strip out the very "big fee, little output" deals the analysis targets,
  so every curve is a LOWER BOUND — true inflation is higher.
- DEFERRED (Path B): external advanced stats (FBref/StatsBomb via soccerdata). Blocked
  on fuzzy player-ID matching across datasets (name+DOB+club, no shared key).
