"""
analytics.py — the analysis layer: pure pandas functions, one per dashboard
chart/endpoint. Each returns a small, chart-ready DataFrame (or list) built from
the master DataFrame in data.py. Organised into three sections:

    1. MARKET TRENDS   inflation, price-vs-caliber, top deals, KPIs
    2. CLUBS           recruitment, net earners, per-club ledgers, pickers
    3. PLAYER ORIGINS  nationality / league composition (from valuations)

Kept as one module (cohesive, all pure functions); the routers in routers/ are
what group these into the HTTP API.
"""
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Optional

from backend.data import filter_transfers, DF, BIG5, SEASON_MAX
from backend.data_extraction.valuations import load_squad_values_by_season

ARCHIVE = Path(__file__).parent.parent / "archive"


# ══════════════════════════════════════════════════════════════════════════
# 1. MARKET TRENDS
# ══════════════════════════════════════════════════════════════════════════

def summary_stats() -> dict:
    """Headline KPIs for the dashboard's top row."""
    real = DF[DF["is_real_transfer"]]
    paid = DF[DF["is_paid_transfer"] & DF["fee_in_millions"].notna()]
    rec = paid.loc[paid["fee_in_millions"].idxmax()]
    return {
        "transfers": int(len(real)),
        "total_spend_bn": round(float(paid["fee_in_millions"].sum()) / 1000, 1),
        "record_fee": round(float(rec["fee_in_millions"]), 1),
        "record_player": str(rec["player_name"]),
        "clubs": int(DF.loc[DF["buying_club_league"].isin(BIG5), "to_club_id"].nunique()),
    }


def inflation_trends(
    league: Optional[str] = None,
    season_min: int = 2009,
    season_max: int = SEASON_MAX,
) -> pd.DataFrame:
    """
    Fee inflation over time: per season, the typical paid transfer fee vs the
    players' assessed market value.

    Paid transfers only — free (0) deals would drag the average toward zero and
    measure Bosman volume instead of price. Fees are heavily right-skewed, so
    median is the honest headline; mean is included for reference.
    """
    d = filter_transfers(league=league, season_min=season_min, season_max=season_max, paid_only=True)
    out = d.groupby(["transfer_season", "season_sort_key"], as_index=False).agg(
        deals=("fee_in_millions", "size"),
        median_fee=("fee_in_millions", "median"),
        mean_fee=("fee_in_millions", "mean"),
        median_value=("market_value_in_millions", "median"),
        mean_value=("market_value_in_millions", "mean"),
    )
    out["median_premium"] = (out["median_fee"] - out["median_value"]).round(2)
    num = ["median_fee", "mean_fee", "median_value", "mean_value"]
    out[num] = out[num].round(2)
    return out.sort_values("season_sort_key").reset_index(drop=True)


def big_money_caliber(
    league: Optional[str] = None,
    position: Optional[str] = None,
    top_n: int = 25,
    season_min: int = 2013,
    season_max: int = SEASON_MAX,
) -> pd.DataFrame:
    """
    "Price detached from caliber." For the top_n most expensive paid transfers
    each season (constant sample -> no composition artifact), track fee, market
    value and caliber over time, indexed to base = 100.

    league:   restricts to money SPENT BY that league (buying club in it).
    position: restricts to a position group.
      position=None -> use FEE vs MARKET VALUE vs AGE (G+A/90 invalid: only ~43%
        of top deals are attackers). position="Attack" -> G+A/90 becomes meaningful.

    Caveats: AGE is a control, not caliber. market_value is the only contemporaneous
    caliber proxy (caps/peak_value are broken snapshots). Per league, index magnitude
    is base-year sensitive — read the SHAPE, not the level.
    """
    d = filter_transfers(season_min=season_min, season_max=season_max, paid_only=True).copy()
    if league:
        d = d[d["buying_club_league"] == league]
    if position:
        d = d[d["position"] == position]
    d["ga_per_90"] = (d["big5_goal_contributions"] / d["big5_minutes"].replace(0, np.nan)) * 90

    rows = []
    for season_key, g in d.groupby("season_sort_key"):
        top = g.nlargest(top_n, "fee_in_millions")
        rows.append({
            "season_sort_key": season_key,
            "transfer_season": top["transfer_season"].iloc[0],
            "median_fee": round(top["fee_in_millions"].median(), 1),
            "median_market_value": round(top["market_value_in_millions"].median(), 1),
            "median_age": round(top["age_at_transfer"].median(), 1),
            "median_prior_minutes": round(top["big5_minutes"].fillna(0).median(), 0),
            "median_ga_per_90": round(top["ga_per_90"].median(), 2),
        })

    out = pd.DataFrame(rows).sort_values("season_sort_key").reset_index(drop=True)
    for col in ["median_fee", "median_market_value", "median_age", "median_prior_minutes", "median_ga_per_90"]:
        base = out[col].iloc[0]
        out[col.replace("median_", "") + "_idx"] = (out[col] / base * 100).round(1)
    return out


