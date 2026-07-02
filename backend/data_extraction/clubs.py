import pandas as pd
from pathlib import Path

BASE = Path(__file__).parent.parent.parent / "archive"


def load_clubs() -> pd.DataFrame:
    """
    Lookup table: club_id + season → club_name + league.

    clubs.csv only stores each club's last known league — inaccurate
    for relegated/promoted clubs in historical seasons.

    We fix this by deriving the league from player_valuations.csv
    which records which league each club was in per date.

    Result: one row per club per season with accurate league data.
    """

    # ── club names from clubs.csv ─────────────────────────────────────
    club_names = pd.read_csv(BASE / "clubs.csv", usecols=["club_id", "name"])
    club_names = club_names.rename(columns={"name": "club_name"})

    # ── accurate league per club per season from player_valuations ────
    valuations = pd.read_csv(BASE / "player_valuations.csv", usecols=[
        "current_club_id",
        "player_club_domestic_competition_id",
        "date",
    ])

    valuations = valuations.dropna(subset=[
        "current_club_id",
        "player_club_domestic_competition_id"
    ])

    valuations["date"] = pd.to_datetime(valuations["date"], errors="coerce")

    # Football season: July start
    # 2023-09-01 → season_start=2023 → "23/24"
    # 2024-03-01 → season_start=2023 → "23/24"
    valuations["season_start_year"] = valuations["date"].apply(
        lambda d: d.year if d.month >= 7 else d.year - 1
    )
    valuations["transfer_season"] = valuations["season_start_year"].apply(
        lambda y: f"{str(y)[2:]}/{str(y + 1)[2:]}"
    )

    # For each club + season, take the most common recorded league
    club_season_league = (
        valuations
        .groupby(["current_club_id", "transfer_season"])["player_club_domestic_competition_id"]
        .agg(lambda x: x.value_counts().index[0])
        .reset_index()
        .rename(columns={
            "current_club_id":                    "club_id",
            "player_club_domestic_competition_id": "league_id",
        })
    )

    # ── join names onto the season-league table ───────────────────────
    df = club_season_league.merge(club_names, on="club_id", how="left")

    # Season sort key for ordering
    df["season_sort_key"] = df["transfer_season"].str[:2].apply(
        lambda s: int("20" + s) if int(s) < 50 else int("19" + s)
    )

    return df[["club_id", "club_name", "transfer_season", "season_sort_key", "league_id"]]