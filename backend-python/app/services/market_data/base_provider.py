"""
Abstract market data provider interface.
All broker integrations (Zerodha, Upstox, Dhan, Angel, FYERS) will implement this.
Phase 1/2 uses MockMarketProvider. Phase 7+ plugs in real brokers.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional


@dataclass
class Candle:
    time: int        # Unix timestamp (seconds)
    open: float
    high: float
    low: float
    close: float
    volume: float


@dataclass
class Quote:
    symbol: str
    ltp: float       # Last traded price
    open: float
    high: float
    low: float
    close: float
    volume: float
    change: float    # absolute change
    change_pct: float


@dataclass
class SymbolInfo:
    symbol: str
    name: str
    exchange: str
    segment: str     # EQ, FO, INDEX
    lot_size: int
    tick_size: float


class BaseMarketProvider(ABC):
    """
    Interface every market data provider must implement.
    Switch providers by changing the active_provider in market_data_service.
    """

    @abstractmethod
    def get_candles(
        self,
        symbol: str,
        timeframe: str,
        limit: int = 200,
        from_ts: Optional[int] = None,
        to_ts: Optional[int] = None,
    ) -> List[Candle]:
        """Return OHLCV candles newest-last."""
        ...

    @abstractmethod
    def get_quote(self, symbol: str) -> Quote:
        """Return current market quote."""
        ...

    @abstractmethod
    def search_symbols(self, query: str) -> List[SymbolInfo]:
        """Search symbols by name or ticker."""
        ...

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Identifier string, e.g. 'mock', 'zerodha', 'upstox'."""
        ...