def top_transfers(
    league: Optional[str] = None,
    season_min: int = 2009,
    season_max: int = SEASON_MAX,
    top_n: int = 10,
) -> pd.DataFrame:
    """
    Most expensive paid transfers per season, display-ready. If league is given,
    restricts to money SPENT BY that league (buying club in it) — consistent with
    big_money_caliber (filter_transfers' league arg would also sweep in outbound sales).
    """
    d = filter_transfers(season_min=season_min, season_max=season_max, paid_only=True)
    if league:
        d = d[d["buying_club_league"] == league]
    cols = [
        "season_sort_key", "transfer_season", "player_name", "position",
        "age_at_transfer", "buying_club_name", "selling_club_name",
        "fee_in_millions", "market_value_in_millions", "fee_to_value_ratio",
    ]
    top = d.sort_values("fee_in_millions", ascending=False).groupby("season_sort_key", group_keys=False).head(top_n)
    return top.sort_values(["season_sort_key", "fee_in_millions"], ascending=[True, False])[cols].reset_index(drop=True)


def best_free_transfers(
    league: Optional[str] = None,
    season_min: int = 2009,
    season_max: int = SEASON_MAX,
    top_n: int = 5,
) -> pd.DataFrame:
    """
    Most valuable FREE (zero-fee) signings per season, ranked by market value.

    DATA CAVEAT: no loan flag, and loans are also recorded at fee = 0, so sorting
    free moves by value surfaces mostly LOANS. Best-effort mitigation: drop non-real
    transfers, and drop ROUND-TRIP loans (a zero-fee move whose reverse also exists).
    Still misses in-progress-season loans that haven't returned yet.
    """
    free_all = DF[DF["is_free_transfer"] & DF["is_real_transfer"]]
    reverse = set(zip(free_all["player_id"], free_all["to_club_id"], free_all["from_club_id"]))

    d = filter_transfers(season_min=season_min, season_max=season_max, free_only=True)
    d = d[d["is_real_transfer"]].copy()
    if league:
        d = d[d["buying_club_league"] == league]
    is_loan = [(pid, fc, tc) in reverse for pid, fc, tc in zip(d["player_id"], d["from_club_id"], d["to_club_id"])]
    d = d[~pd.Series(is_loan, index=d.index)]

    cols = [
        "season_sort_key", "transfer_season", "player_name", "position",
        "age_at_transfer", "buying_club_name", "selling_club_name", "market_value_in_millions",
    ]
    top = d.sort_values("market_value_in_millions", ascending=False).groupby("season_sort_key", group_keys=False).head(top_n)
    return top.sort_values(["season_sort_key", "market_value_in_millions"], ascending=[True, False])[cols].reset_index(drop=True)


# ══════════════════════════════════════════════════════════════════════════
# 2. CLUBS
# ══════════════════════════════════════════════════════════════════════════

def recruitment_by_source(season_min: int = 2009, season_max: int = SEASON_MAX) -> pd.DataFrame:
    """How each Big-5 league recruits: incoming transfers split domestic /
    other_big5 / outside_big5. Returns counts + shares (shares = fair comparison)."""
    d = DF[DF["buying_club_league"].isin(BIG5) & DF["is_real_transfer"] & DF["season_sort_key"].between(season_min, season_max)].copy()
    same = d["selling_club_league"] == d["buying_club_league"]
    other = d["selling_club_league"].isin(BIG5) & ~same
    d["source"] = np.where(same, "domestic", np.where(other, "other_big5", "outside_big5"))
    out = (
        d.groupby(["buying_club_league", "source"]).size().unstack(fill_value=0)
         .reindex(BIG5).reindex(columns=["domestic", "other_big5", "outside_big5"], fill_value=0)
    )
    out["total"] = out.sum(axis=1)
    for c in ["domestic", "other_big5", "outside_big5"]:
        out[c + "_pct"] = (out[c] / out["total"] * 100).round(1)
    return out.reset_index().rename(columns={"buying_club_league": "league"})


