"""
Backtest router — runs historical strategy simulations.
"""

import asyncio
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from app.middleware.auth import verify_internal_request
from app.services.backtest_engine import run_backtest

router = APIRouter(prefix="/backtest", tags=["Backtesting"])


class StrategyRuleIn(BaseModel):
    id:         str
    label:      str
    indicator:  str
    operator:   str
    value:      Optional[float] = None
    compare_to: Optional[str]  = None
    value_min:  Optional[float] = None
    value_max:  Optional[float] = None


class StrategyConditionsIn(BaseModel):
    rules:  List[StrategyRuleIn]
    logic:  str = "AND"
    min_rr: Optional[float] = None


class BacktestRequest(BaseModel):
    symbol:    str
    timeframe: str = "15m"
    capital:   float = Field(default=100_000, gt=0)
    risk_pct:  float = Field(default=1.0, gt=0, le=10)
    n_candles: int   = Field(default=500, ge=100, le=1000)
    conditions: StrategyConditionsIn


@router.post("/run", dependencies=[Depends(verify_internal_request)])
async def run_backtest_endpoint(req: BacktestRequest) -> Dict[str, Any]:
    """
    Run a walk-forward backtest of a strategy on synthetic OHLCV data.
    Runs in a thread executor to avoid blocking the async event loop.
    """
    conditions_dict = {
        "rules":  [r.model_dump() for r in req.conditions.rules],
        "logic":  req.conditions.logic,
        "min_rr": req.conditions.min_rr,
    }

    try:
        result = await asyncio.to_thread(
            run_backtest,
            req.symbol,
            req.timeframe,
            conditions_dict,
            req.capital,
            req.risk_pct,
            req.n_candles,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backtest failed: {str(e)}")
