"""
AI Agent router — LangGraph ReAct trade analysis agent.
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from app.middleware.auth import verify_internal_request
from app.services.agent.graph import run_agent_query

router = APIRouter(prefix="/agent", tags=["AI Agent"])


class AgentQueryRequest(BaseModel):
    user_id:       str
    query:         str = Field(default="Provide a comprehensive trade analysis and setup.")
    symbol:        str
    timeframe:     str = "15m"
    capital:       float = Field(default=100_000, gt=0)
    risk_pct:      float = Field(default=1.0, gt=0, le=10)
    market_type:   str = "intraday"
    strategy_name: Optional[str] = None


@router.post("/trade-query", dependencies=[Depends(verify_internal_request)])
async def agent_trade_query(req: AgentQueryRequest):
    """
    Run the LangGraph ReAct agent to analyse a stock and answer the user's query.
    The agent calls internal tools (analyse_stock, search_theory, get_price)
    and returns a structured recommendation with full analysis data.
    """
    try:
        result = await run_agent_query(
            user_id=      req.user_id,
            query=        req.query,
            symbol=       req.symbol,
            timeframe=    req.timeframe,
            capital=      req.capital,
            risk_pct=     req.risk_pct,
            market_type=  req.market_type,
            strategy_name=req.strategy_name,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent failed: {str(e)}")