def recruitment_trends(season_min: int = 2009, season_max: int = SEASON_MAX) -> pd.DataFrame:
    """Per-league, per-SEASON recruitment mix — the time series behind the
    year-wise line chart with per-season drill-down."""
    d = DF[DF["buying_club_league"].isin(BIG5) & DF["is_real_transfer"] & DF["season_sort_key"].between(season_min, season_max)].copy()
    same = d["selling_club_league"] == d["buying_club_league"]
    other = d["selling_club_league"].isin(BIG5) & ~same
    d["source"] = np.where(same, "domestic", np.where(other, "other_big5", "outside_big5"))
    out = (
        d.groupby(["buying_club_league", "transfer_season", "season_sort_key", "source"]).size()
         .unstack(fill_value=0).reindex(columns=["domestic", "other_big5", "outside_big5"], fill_value=0).reset_index()
    )
    out["total"] = out[["domestic", "other_big5", "outside_big5"]].sum(axis=1)
    for c in ["domestic", "other_big5", "outside_big5"]:
        out[c + "_pct"] = (out[c] / out["total"] * 100).round(1)
    return out.rename(columns={"buying_club_league": "league"}).sort_values(["league", "season_sort_key"]).reset_index(drop=True)


def top_net_earners(top_n: int = 12, season_min: int = 2009, season_max: int = SEASON_MAX) -> pd.DataFrame:
    """Best buy-low-sell-high clubs: biggest NET EARNERS from the Big 5 (fees
    received selling TO Big-5 minus fees paid buying FROM Big-5). Only Big-5-involved
    deals exist, so for feeder clubs this is net cash pulled OUT of the Big 5."""
    known = DF[DF["fee_in_millions"].notna() & DF["is_real_transfer"] & DF["season_sort_key"].between(season_min, season_max)]
    earned = known.groupby("from_club_id")["fee_in_millions"].sum()
    spent = known.groupby("to_club_id")["fee_in_millions"].sum()
    names = pd.concat([
        known[["from_club_id", "selling_club_name"]].rename(columns={"from_club_id": "club_id", "selling_club_name": "club_name"}),
        known[["to_club_id", "buying_club_name"]].rename(columns={"to_club_id": "club_id", "buying_club_name": "club_name"}),
    ]).dropna().drop_duplicates("club_id").set_index("club_id")["club_name"]

    out = pd.DataFrame({"earned": earned, "spent": spent}).fillna(0)
    out["net_earned"] = (out["earned"] - out["spent"]).round(1)
    out["earned"] = out["earned"].round(1)
    out["spent"] = out["spent"].round(1)
    out["club_name"] = names
    out = out.dropna(subset=["club_name"]).reset_index().rename(columns={"index": "club_id"})
    out["club_id"] = out["club_id"].astype(int)
    return out.sort_values("net_earned", ascending=False).head(top_n)[["club_id", "club_name", "earned", "spent", "net_earned"]].reset_index(drop=True)


def top_net_spenders(top_n: int = 10, season_min: int = 2009, season_max: int = SEASON_MAX) -> pd.DataFrame:
    """Mirror of top_net_earners: biggest NET SPENDERS (fees paid buying minus
    fees received selling) — the clubs bankrolling the market."""
    known = DF[DF["fee_in_millions"].notna() & DF["is_real_transfer"] & DF["season_sort_key"].between(season_min, season_max)]
    spent = known.groupby("to_club_id")["fee_in_millions"].sum()
    earned = known.groupby("from_club_id")["fee_in_millions"].sum()
    names = pd.concat([
        known[["to_club_id", "buying_club_name"]].rename(columns={"to_club_id": "club_id", "buying_club_name": "club_name"}),
        known[["from_club_id", "selling_club_name"]].rename(columns={"from_club_id": "club_id", "selling_club_name": "club_name"}),
    ]).dropna().drop_duplicates("club_id").set_index("club_id")["club_name"]

    out = pd.DataFrame({"spent": spent, "earned": earned}).fillna(0)
    out["net_spent"] = (out["spent"] - out["earned"]).round(1)
    out["club_name"] = names
    out = out.dropna(subset=["club_name"]).reset_index().rename(columns={"index": "club_id"})
    out["club_id"] = out["club_id"].astype(int)
    return out.sort_values("net_spent", ascending=False).head(top_n)[["club_id", "club_name", "net_spent"]].reset_index(drop=True)


