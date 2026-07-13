"""
Strategy evaluation endpoints.
These are called by Node.js; not exposed publicly.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.middleware.auth import verify_internal_request
from app.services.strategy_engine import evaluate_strategy, VALID_INDICATORS, VALID_OPERATORS
from app.services.indicator_service import calculate_indicators, candles_to_df
from app.services.market_data import get_market_provider

router = APIRouter(prefix="/strategy", tags=["strategy"])

_provider = get_market_provider()


# ─── Schemas ──────────────────────────────────────────────────────────────────

class StrategyRule(BaseModel):
    id:         str
    label:      str
    indicator:  str
    operator:   str
    value:      Optional[float] = None
    compare_to: Optional[str]  = None
    value_min:  Optional[float] = None
    value_max:  Optional[float] = None


class StrategyConditions(BaseModel):
    rules:   List[StrategyRule]
    logic:   str = "AND"
    min_rr:  Optional[float] = None


class EvaluateRequest(BaseModel):
    symbol:     str
    timeframe:  str = "15m"
    conditions: StrategyConditions


class ScanRequest(BaseModel):
    symbols:    List[str] = Field(min_length=1, max_length=20)
    timeframe:  str = "15m"
    conditions: StrategyConditions


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _fetch_indicators(symbol: str, timeframe: str) -> Dict[str, Any]:
    candles = _provider.get_candles(symbol.upper(), timeframe, limit=250)
    if len(candles) < 50:
        raise HTTPException(status_code=422, detail=f"Not enough candle data for {symbol}/{timeframe}")
    df  = candles_to_df(candles)
    return calculate_indicators(df)


def _conditions_dict(conditions: StrategyConditions) -> Dict[str, Any]:
    return {
        "rules":  [r.model_dump() for r in conditions.rules],
        "logic":  conditions.logic,
        "min_rr": conditions.min_rr,
    }


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.post("/evaluate", dependencies=[Depends(verify_internal_request)])
def evaluate_endpoint(req: EvaluateRequest) -> Dict[str, Any]:
    """Evaluate a strategy against a single symbol's current indicators."""
    ind = _fetch_indicators(req.symbol, req.timeframe)
    result = evaluate_strategy(_conditions_dict(req.conditions), ind)
    return {
        "symbol":    req.symbol.upper(),
        "timeframe": req.timeframe,
        "indicators": {k: v for k, v in ind.items() if not isinstance(v, list)},
        **result,
    }


@router.post("/scan", dependencies=[Depends(verify_internal_request)])
def scan_endpoint(req: ScanRequest) -> Dict[str, Any]:
    """Scan multiple symbols against a strategy. Returns ranked matches."""
    cond_dict = _conditions_dict(req.conditions)
    results = []

    for sym in req.symbols:
        try:
            ind = _fetch_indicators(sym, req.timeframe)
            res = evaluate_strategy(cond_dict, ind)
            results.append({
                "symbol":  sym.upper(),
                "price":   ind.get("price", 0),
                **res,
            })
        except HTTPException:
            results.append({
                "symbol":  sym.upper(),
                "price":   0,
                "matches": False,
                "score":   0.0,
                "rules_matched": [],
                "rules_failed":  [f"No data for {sym}"],
                "confidence_bonus": 0,
                "logic": req.conditions.logic,
            })

    # Sort: matches first, then by score descending
    results.sort(key=lambda r: (not r["matches"], -r["score"]))

    matches = [r for r in results if r["matches"]]
    return {
        "timeframe":   req.timeframe,
        "total":       len(results),
        "matched":     len(matches),
        "results":     results,
    }


@router.get("/meta", dependencies=[Depends(verify_internal_request)])
def strategy_meta() -> Dict[str, Any]:
    """Return available indicators and operators for the rule builder UI."""
    return {
        "indicators": sorted(VALID_INDICATORS),
        "operators":  sorted(VALID_OPERATORS),
    }
