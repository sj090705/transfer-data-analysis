"""
model.py — transfer-fee prediction.

Two models trained off the same master DataFrame:
  * FULL — every non-leaky feature, for the "what drives fees" story
    (feature importance + how much we gain BEYOND market value).
  * LEAN — only features a user could type into a form, powering the
    interactive predictor.

Design choices, and why:
  * TARGET = log1p(fee). Fees are extremely right-skewed (a few €100m deals);
    modelling log(fee) stops those whales from dominating the loss, then we
    expm1() back to € millions for reporting.
  * TEMPORAL split (train <= 22/23, test 23/24+). A random split would let the
    model peek at the same seasons it's tested on; predicting *future* fees is
    the real task, so we train on the past and test on the most recent seasons.
  * HistGradientBoostingRegressor. Gradient-boosted trees handle non-linear
    feature interactions and — crucially — ingest NaN natively, so the ~60% of
    rows with no prior-season stats need no made-up imputation.
  * Dropped as features: international_caps, peak_value_in_millions (snapshot
    columns = career totals as of 2024, so anachronistic/leaky for old deals);
    net_spend (circular — contains the fee).
  * Baselines: (a) naive "fee = market value" and (b) a market-value-only model,
    so we can see whether the extra features earn their keep.
"""
import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.inspection import permutation_importance

from backend.data import DF

TARGET = "fee_in_millions"
SPLIT_SEASON = 2022  # train <= this sort key, test after

NUM_FULL = [
    "market_value_in_millions", "age_at_transfer",
    "buying_squad_value_in_millions", "selling_squad_value_in_millions",
    "big5_goals", "big5_assists", "big5_minutes",
    "big5_goals_per_90", "big5_clean_sheet_rate",
]
CAT_FULL = ["position", "league_id", "big5_prior_league", "is_cross_league_transfer"]

NUM_LEAN = ["market_value_in_millions", "age_at_transfer"]
CAT_LEAN = ["position", "league_id", "is_cross_league_transfer"]

FEATURES = {"full": (NUM_FULL, CAT_FULL), "lean": (NUM_LEAN, CAT_LEAN)}
_CACHE = {}


def _dataset() -> pd.DataFrame:
    # Paid transfers with a known market value; drop the sparse pre-2013 tail.
    return DF[
        DF["is_paid_transfer"]
        & DF["fee_in_millions"].notna()
        & DF["market_value_in_millions"].notna()
        & (DF["season_sort_key"] >= 2013)
    ].copy()


def _xy(d, num, cat):
    X = d[num + cat].copy()
    for c in cat:  # categoricals -> strings, NaN -> its own "NA" category
        X[c] = X[c].astype("object").where(d[c].notna(), "NA").astype(str)
    y = np.log1p(d[TARGET])
    return X, y


def _pipe(num, cat):
    pre = ColumnTransformer([
        ("cat", OneHotEncoder(handle_unknown="ignore"), cat),
        ("num", "passthrough", num),
    ])
    return Pipeline([("pre", pre), ("gb", HistGradientBoostingRegressor(random_state=0))])


def train(kind: str = "full"):
    """Fit a model + compute test metrics vs baselines. Cached per kind."""
    if kind in _CACHE:
        return _CACHE[kind]

    num, cat = FEATURES[kind]
    d = _dataset()
    train_df = d[d["season_sort_key"] <= SPLIT_SEASON]
    test_df = d[d["season_sort_key"] > SPLIT_SEASON]

    Xtr, ytr = _xy(train_df, num, cat)
    Xte, yte = _xy(test_df, num, cat)

    model = _pipe(num, cat).fit(Xtr, ytr)
    pred = np.expm1(model.predict(Xte))          # back to € millions
    actual = test_df[TARGET].to_numpy()

    # naive baseline: quote the market value as the fee
    base = test_df["market_value_in_millions"].to_numpy()

    result = {
        "model": model,
        "features": {"num": num, "cat": cat},
        "n_train": int(len(train_df)),
        "n_test": int(len(test_df)),
        "mae": round(float(mean_absolute_error(actual, pred)), 2),
        "r2": round(float(r2_score(actual, pred)), 3),
        "baseline_mae": round(float(mean_absolute_error(actual, base)), 2),
        "baseline_r2": round(float(r2_score(actual, base)), 3),
        "_test": (Xte, yte),
    }
    _CACHE[kind] = result
    return result


def feature_importance(kind: str = "full", top_n: int = 12) -> list:
    """Permutation importance on the test set (drop in R2 when a feature is
    shuffled) — measures each input's real contribution, post-encoding."""
    res = train(kind)
    Xte, yte = res["_test"]
    imp = permutation_importance(res["model"], Xte, yte, n_repeats=5, random_state=0)
    cols = res["features"]["num"] + res["features"]["cat"]
    out = sorted(
        ({"feature": c, "importance": round(float(m), 4)} for c, m in zip(cols, imp.importances_mean)),
        key=lambda x: x["importance"], reverse=True,
    )
    return out[:top_n]