def spend_by_position(season_min: int = 2009, season_max: int = SEASON_MAX) -> list:
    """Total transfer fees spent by Big-5 clubs, split by position group — where
    the money goes. Returns [{name, value}] for a donut."""
    d = DF[
        DF["is_paid_transfer"] & DF["fee_in_millions"].notna()
        & DF["buying_club_league"].isin(BIG5)
        & DF["season_sort_key"].between(season_min, season_max)
    ]
    s = d.groupby("position")["fee_in_millions"].sum().round(0).sort_values(ascending=False)
    return [{"name": str(k), "value": int(v)} for k, v in s.items() if pd.notna(k)]


def club_transfer_activity(club_id: int) -> pd.DataFrame:
    """One club's ledger per season: money_spent / money_earned / net_spend (fee-known)."""
    known = DF[DF["fee_in_millions"].notna()]
    spent = known[known["to_club_id"] == club_id].groupby(["season_sort_key", "transfer_season"], as_index=False)["fee_in_millions"].sum().rename(columns={"fee_in_millions": "money_spent"})
    earned = known[known["from_club_id"] == club_id].groupby(["season_sort_key", "transfer_season"], as_index=False)["fee_in_millions"].sum().rename(columns={"fee_in_millions": "money_earned"})
    out = spent.merge(earned, on=["season_sort_key", "transfer_season"], how="outer")
    out[["money_spent", "money_earned"]] = out[["money_spent", "money_earned"]].fillna(0).round(2)
    out["net_spend"] = (out["money_spent"] - out["money_earned"]).round(2)
    return out.sort_values("season_sort_key").reset_index(drop=True)


def club_season_transfers(club_id: int, season: str) -> pd.DataFrame:
    """Every transfer (in/out) for a club in one season — the drill-down table."""
    d = DF[(DF["transfer_season"] == season) & ((DF["to_club_id"] == club_id) | (DF["from_club_id"] == club_id))].copy()
    inbound = d["to_club_id"] == club_id
    d["direction"] = np.where(inbound, "in", "out")
    d["counterpart"] = np.where(inbound, d["selling_club_name"], d["buying_club_name"])
    cols = ["player_name", "position", "direction", "counterpart", "fee_in_millions", "market_value_in_millions", "is_free_transfer", "is_undisclosed_fee"]
    return d.sort_values("fee_in_millions", ascending=False, na_position="last")[cols].reset_index(drop=True)


def list_clubs() -> pd.DataFrame:
    """Big-5 clubs (buyer or seller) with fee activity — club_id, club_name,
    league (primary, by frequency), total_activity. Powers the league->club picker."""
    known = DF[DF["fee_in_millions"].notna()]
    buy = known.loc[known["buying_club_league"].isin(BIG5), ["to_club_id", "buying_club_name", "buying_club_league", "fee_in_millions"]].rename(columns={"to_club_id": "club_id", "buying_club_name": "club_name", "buying_club_league": "league"})
    sell = known.loc[known["selling_club_league"].isin(BIG5), ["from_club_id", "selling_club_name", "selling_club_league", "fee_in_millions"]].rename(columns={"from_club_id": "club_id", "selling_club_name": "club_name", "selling_club_league": "league"})
    both = pd.concat([buy, sell]).dropna(subset=["club_id", "club_name", "league"])
    g = both.groupby("club_id")
    out = pd.DataFrame({
        "club_name": g["club_name"].agg(lambda s: s.value_counts().index[0]),
        "league": g["league"].agg(lambda s: s.value_counts().index[0]),
        "total_activity": g["fee_in_millions"].sum().round(1),
    }).reset_index().sort_values("total_activity", ascending=False)
    out["club_id"] = out["club_id"].astype(int)
    return out[["club_id", "club_name", "league", "total_activity"]].reset_index(drop=True)


_TOP_CLUBS = None


