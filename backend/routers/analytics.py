"""Market-level trend endpoints (fee inflation, caliber, top deals, recruitment)."""
from typing import Optional

from fastapi import APIRouter

from backend.serialization import records
from backend.data import SEASON_MAX
from backend.analytics import (
    summary_stats,
    inflation_trends,
    big_money_caliber,
    recruitment_trends,
    top_transfers,
    best_free_transfers,
)

router = APIRouter(prefix="/api", tags=["analytics"])


@router.get("/summary")
def summary_ep():
    """Headline KPIs for the dashboard stat cards."""
    return summary_stats()


@router.get("/inflation")
def inflation_ep(league: Optional[str] = None):
    """Per-season median/mean fee vs market value — the fee-inflation chart."""
    return records(inflation_trends(league=league))


@router.get("/caliber")
def caliber_ep(position: Optional[str] = None, league: Optional[str] = None, top_n: int = 25):
    """Fee/value/age/output indexed per season. No position = all top-N deals
    (used by the era-comparison cards)."""
    return records(big_money_caliber(league=league, position=position, top_n=top_n))


@router.get("/attacker-caliber")
def attacker_caliber_ep(league: Optional[str] = None, top_n: int = 15):
    """Attacker deep-dive: top-N attacking signings/season, fee vs value vs G+A/90."""
    return records(big_money_caliber(league=league, position="Attack", top_n=top_n))


@router.get("/recruitment-trends")
def recruitment_trends_ep(season_min: int = 2009, season_max: int = SEASON_MAX):
    """Per-league, per-season recruitment mix (domestic / other Big-5 / outside)."""
    return records(recruitment_trends(season_min=season_min, season_max=season_max))


@router.get("/top-transfers")
def top_transfers_ep(league: Optional[str] = None, top_n: int = 7):
    """Top-N most expensive paid buys per season (optionally by buying league)."""
    return records(top_transfers(league=league, top_n=top_n))


@router.get("/best-free-transfers")
def best_free_transfers_ep(league: Optional[str] = None, top_n: int = 7):
    """Most valuable free (zero-fee) signings per season, best-effort loan-filtered."""
    return records(best_free_transfers(league=league, top_n=top_n))
