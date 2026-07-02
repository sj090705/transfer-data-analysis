import pandas as pd
from pathlib import Path

BASE = Path(__file__).parent.parent.parent / "archive"

def load_transfers() -> pd.DataFrame:

    df = pd.read_csv(BASE / "transfers.csv")

    # Parse transfer date for date arithmetic (e.g. age at transfer)
    df["transfer_date"] = pd.to_datetime(df["transfer_date"], errors="coerce")

    # Scale fees and mkt value to millions, rounded to 2 decimal places
    df["fee_in_millions"]          = (df["transfer_fee"]        / 1_000_000).round(2)
    df["market_value_in_millions"] = (df["market_value_in_eur"] / 1_000_000).round(2)

    # Free transfer = fee is exactly 0
    df["is_free_transfer"] = df["transfer_fee"] == 0

    # Undisclosed = fee is missing/NaN (real transfer but fee not recorded)
    df["is_undisclosed_fee"] = df["transfer_fee"].isna()

    # Paid transfer = has an actual recorded fee > 0
    df["is_paid_transfer"] = (df["transfer_fee"] > 0) & (df["transfer_fee"].notna())

    # Flag non-transfers (retirements, free agent registrations
    non_transfer_destinations = ["Without Club", "Retired", "without Club"]
    df["is_real_transfer"] = ~df["to_club_name"].isin(non_transfer_destinations)

    # Season sort key — integer used for ordering/filtering, never displayed
    df["season_sort_key"] = df["transfer_season"].str[:2].apply(
        lambda s: int("20" + s) if int(s) < 50 else int("19" + s)
    )

    return df



