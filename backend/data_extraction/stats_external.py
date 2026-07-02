import pandas as pd
from pathlib import Path

BASE = Path(__file__).parent.parent.parent / "archive"

BIG5 = ["GB1", "ES1", "FR1", "IT1", "L1"]


def load_external_stats() -> pd.DataFrame:
    """
    Loads and aggregates player appearances from NON Big 5 leagues.

    Tells you how a player performed before arriving in the Big 5.
    Most relevant for inbound transfers (foreign player joining Big 5).

    Output: one row per player per season.
    """
    df = pd.read_csv(BASE / "appearances.csv", usecols=[
        "player_id",
        "competition_id",
        "date",
        "goals",
        "assists",
        "minutes_played",
        "yellow_cards",
        "red_cards",
    ])

    df = df[~df["competition_id"].isin(BIG5)]

    df["date"] = pd.to_datetime(df["date"], errors="coerce")

    df["season_start_year"] = df["date"].apply(
        lambda d: d.year if d.month >= 7 else d.year - 1
    )
    df["transfer_season"] = df["season_start_year"].apply(
        lambda y: f"{str(y)[2:]}/{str(y + 1)[2:]}"
    )

    aggregated = df.groupby(["player_id", "transfer_season"], as_index=False).agg(
        ext_games=        ("goals",          "count"),
        ext_goals=        ("goals",          "sum"),
        ext_assists=      ("assists",         "sum"),
        ext_minutes=      ("minutes_played",  "sum"),
        ext_yellow_cards= ("yellow_cards",    "sum"),
        ext_red_cards=    ("red_cards",       "sum"),
    )

    aggregated["ext_goal_contributions"] = (
        aggregated["ext_goals"] + aggregated["ext_assists"]
    )

    aggregated["ext_goals_per_90"] = (
        (aggregated["ext_goals"] / aggregated["ext_minutes"].replace(0, pd.NA)) * 90
    ).round(2)

    aggregated["season_sort_key"] = aggregated["transfer_season"].str[:2].apply(
        lambda s: int("20" + s) if int(s) < 50 else int("19" + s)
    )

    return aggregated