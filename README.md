# ⚽ Big-5 Transfer Suite

A full-stack football-transfer analytics platform and market-value prediction model, built on
the Transfermarkt dataset for Europe's five major leagues (Premier League, La Liga, Serie A,
Bundesliga, Ligue 1). Two independently-loaded front-end apps sit behind one shell:

- **Transfer Analytics** — a KPI dashboard with six interactive panels on how the market has changed.
- **Value Predictor** — a gradient-boosted model with an interactive form and an honest
  "how good is it *really*?" breakdown.

> Built as an end-to-end data project: raw CSVs → a cleaned analytical dataset → REST API →
> interactive dashboard + ML model. The emphasis throughout is on **defensible decisions** —
> every number is one I can explain and stand behind.

**Stack:** Python · pandas · scikit-learn · FastAPI · React · Vite · Recharts

---

## Highlights

- **End-to-end:** a pandas data pipeline, a FastAPI service, and a React micro-frontend UI,
  wired together and running as one app.
- **A real analytical dataset,** not just a CSV read: 175k raw transfers joined to clubs,
  players, squad values and **leakage-safe** prior-season performance → a 32k-row model-ready table.
- **Six interactive analyses** — fee inflation, price-vs-caliber, biggest deals, club ledgers,
  net-earner rankings, player-origin composition, and recruitment flows over time.
- **Two ML models, honestly evaluated** — a market-value predictor (R² ≈ 0.63) and a fee model
  used as a deliberate counter-example, both with temporal validation and feature-importance.
- **Micro-frontend architecture** — a shell app that lazily mounts each feature app as its own
  code-split bundle.
- **Documented judgment calls** — leakage caught and excluded, alternatives tested and rejected,
  limitations stated up front (see *Engineering judgment* below).

---

## Architecture

```
                         ┌─────────────────────────────┐
   React shell (Vite) ── │  side nav → lazily mounts an │
   src/App.jsx           │  MFE bundle on demand        │
                         └──────────────┬──────────────┘
          ┌─────────────────────────┐  │  ┌──────────────────────────┐
          │ MFE: Transfer Analytics  │  │  │ MFE: Value Predictor      │
          │ (KPI grid + 6 panels)    │  │  │ (form + model insights)   │
          └────────────┬────────────┘  │  └─────────────┬────────────┘
                       └──────── fetch /api/… ───────────┘
                                        │
                          ┌─────────────▼──────────────┐
                          │  FastAPI  (backend/main.py) │
                          │  records(df) → JSON-safe    │
                          └─────────────┬──────────────┘
          ┌──────────────────────────┐ │ ┌───────────────────────────┐
          │ analytics.py (pandas)     │ │ │ model.py (scikit-learn)    │
          └────────────┬─────────────┘ │ └─────────────┬─────────────┘
                       └──── data.py: master DataFrame (built once) ───┘
                                        │
                               archive/*.csv (Transfermarkt)
```

**Micro-frontends.** The shell (`src/App.jsx`) owns the side nav and `React.lazy()`-imports each
feature app, so each ships as its own code-split bundle, loaded only when selected. This is a
runtime module-composition pattern — the natural next step to "true" MFE is exposing each as an
independently-deployed Module-Federation remote; the shell already treats them as swappable modules.

**Backend.** FastAPI wraps the pandas/sklearn layer. Every endpoint serialises through
`records(df) = json.loads(df.to_json(orient="records"))`, which converts `NaN → null` and numpy
scalars → native — the two things FastAPI's default encoder chokes on. The master DataFrame is
built **once at startup** and reused for every request (slow first boot, fast thereafter).

**Data layer.** `data.py` assembles one master DataFrame: transfers joined to per-season club
leagues (derived from valuations, not the static — and unreliable — `clubs.csv`), player profiles,
buying/selling squad values, and the *previous* season's Big-5 and non-Big-5 stats.

---

## The dashboard (six analyses)

| Panel | What it shows |
|---|---|
| **Fee inflation** | Median vs mean fee vs market value per season — median rises modestly, mean chases megadeals. |
| **Fee vs caliber** | Top signings' fee/value vs on-pitch output over time; attacker deep-dive shows fees ~4× while goals-per-90 stayed flat. |
| **Top transfers / Best free signings** | Biggest paid deals and most valuable free transfers, by league and season (loans best-effort filtered). |
| **Club transfer activity** | Any club's spend / income / net by season, drilling into the individual deals. |
| **Best player traders** | Biggest net earners from the Big 5 (Benfica, Ajax, Porto…) — the buy-low-sell-high clubs. |
| **Player origins** | Nationality mix of a league, or which leagues a country's players play in (donut, by confederation). |
| **Recruitment** | Where each league buys from — domestic / other Big-5 / outside — over time, with per-season drill-down. |

---

## The models (honestly)

