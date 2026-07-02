import pandas as pd
from typing import Optional

from backend.data_extraction.transfers  import load_transfers
from backend.data_extraction.clubs      import load_clubs
from backend.data_extraction.players    import load_players
from backend.data_extraction.stats_big5      import load_stats
from backend.data_extraction.stats_external  import load_external_stats
from backend.data_extraction.valuations   import load_squad_values_by_season

BIG5 = ["GB1", "ES1", "FR1", "IT1", "L1"]

# Latest season to include, by season_sort_key ("25/26" = 2025). Single source
# of truth — every analytics default uses this so ranges never drift apart.
# 26/27 (2026) has no data yet; kept as a forward-safe cap.
SEASON_MAX = 2026

LEAGUE_NAMES = {
    "GB1": "Premier League",
    "ES1": "La Liga",
    "FR1": "Ligue 1",
    "IT1": "Serie A",
    "L1":  "Bundesliga",
}


def _build() -> pd.DataFrame:

    transfers = load_transfers()
    clubs     = load_clubs()
    players   = load_players()

    # ── join: buying club league ──────────────────────────────────────
    df = transfers.merge(
        clubs.rename(columns={
            "club_id":   "to_club_id",
            "club_name": "buying_club_name",
            "league_id": "buying_club_league",
        }).drop(columns=["season_sort_key"]),
        on=["to_club_id", "transfer_season"],
        how="left",
    )

    # ── join: selling club league ─────────────────────────────────────
    df = df.merge(
        clubs.rename(columns={
            "club_id":   "from_club_id",
            "club_name": "selling_club_name",
            "league_id": "selling_club_league",
        }).drop(columns=["season_sort_key"]),
        on=["from_club_id", "transfer_season"],
        how="left",
    )

    # Keep transfers where AT LEAST ONE club is in the Big 5
    df = df[
        df["buying_club_league"].isin(BIG5) |
        df["selling_club_league"].isin(BIG5)
    ]

    # Tag transfer direction
    def _direction(row):
        buying_in  = row["buying_club_league"]  in BIG5
        selling_in = row["selling_club_league"] in BIG5
        if buying_in and selling_in:
            return "internal"
        elif buying_in:
            return "inbound"
        else:
            return "outbound"

    df["transfer_direction"] = df.apply(_direction, axis=1)

    # league_id = Big 5 league involved (buying club takes priority)
    df["league_id"] = df.apply(
        lambda r: r["buying_club_league"] if r["buying_club_league"] in BIG5
                  else r["selling_club_league"],
        axis=1,
    )

    # ── join: squad values (buying + selling club) ────────────────────
    # One row per (club, season), so these left joins can't duplicate rows.
    squad = load_squad_values_by_season()[
        ["club_id", "transfer_season", "squad_value_in_millions"]
    ]

    df = df.merge(
        squad.rename(columns={
            "club_id":                 "to_club_id",
            "squad_value_in_millions": "buying_squad_value_in_millions",
        }),
        on=["to_club_id", "transfer_season"],
        how="left",
    )

    df = df.merge(
        squad.rename(columns={
            "club_id":                 "from_club_id",
            "squad_value_in_millions": "selling_squad_value_in_millions",
        }),
        on=["from_club_id", "transfer_season"],
        how="left",
    )

    # ── join: player profile ──────────────────────────────────────────
    df = df.merge(players, on="player_id", how="left")

    # ── join: previous completed season's Big-5 stats ─────────────────
    # Leakage-safe: season N-1 finished before either window (summer OR
    # winter) of season N opened, so these are numbers the buying club
    # actually had. Most rows stay null — youth/non-Big5/inactive players
    # have no prior Big-5 record, which is the correct signal.
    # TODO(winter): a Jan buy has already seen ~half of season N; this
    # ignores that partial form. A date-aware version (appearances before
    # transfer_date) would capture it — deferred, half-seasons are noisy.
    stats = (
        load_stats()
        .drop(columns=["transfer_season"])
        .rename(columns={"season_sort_key": "_stats_season"})
    )
    df["_prev_season"] = df["season_sort_key"] - 1
    df = df.merge(
        stats,
        left_on=["player_id", "_prev_season"],
        right_on=["player_id", "_stats_season"],
        how="left",
    ).drop(columns=["_stats_season"])

    # ── join: previous season's NON-Big5 stats (ext_*) ────────────────
    # Same leakage-safe prior-season key. Carries a player's form in
    # feeder leagues (Eredivisie, Primeira, etc.) the year before moving
    # — the signal a club actually buys inbound players on. A player can
    # have both big5_* and ext_* for one season (mid-season mover); fine.
    ext = (
        load_external_stats()
        .drop(columns=["transfer_season"])
        .rename(columns={"season_sort_key": "_ext_season"})
    )
    df = df.merge(
        ext,
        left_on=["player_id", "_prev_season"],
        right_on=["player_id", "_ext_season"],
        how="left",
    ).drop(columns=["_prev_season", "_ext_season"])

    # Age at time of transfer
    df["age_at_transfer"] = (
        (df["transfer_date"] - df["date_of_birth"]).dt.days / 365.25
    ).round(1)

    # Fee to market value ratio — how much did the club over/underpay?
    df["fee_to_value_ratio"] = (
        df["fee_in_millions"] / df["market_value_in_millions"].replace(0, pd.NA)
    ).round(2)

    # Did the player change leagues? NaN (non-Big5) counts as "different".
    df["is_cross_league_transfer"] = (
        df["selling_club_league"] != df["buying_club_league"]
    )

    return df


DF = _build()


def filter_transfers(
    league:     Optional[str] = None,
    season_min: int = 2009,
    season_max: int = SEASON_MAX,
    paid_only:  bool = False,
    free_only:  bool = False,
) -> pd.DataFrame:
    """
    Central filter — every analytics function calls this.
    Add new filters here and they work everywhere.
    """
    d = DF[
        (DF["season_sort_key"] >= season_min) &
        (DF["season_sort_key"] <= season_max)
    ]

    if league:
        d = d[d["league_id"] == league]
    if paid_only:
        d = d[~d["is_free_transfer"]]
    if free_only:
        d = d[d["is_free_transfer"]]

    return d


def net_spend_by_club_season() -> pd.DataFrame:
    """
    Net transfer spend per club per season — a standalone club-season table.

    Deliberately NOT merged onto DF: a club's net spend for a season already
    contains the fee of every transfer in it, so using it as a per-transfer
    model feature would leak the target. This is for analytics/charts only.

    Undisclosed fees (NaN) are dropped — we only count money we can see.
    Free transfers (a known fee of 0) stay in.
    """
    known = DF[DF["fee_in_millions"].notna()]

    spend = known.groupby(
        ["to_club_id", "buying_club_name", "transfer_season", "season_sort_key"],
        as_index=False,
    )["fee_in_millions"].sum().rename(columns={
        "to_club_id":       "club_id",
        "buying_club_name": "club_name",
        "fee_in_millions":  "gross_spend",
    })

    income = known.groupby(
        ["from_club_id", "transfer_season"],
        as_index=False,
    )["fee_in_millions"].sum().rename(columns={
        "from_club_id":    "club_id",
        "fee_in_millions": "income",
    })

    out = spend.merge(income, on=["club_id", "transfer_season"], how="outer")
    out[["gross_spend", "income"]] = out[["gross_spend", "income"]].fillna(0)
    out["net_spend"] = (out["gross_spend"] - out["income"]).round(2)

    return out.sort_values("net_spend", ascending=False).reset_index(drop=True)