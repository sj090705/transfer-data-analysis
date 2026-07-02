import numpy as np
import pandas as pd
from pathlib import Path

BASE = Path(__file__).parent.parent.parent / "archive"

BIG5 = ["GB1", "ES1", "FR1", "IT1", "L1"]

# A clean sheet is credited only for a "real" appearance in a match the
# player's club kept scoreless. 60 min is the common convention (avoids
# rewarding late substitutes). NOTE: clean sheets are a TEAM outcome pinned
# to an individual — trustworthy for GKs, noisy for a single outfielder.
CLEAN_SHEET_MIN_MINUTES = 60


def load_stats() -> pd.DataFrame:
    """
    Loads and aggregates player appearances from Big 5 leagues only.

    Tells you how a player performed at the highest level.
    Used for internal and outbound transfers.

    Output: one row per player per season.
    """
    df = pd.read_csv(BASE / "appearances.csv", usecols=[
        "player_id",
        "game_id",
        "player_club_id",
        "competition_id",
        "date",
        "goals",
        "assists",
        "minutes_played",
        "yellow_cards",
        "red_cards",
    ])

    df = df[df["competition_id"].isin(BIG5)]

    # ── derive goals conceded -> clean sheet, from the match result ────
    games = pd.read_csv(BASE / "games.csv", usecols=[
        "game_id", "home_club_id", "away_club_id",
        "home_club_goals", "away_club_goals",
    ])
    df = df.merge(games, on="game_id", how="left")
    is_home = df["player_club_id"] == df["home_club_id"]
    df["conceded"] = np.where(is_home, df["away_club_goals"], df["home_club_goals"])
    df["is_clean_sheet"] = (
        (df["conceded"] == 0) & (df["minutes_played"] >= CLEAN_SHEET_MIN_MINUTES)
    )
    df["is_full_app"] = df["minutes_played"] >= CLEAN_SHEET_MIN_MINUTES

    df["date"] = pd.to_datetime(df["date"], errors="coerce")

    df["season_start_year"] = df["date"].apply(
        lambda d: d.year if d.month >= 7 else d.year - 1
    )
    df["transfer_season"] = df["season_start_year"].apply(
        lambda y: f"{str(y)[2:]}/{str(y + 1)[2:]}"
    )

    aggregated = df.groupby(["player_id", "transfer_season"], as_index=False).agg(
        big5_games=          ("goals",          "count"),
        big5_goals=          ("goals",          "sum"),
        big5_assists=        ("assists",         "sum"),
        big5_minutes=        ("minutes_played",  "sum"),
        big5_yellow_cards=   ("yellow_cards",    "sum"),
        big5_red_cards=      ("red_cards",       "sum"),
        big5_clean_sheets=   ("is_clean_sheet",  "sum"),
        big5_full_apps=      ("is_full_app",     "sum"),
    )

    # Clean-sheet RATE = clean sheets / appearances of >=60 min (the eligible
    # denominator). Defender/GK quality proxy. NaN when no eligible apps.
    aggregated["big5_clean_sheet_rate"] = (
        aggregated["big5_clean_sheets"]
        / aggregated["big5_full_apps"].replace(0, np.nan)
    ).round(3)

    # Which Big-5 league did these stats mainly come from? "Primary" =
    # most minutes that season (handles rare mid-season Big5-to-Big5 moves).
    # Combined stats above stay summed; this only labels their source.
    primary_league = (
        df.groupby(["player_id", "transfer_season", "competition_id"],
                   as_index=False)["minutes_played"].sum()
          .sort_values("minutes_played")
          .groupby(["player_id", "transfer_season"], as_index=False).last()
          .rename(columns={"competition_id": "big5_prior_league"})
          [["player_id", "transfer_season", "big5_prior_league"]]
    )
    aggregated = aggregated.merge(
        primary_league, on=["player_id", "transfer_season"], how="left"
    )

    aggregated["big5_goal_contributions"] = (
        aggregated["big5_goals"] + aggregated["big5_assists"]
    )

    aggregated["big5_goals_per_90"] = (
        (aggregated["big5_goals"] / aggregated["big5_minutes"].replace(0, pd.NA)) * 90
    ).round(2)

    aggregated["season_sort_key"] = aggregated["transfer_season"].str[:2].apply(
        lambda s: int("20" + s) if int(s) < 50 else int("19" + s)
    )

    return aggregated