# ── MARKET-VALUE model ────────────────────────────────────────────────────
# A real predictive task (no giveaway feature). Target = log1p(market value).
# buying_squad_value is a top-2 driver (destination club's stature) — the
# "team" input in the form. selling_squad_value is DELIBERATELY EXCLUDED: a
# club's squad value sums its players' values, so the player being valued is
# inside his selling club's total => self-inclusion leakage. Buying side is clean.
VALUE_NUM = [
    "buying_squad_value_in_millions", "age_at_transfer",
    "big5_goals", "big5_assists", "big5_minutes", "big5_clean_sheet_rate",
    # non-Big5 prior stats fill the ~60% of rows with no Big-5 record (feeder-league arrivals);
    # season captures market-value inflation; height a minor physical signal.
    "ext_goals", "ext_assists", "ext_minutes", "ext_goals_per_90",
    "height_in_cm", "season_sort_key",
]
VALUE_CAT = ["position", "league_id", "is_cross_league_transfer", "big5_prior_league", "foot"]
VTARGET = "market_value_in_millions"
LATEST_SEASON = 2025  # season_sort_key used when predicting "now" from the form


def _value_dataset():
    return DF[
        DF[VTARGET].notna() & DF["is_real_transfer"] & (DF["season_sort_key"] >= 2013)
    ].copy()


def _vxy(d):
    X = d[VALUE_NUM + VALUE_CAT].copy()
    for c in VALUE_CAT:
        X[c] = X[c].astype("object").where(d[c].notna(), "NA").astype(str)
    return X, np.log1p(d[VTARGET])


def train_value():
    if "value" in _CACHE:
        return _CACHE["value"]
    d = _value_dataset()
    tr, te = d[d["season_sort_key"] <= SPLIT_SEASON], d[d["season_sort_key"] > SPLIT_SEASON]
    Xtr, ytr = _vxy(tr)
    Xte, yte = _vxy(te)
    model = _pipe(VALUE_NUM, VALUE_CAT).fit(Xtr, ytr)
    pred = np.expm1(model.predict(Xte))
    actual = te[VTARGET].to_numpy()
    med = float(tr[VTARGET].median())
    res = {
        "model": model, "n_train": int(len(tr)), "n_test": int(len(te)),
        "mae": round(float(mean_absolute_error(actual, pred)), 2),
        "r2": round(float(r2_score(actual, pred)), 3),
        "baseline_mae": round(float(mean_absolute_error(actual, np.full_like(actual, med))), 2),
        "_test": (Xte, yte),
    }
    _CACHE["value"] = res
    return res


def value_importance(top_n: int = 10) -> list:
    res = train_value()
    Xte, yte = res["_test"]
    imp = permutation_importance(res["model"], Xte, yte, n_repeats=5, random_state=0)
    cols = VALUE_NUM + VALUE_CAT
    out = sorted(
        ({"feature": c, "importance": round(float(m), 4)} for c, m in zip(cols, imp.importances_mean)),
        key=lambda x: x["importance"], reverse=True,
    )
    return out[:top_n]


def value_agreement(sample: int = 250) -> dict:
    """How closely predictions match Transfermarkt's actual value on the unseen
    test set — the 'is it well trained' evidence: correlation, % within bands,
    and a sampled predicted-vs-actual scatter (for the y=x agreement plot)."""
    res = train_value()
    Xte, yte = res["_test"]
    pred = np.expm1(res["model"].predict(Xte))
    actual = np.expm1(yte.to_numpy())
    err = np.abs(pred - actual)
    rng = np.random.default_rng(0)
    idx = rng.choice(len(pred), size=min(sample, len(pred)), replace=False)
    return {
        "corr": round(float(np.corrcoef(pred, actual)[0, 1]), 3),
        "within5_pct": round(float((err <= 5).mean() * 100)),
        "within10_pct": round(float((err <= 10).mean() * 100)),
        "scatter": [{"p": round(float(pred[i]), 1), "a": round(float(actual[i]), 1)} for i in idx],
    }


def predict_value(squad_value, age, position, league, goals=None, minutes=None, cross_league=None) -> float:
    """Predicted market value (€m). Team clicker supplies squad_value; last-season
    goals/minutes optional (NaN if unknown — the model handles missing natively)."""
    res = train_value()
    row = pd.DataFrame([{
        "buying_squad_value_in_millions": squad_value,
        "age_at_transfer": age,
        "big5_goals": np.nan if goals is None else goals,
        "big5_assists": np.nan,
        "big5_minutes": np.nan if minutes is None else minutes,
        "big5_clean_sheet_rate": np.nan,
        "ext_goals": np.nan, "ext_assists": np.nan, "ext_minutes": np.nan, "ext_goals_per_90": np.nan,
        "height_in_cm": np.nan, "season_sort_key": LATEST_SEASON,
        "position": str(position),
        "league_id": str(league),
        "is_cross_league_transfer": "NA" if cross_league is None else str(bool(cross_league)),
        "big5_prior_league": "NA", "foot": "NA",
    }])
    return round(float(np.expm1(res["model"].predict(row)[0])), 1)


def predict_fee(market_value, age, position, league, cross_league) -> float:
    """Lean-model prediction (€m) from user-inputable fields."""
    res = train("lean")
    row = pd.DataFrame([{
        "market_value_in_millions": market_value,
        "age_at_transfer": age,
        "position": str(position),
        "league_id": str(league),
        "is_cross_league_transfer": str(bool(cross_league)),
    }])
    return round(float(np.expm1(res["model"].predict(row)[0])), 1)
