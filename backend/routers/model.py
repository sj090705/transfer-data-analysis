"""ML endpoints — value predictor (shipped) and fee predictor (counter-example)."""
from typing import Optional

from fastapi import APIRouter

from backend.model import (
    predict_value, train_value, value_importance, value_agreement,
    predict_fee, train, feature_importance,
)

router = APIRouter(prefix="/api", tags=["model"])


@router.get("/predict-value")
def predict_value_ep(
    squad_value: float,
    age: float,
    position: str,
    league: str,
    goals: Optional[float] = None,
    minutes: Optional[float] = None,
    cross_league: Optional[bool] = None,
):
    """Predicted market value (€m). squad_value comes from the team picker."""
    return {"predicted_value": predict_value(squad_value, age, position, league, goals, minutes, cross_league)}


@router.get("/value-insights")
def value_insights_ep():
    """Value model metrics vs median baseline + importance + predicted-vs-actual agreement.
    First call trains & caches the models (a few seconds)."""
    v = train_value()
    keep = ["mae", "r2", "baseline_mae", "n_train", "n_test"]
    return {"metrics": {k: v[k] for k in keep}, "importance": value_importance(10), "agreement": value_agreement()}


@router.get("/predict-fee")
def predict_fee_ep(market_value: float, age: float, position: str, league: str, cross_league: bool = False):
    """Predicted fee (€m) from the lean fee model (kept as a counter-example)."""
    return {"predicted_fee": predict_fee(market_value, age, position, league, cross_league)}


@router.get("/model-insights")
def model_insights_ep():
    """Fee model vs naive baseline (fee = market value) + feature importance."""
    keep = ["mae", "r2", "baseline_mae", "baseline_r2", "n_train", "n_test"]
    full, lean = train("full"), train("lean")
    return {
        "full": {k: full[k] for k in keep},
        "lean": {k: lean[k] for k in keep},
        "importance": feature_importance("full", 10),
    }
