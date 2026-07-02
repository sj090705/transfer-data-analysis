"""Club- and player-entity endpoints (ledgers, net earners, origins, pickers)."""
from typing import Optional

from fastapi import APIRouter

from backend.serialization import records
from backend.analytics import (
    list_clubs,
    club_transfer_activity,
    club_season_transfers,
    top_clubs_by_value,
    top_net_earners,
    top_net_spenders,
    spend_by_position,
    list_countries,
    league_nationalities,
    country_leagues,
)

router = APIRouter(prefix="/api", tags=["clubs"])


@router.get("/clubs")
def clubs_ep():
    """Big-5 clubs for the club picker, biggest transfer movers first."""
    return records(list_clubs())


@router.get("/club-activity")
def club_activity_ep(club_id: int):
    """One club's per-season money spent / earned / net (fee-known deals)."""
    return records(club_transfer_activity(club_id))


@router.get("/club-transfers")
def club_transfers_ep(club_id: int, season: str):
    """Every transfer (in/out) for a club in a given season."""
    return records(club_season_transfers(club_id, season))


@router.get("/top-clubs")
def top_clubs_ep():
    """All Big-5 clubs w/ squad value + league, for the league->team picker."""
    return records(top_clubs_by_value())


@router.get("/net-earners")
def net_earners_ep(top_n: int = 10, season: Optional[str] = None):
    """Biggest net earners from the Big 5. ?season=23/24 restricts to one season."""
    if season and season != "all":
        key = int("20" + season[:2]) if int(season[:2]) < 50 else int("19" + season[:2])
        return records(top_net_earners(top_n=top_n, season_min=key, season_max=key))
    return records(top_net_earners(top_n=top_n))


@router.get("/net-spenders")
def net_spenders_ep(top_n: int = 10, season: Optional[str] = None):
    """Biggest net spenders (fees paid minus received). ?season=23/24 restricts to one season."""
    if season and season != "all":
        key = int("20" + season[:2]) if int(season[:2]) < 50 else int("19" + season[:2])
        return records(top_net_spenders(top_n=top_n, season_min=key, season_max=key))
    return records(top_net_spenders(top_n=top_n))


@router.get("/spend-by-position")
def spend_by_position_ep():
    """Total Big-5 spend split by position group (donut)."""
    return spend_by_position()


@router.get("/countries")
def countries_ep():
    """Countries with enough tracked players, for the country picker."""
    return records(list_countries())


@router.get("/league-nationalities")
def league_nationalities_ep(league: str):
    """Nationality breakdown (pie) of players in a league."""
    return league_nationalities(league)


@router.get("/country-leagues")
def country_leagues_ep(country: str):
    """League breakdown (pie) of players from a country."""
    return country_leagues(country)
