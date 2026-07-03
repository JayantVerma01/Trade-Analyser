from fastapi import APIRouter, Depends, Query

from app.middleware.auth import verify_internal_request
from app.services.broker.mock_broker import _provider

router = APIRouter()


@router.get("/broker/account")
async def get_account(
    user_id: str = Query(...),
    _: None = Depends(verify_internal_request),
):
    return {
        "profile": _provider.get_profile(user_id),
        "margins": _provider.get_margins(user_id),
    }


@router.get("/broker/positions")
async def get_positions(
    user_id: str = Query(...),
    _: None = Depends(verify_internal_request),
):
    return {"positions": _provider.get_positions(user_id)}


@router.get("/broker/orders")
async def get_orders(
    user_id: str = Query(...),
    _: None = Depends(verify_internal_request),
):
    return {"orders": _provider.get_orders(user_id)}


@router.get("/broker/holdings")
async def get_holdings(
    user_id: str = Query(...),
    _: None = Depends(verify_internal_request),
):
    return {"holdings": _provider.get_holdings(user_id)}
