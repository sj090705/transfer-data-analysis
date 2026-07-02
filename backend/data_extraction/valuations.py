import pandas as pd
from pathlib import Path

BASE = Path(__file__).parent.parent.parent / "archive"


def load_squad_values_by_season() -> pd.DataFrame:
    """
    Calculates total squad value per club per season.
    Aggregates player market values from player_valuations.csv.
    """
    df = pd.read_csv(BASE / "player_valuations.csv")

    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.dropna(subset=["date", "market_value_in_eur", "current_club_id"])

    df["season_start_year"] = df["date"].apply(
        lambda d: d.year if d.month >= 7 else d.year - 1
    )
    df["transfer_season"] = df["season_start_year"].apply(
        lambda y: f"{str(y)[2:]}/{str(y + 1)[2:]}"
    )

    df = df.sort_values("date")
    latest_per_player_per_season = df.groupby(
        ["current_club_id", "transfer_season", "player_id"],
        as_index=False
    ).last()

    squad_values = latest_per_player_per_season.groupby(
        ["current_club_id", "transfer_season"],
        as_index=False
    ).agg(
        club_name=("current_club_name",                    "last"),
        league_id=("player_club_domestic_competition_id",  "last"),
        squad_value_in_millions=("market_value_in_eur",    "sum"),
        player_count=("player_id",                         "count"),
    )

    squad_values["squad_value_in_millions"] = (
        squad_values["squad_value_in_millions"] / 1_000_000
    ).round(2)

    squad_values["season_sort_key"] = squad_values["transfer_season"].str[:2].apply(
        lambda s: int("20" + s) if int(s) < 50 else int("19" + s)
    )

    return squad_values.rename(columns={"current_club_id": "club_id"})