def top_clubs_by_value() -> pd.DataFrame:
    """All Big-5 clubs with their most recent squad value + league — powers the
    value predictor's league -> team picker. Sorted by squad value (biggest first)."""
    global _TOP_CLUBS
    if _TOP_CLUBS is None:
        sv = load_squad_values_by_season()
        latest = sv.sort_values("season_sort_key").groupby("club_id", as_index=False).last()
        latest = latest[latest["league_id"].isin(BIG5)]
        _TOP_CLUBS = latest.sort_values("squad_value_in_millions", ascending=False)
    return _TOP_CLUBS[["club_name", "squad_value_in_millions", "league_id"]].reset_index(drop=True)


# ══════════════════════════════════════════════════════════════════════════
# 3. PLAYER ORIGINS  (nationality / league composition, from valuations)
# ══════════════════════════════════════════════════════════════════════════

BIG5_NAMES = {"GB1": "Premier League", "ES1": "La Liga", "FR1": "Ligue 1", "IT1": "Serie A", "L1": "Bundesliga"}
_CONF = {"afrika": "Africa", "amerika": "Americas", "asien": "Asia", "europa": "Europe"}
_PLC = None            # cached player -> latest league + country
_LEAGUE_NAMES = None   # cached competition_id -> pretty name
_COUNTRY_CONT = None   # cached country_name -> continent


def _league_name(code: str) -> str:
    global _LEAGUE_NAMES
    if _LEAGUE_NAMES is None:
        comp = pd.read_csv(ARCHIVE / "competitions.csv", usecols=["competition_id", "name"])
        _LEAGUE_NAMES = {r.competition_id: str(r.name).replace("-", " ").title() for r in comp.itertuples()}
        _LEAGUE_NAMES.update(BIG5_NAMES)
    return _LEAGUE_NAMES.get(code, code)


def _player_league_country() -> pd.DataFrame:
    """One row per player: their LATEST known domestic league + nationality. Cached."""
    global _PLC
    if _PLC is None:
        pv = pd.read_csv(ARCHIVE / "player_valuations.csv", usecols=["player_id", "date", "player_club_domestic_competition_id"])
        pv["date"] = pd.to_datetime(pv["date"], errors="coerce")
        latest = pv.dropna(subset=["player_club_domestic_competition_id"]).sort_values("date").groupby("player_id", as_index=False).last().rename(columns={"player_club_domestic_competition_id": "league"})
        players = pd.read_csv(ARCHIVE / "players.csv", usecols=["player_id", "country_of_citizenship"])
        _PLC = latest.merge(players, on="player_id", how="left").dropna(subset=["league", "country_of_citizenship"])
    return _PLC


def _country_continent() -> dict:
    """country_name -> continent (from countries.csv confederation; unmatched = Other)."""
    global _COUNTRY_CONT
    if _COUNTRY_CONT is None:
        co = pd.read_csv(ARCHIVE / "countries.csv", usecols=["country_name", "confederation"])
        _COUNTRY_CONT = {r.country_name: _CONF.get(str(r.confederation).lower(), "Other") for r in co.itertuples()}
    return _COUNTRY_CONT


def _pie(counts: pd.Series, top_n: int) -> list:
    """label->count Series -> [{name, value}] with a rolled-up 'Other'."""
    counts = counts[counts.index.notna()]
    data = [{"name": str(k), "value": int(v)} for k, v in counts.head(top_n).items()]
    other = int(counts.iloc[top_n:].sum())
    if other > 0:
        data.append({"name": "Other", "value": other})
    return data


def league_nationalities(league: str, top_n: int = 10) -> list:
    """Nationality breakdown of players whose latest league is `league`."""
    plc = _player_league_country()
    return _pie(plc.loc[plc["league"] == league, "country_of_citizenship"].value_counts(), top_n)


def country_leagues(country: str, top_n: int = 10) -> list:
    """League breakdown of players from `country` (leagues -> pretty names)."""
    plc = _player_league_country()
    counts = plc.loc[plc["country_of_citizenship"] == country, "league"].value_counts()
    counts.index = [_league_name(c) for c in counts.index]
    counts = counts.groupby(level=0).sum().sort_values(ascending=False)
    return _pie(counts, top_n)


def list_countries(min_players: int = 25) -> pd.DataFrame:
    """Countries with >= min_players tracked, tagged with a continent."""
    plc = _player_league_country()
    c = plc["country_of_citizenship"].value_counts()
    c = c[c >= min_players]
    cc = _country_continent()
    return pd.DataFrame({"country": c.index, "players": c.values.astype(int), "continent": [cc.get(k, "Other") for k in c.index]})
