"""
Market data provider selection.

Switch providers via the MARKET_PROVIDER env var:
    MARKET_PROVIDER=yfinance     ← real free data (default when live)
    MARKET_PROVIDER=mock         ← deterministic synthetic (default in tests)

Every downstream service imports `get_market_provider()` — no hard
coupling to a specific provider class. Change the env var, restart, done.
"""

import logging
import os
from functools import lru_cache

from .base_provider import BaseMarketProvider, Candle, Quote, SymbolInfo
from .mock_provider import MockMarketProvider

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_market_provider() -> BaseMarketProvider:
    name = (os.getenv("MARKET_PROVIDER") or "mock").strip().lower()

    if name == "yfinance":
        try:
            from .yfinance_provider import YFinanceMarketProvider
            logger.info("Market provider: YFinanceMarketProvider (real data)")
            return YFinanceMarketProvider()
        except ImportError as exc:
            logger.error(f"MARKET_PROVIDER=yfinance requested but import failed ({exc}); using mock")
            return MockMarketProvider()

    logger.info("Market provider: MockMarketProvider (synthetic)")
    return MockMarketProvider()


__all__ = [
    "BaseMarketProvider",
    "Candle",
    "Quote",
    "SymbolInfo",
    "MockMarketProvider",
    "get_market_provider",
]
