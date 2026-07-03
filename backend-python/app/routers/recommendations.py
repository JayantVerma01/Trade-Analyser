from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.middleware.auth import verify_internal_request
from app.services.recommendation_service import (
    get_recommendations,
    list_sectors,
    search_symbols,
)

router = APIRouter()


class RecommendationRequest(BaseModel):
    trading_style: str
    sector:        Optional[str]       = None
    symbols:       Optional[List[str]] = None
    capital:       float = Field(default=100_000, gt=0)
    risk_pct:      float = Field(default=1.0, gt=0, le=10)
    top_n:         int   = Field(default=5, ge=1, le=50)


@router.get("/recommendations/sectors")
async def sectors_endpoint(_: None = Depends(verify_internal_request)):
    return list_sectors()


@router.get("/recommendations/search")
async def search_endpoint(
    q:     str = Query(..., min_length=1, max_length=40),
    limit: int = Query(default=20, ge=1, le=50),
    _:     None = Depends(verify_internal_request),
):
    matches = search_symbols(q, limit=limit)
    return {"query": q, "matches": matches, "count": len(matches)}


@router.post("/recommendations/scan")
async def scan_endpoint(
    req: RecommendationRequest,
    _:   None = Depends(verify_internal_request),
):
    try:
        result = await get_recommendations(
            trading_style=req.trading_style,
            sector=req.sector,
            symbols=req.symbols,
            capital=req.capital,
            risk_pct=req.risk_pct,
            top_n=req.top_n,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
