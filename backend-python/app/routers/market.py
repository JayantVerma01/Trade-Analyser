from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional

from app.services.market_data import get_market_provider
from app.middleware.auth import verify_internal_request
from fastapi import Depends

router = APIRouter()
_provider = get_market_provider()


@router.get("/market/candles")
async def get_candles(
    symbol: str = Query(..., description="Stock symbol e.g. RELIANCE"),
    timeframe: str = Query("15m", description="1m|3m|5m|15m|30m|1h|4h|1d"),
    limit: int = Query(200, ge=10, le=500),
    _: None = Depends(verify_internal_request),
):
    try:
        candles = _provider.get_candles(symbol.upper(), timeframe, limit=limit)
        return {
            "symbol": symbol.upper(),
            "timeframe": timeframe,
            "count": len(candles),
            "candles": [
                {"time": c.time, "open": c.open, "high": c.high,
                 "low": c.low, "close": c.close, "volume": c.volume}
                for c in candles
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/market/quote")
async def get_quote(
    symbol: str = Query(...),
    _: None = Depends(verify_internal_request),
):
    try:
        q = _provider.get_quote(symbol.upper())
        return {
            "symbol": q.symbol, "ltp": q.ltp, "open": q.open,
            "high": q.high, "low": q.low, "close": q.close,
            "volume": q.volume, "change": q.change, "change_pct": q.change_pct,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/market/symbols")
async def search_symbols(
    q: str = Query("", description="Search query"),
    _: None = Depends(verify_internal_request),
):
    results = _provider.search_symbols(q)
    return {
        "results": [
            {"symbol": s.symbol, "name": s.name, "exchange": s.exchange,
             "segment": s.segment, "lot_size": s.lot_size}
            for s in results
        ]
    }
