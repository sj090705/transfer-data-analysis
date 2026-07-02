import pandas as pd
from pathlib import Path

BASE = Path(__file__).parent.parent.parent / "archive"


def load_players() -> pd.DataFrame:
    """
    Loads player profile data from Transfermarkt.

    Contains demographic and career-level attributes.
    Joined in data.py on player_id to enrich each transfer row.
    """
    df = pd.read_csv(BASE / "players.csv", usecols=[
        "player_id",
        "date_of_birth",
        "position",
        "sub_position",
        "foot",
        "height_in_cm",
        "country_of_citizenship",
        "international_caps",
        "highest_market_value_in_eur",
    ])

    df["date_of_birth"] = pd.to_datetime(df["date_of_birth"], errors="coerce")

    # Scale peak value to millions
    df["peak_value_in_millions"] = (
        df["highest_market_value_in_eur"] / 1_000_000
    ).round(2)

    return df.drop(columns=["highest_market_value_in_eur"])