Both use a temporal split (train ≤ 22/23, test 23/24+), log-transformed targets, and
`HistGradientBoostingRegressor` (handles the ~60% missing prior-season stats natively).

**Market-value predictor (the shipped model).** A genuine task — no single feature gives the
answer away. **R² ≈ 0.63, MAE ≈ €2.58m**, versus a predict-the-median baseline of €4.39m. Top
drivers: **playing time (minutes)** and **destination-club squad value**, then age. The UI shows a
predicted-vs-actual scatter (r ≈ 0.81) and guards inputs outside the training range.

In one line: a **good average valuer, a poor superstar valuer**. It prices a typical player
within a couple of million, but badly under-values elite outliers — it predicts ~€20m for a
Florian Wirtz (real value €140m), because superstar value lives in intangibles (talent, hype,
bidding) the dataset can't see, and the trees can't exceed their ~€45m training ceiling.

**Fee predictor (kept as a counter-example).** Predicting the *fee* is near-pointless:
Transfermarkt's market value is *already* a fee estimate, so the model (R² ≈ 0.81) barely beats
simply quoting the market value (R² ≈ 0.81). Documented as a finding, not an accuracy flex — and
the reason the project pivoted to predicting value instead.

---

## Engineering judgment (the part worth reading)

The decisions matter more than any single score:

- **Left out the feature that would have cheated.** The *selling* club's squad value lifts R²
  to ~0.65, but a squad value is the *sum of its players' values* — the player being predicted is
  inside his own selling club's total. That's target leakage; excluded. The honest 0.63 nearly
  matches the leaky ceiling, so integrity cost almost nothing.
- **Two more features excluded as leakage:** `peak_value` (career-max ≈ the target) and
  `international_caps` — both snapshots as of the 2024 data pull, so anachronistic for old deals.
- **Tested and rejected three alternatives:** dropping market value (worse), modelling the
  fee-over-value *premium* (unpredictable from this data — it needs contract length, release
  clauses, bidder count), and training separate models per position (a single model with
  `position` as a feature won — trees already specialise by branch).
- **Leakage-safe stats join:** each transfer carries the *previous* season's numbers (what the
  club knew), verified safe across both summer and winter windows.
- **Loans masquerade as free transfers** (no loan flag; both recorded at €0) — caught via the
  round-trip tell and filtered.
- **Honest failure modes:** gradient-boosted trees can't extrapolate, so the predictor *warns*
  on out-of-range inputs (a €100m valuation, or a teenage 25-goal midfielder) instead of bluffing.

---

## Project structure

```
transfer-data-analysis/
├── backend/
│   ├── data.py                 master DataFrame + filters (built once at import)
│   ├── analytics.py            one pandas function per analysis/endpoint
│   ├── model.py                value + fee models, feature importance, agreement
│   ├── main.py                 FastAPI app (records() JSON-safe serialiser)
│   ├── data_extraction/        transfers / clubs / players / valuations / stats loaders
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── App.jsx             shell: responsive side nav + lazy MFE mounts
│       ├── mfe-analytics/      Transfer Analytics micro-frontend
│       ├── mfe-predictor/      Value Predictor micro-frontend
│       └── components/         charts, tables, stat cards (Recharts)
└── archive/                    Transfermarkt CSVs + PROGRESS.md (full decision log)
```

---

## Run it locally

```bash
# Backend (from project root) — first boot builds the DataFrame (~10-30s)
python3 -m pip install -r backend/requirements.txt
python3 -m uvicorn backend.main:app --reload        # http://localhost:8000

# Frontend (second terminal)
cd frontend && npm install && npm run dev            # http://localhost:5173
```

The Vite dev server proxies `/api` to the backend, so no CORS setup is needed in dev.

---

## Known limitations

Stated plainly (full log in `archive/PROGRESS.md`):

- **Older seasons are under-recorded** in the source data — e.g. Agüero's 2011 move is absent
  entirely; raw transfer counts grow ~8× from 2009 to 2024. Treat pre-~2015 figures as lower bounds.
- **Player-origin composition is approximate** — it uses each player's *latest* league (a snapshot),
  and continent tagging matches ~84/107 countries (mostly African nations fall to "Other").
- **The club→league map over-counts the top flight** — it's a union over seasons (promotion/
  relegation), so each league shows ~35 clubs vs ~20 at any one time.
- **The value model predicts Transfermarkt's *estimate*,** not an independent ground truth.

---

## Roadmap

- Deploy (backend on a container host, frontend on static hosting) so it's a clickable link.
- Add automated tests + CI, and swap in-memory CSVs for a queryable store (DuckDB/SQLite).
- Integrate a contract/clause data source to make the fee-premium actually modellable.
- Promote the MFEs to true Module-Federation remotes for independent deploys.
# transfer-data-analysis
