from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from app.services.analysis_service import run_analysis
from app.middleware.auth import verify_internal_request

router = APIRouter()


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
    rules:   List[StrategyRuleIn] = []
    logic:   str = "AND"
    min_rr:  Optional[float] = None


class AnalysisRequest(BaseModel):
    symbol:               str
    timeframe:            str = "15m"
    capital:              float = Field(default=100000, gt=0)
    risk_pct:             float = Field(default=1.0, gt=0, le=10)
    market_type:          str = "intraday"
    notes:                str = ""
    strategy_conditions:  Optional[StrategyConditionsIn] = None
    strategy_name:        str = ""


@router.post("/analysis/stock")
async def analyse_stock(
    request: AnalysisRequest,
    _: None = Depends(verify_internal_request),
):
    """
    Full stock analysis pipeline:
    candles → indicators → market bias → setup detection
    → entry/SL/target → position sizing → confidence score
    Optionally evaluates a user-defined strategy rule set on top.
    """
    try:
        conditions_dict = None
        if request.strategy_conditions and request.strategy_conditions.rules:
            conditions_dict = {
                "rules":  [r.model_dump() for r in request.strategy_conditions.rules],
                "logic":  request.strategy_conditions.logic,
                "min_rr": request.strategy_conditions.min_rr,
            }

        result = run_analysis(
            symbol=request.symbol,
            timeframe=request.timeframe,
            capital=request.capital,
            risk_pct=request.risk_pct,
            market_type=request.market_type,
            notes=request.notes,
            strategy_conditions=conditions_dict,
            strategy_name=request.strategy_name,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
