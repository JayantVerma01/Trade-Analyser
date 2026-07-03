"""
MockMarketProvider — deterministic synthetic OHLCV data for Indian stocks.

Generates realistic-looking price action using geometric Brownian motion
with mean reversion and intraday patterns. The seed is derived from
symbol+timeframe so the same request always returns the same base data,
with only the most-recent candles shifting as time progresses.
"""

import math
import time
from datetime import datetime, timezone
from typing import List, Optional

import numpy as np

from .base_provider import BaseMarketProvider, Candle, Quote, SymbolInfo

# ─── Stock universe ────────────────────────────────────────────────────────────

SYMBOLS: dict = {
    # Large-cap equities
    "RELIANCE":   {"name": "Reliance Industries",    "base": 2920,  "vol": 0.012, "avg_vol": 8_000_000,  "exchange": "NSE", "lot": 1},
    "TCS":        {"name": "Tata Consultancy Svcs",  "base": 4050,  "vol": 0.010, "avg_vol": 3_000_000,  "exchange": "NSE", "lot": 1},
    "INFY":       {"name": "Infosys",                "base": 1820,  "vol": 0.012, "avg_vol": 5_000_000,  "exchange": "NSE", "lot": 1},
    "HDFCBANK":   {"name": "HDFC Bank",              "base": 1620,  "vol": 0.011, "avg_vol": 10_000_000, "exchange": "NSE", "lot": 1},
    "ICICIBANK":  {"name": "ICICI Bank",             "base": 1200,  "vol": 0.013, "avg_vol": 12_000_000, "exchange": "NSE", "lot": 1},
    "SBIN":       {"name": "State Bank of India",    "base": 820,   "vol": 0.015, "avg_vol": 20_000_000, "exchange": "NSE", "lot": 1},
    "AXISBANK":   {"name": "Axis Bank",              "base": 1150,  "vol": 0.013, "avg_vol": 9_000_000,  "exchange": "NSE", "lot": 1},
    "WIPRO":      {"name": "Wipro",                  "base": 510,   "vol": 0.012, "avg_vol": 6_000_000,  "exchange": "NSE", "lot": 1},
    "BAJFINANCE": {"name": "Bajaj Finance",          "base": 7550,  "vol": 0.016, "avg_vol": 2_500_000,  "exchange": "NSE", "lot": 1},
    "TATASTEEL":  {"name": "Tata Steel",             "base": 178,   "vol": 0.018, "avg_vol": 25_000_000, "exchange": "NSE", "lot": 1},
    "HCLTECH":    {"name": "HCL Technologies",       "base": 1720,  "vol": 0.011, "avg_vol": 4_000_000,  "exchange": "NSE", "lot": 1},
    "MARUTI":     {"name": "Maruti Suzuki",          "base": 12200, "vol": 0.012, "avg_vol": 700_000,    "exchange": "NSE", "lot": 1},
    "ADANIENT":   {"name": "Adani Enterprises",      "base": 3050,  "vol": 0.020, "avg_vol": 8_000_000,  "exchange": "NSE", "lot": 1},
    "LT":         {"name": "Larsen & Toubro",        "base": 3700,  "vol": 0.011, "avg_vol": 3_500_000,  "exchange": "NSE", "lot": 1},
    "KOTAKBANK":  {"name": "Kotak Mahindra Bank",    "base": 1750,  "vol": 0.012, "avg_vol": 5_000_000,  "exchange": "NSE", "lot": 1},
    # Indices (no volume)
    "NIFTY50":    {"name": "Nifty 50 Index",         "base": 24200, "vol": 0.008, "avg_vol": 0,          "exchange": "NSE", "lot": 50},
    "BANKNIFTY":  {"name": "Bank Nifty Index",       "base": 52500, "vol": 0.010, "avg_vol": 0,          "exchange": "NSE", "lot": 15},
    "FINNIFTY":   {"name": "Fin Nifty Index",        "base": 23800, "vol": 0.009, "avg_vol": 0,          "exchange": "NSE", "lot": 40},
}

# Timeframe → duration in seconds
TF_SECONDS: dict = {
    "1m":  60,
    "3m":  180,
    "5m":  300,
    "15m": 900,
    "30m": 1800,
    "1h":  3600,
    "4h":  14400,
    "1d":  86400,
}


class MockMarketProvider(BaseMarketProvider):
    """
    Generates deterministic synthetic OHLCV data.
    Same symbol+timeframe always produces the same candle history.
    """

    @property
    def provider_name(self) -> str:
        return "mock"

    def get_candles(
        self,
        symbol: str,
        timeframe: str = "15m",
        limit: int = 200,
        from_ts: Optional[int] = None,
        to_ts: Optional[int] = None,
    ) -> List[Candle]:
        sym = symbol.upper()
        cfg = SYMBOLS.get(sym)
        if cfg is None:
            # Unknown symbol — generate with sensible defaults
            cfg = {"base": 1000, "vol": 0.013, "avg_vol": 5_000_000, "exchange": "NSE", "lot": 1}

        tf_secs = TF_SECONDS.get(timeframe, 900)

        # Deterministic seed: symbol chars + timeframe chars
        seed = sum(ord(c) for c in sym + timeframe) % (2 ** 31)
        rng = np.random.default_rng(seed)

        base_price = cfg["base"]
        daily_vol = cfg["vol"]
        # Scale volatility to the candle timeframe
        candle_vol = daily_vol * math.sqrt(tf_secs / 86400)
        avg_volume = cfg["avg_vol"]

        # Generate slightly more than needed for burn-in
        n = limit + 50

        # GBM returns
        drift = 0.0001  # tiny upward drift
        returns = rng.normal(drift * (tf_secs / 86400), candle_vol, size=n)

        # Apply mean reversion to avoid runaway prices
        prices = [base_price]
        for r in returns:
            mean_rev = -0.02 * (prices[-1] / base_price - 1)
            prices.append(prices[-1] * (1 + r + mean_rev))

        # Build OHLCV candles
        now_ts = to_ts or int(time.time())
        # Align to candle boundary
        now_ts = (now_ts // tf_secs) * tf_secs

        candles: List[Candle] = []
        for i in range(n):
            close = prices[i + 1]
            open_ = prices[i]
            # Intrabar random wicks
            wick_factor = abs(rng.normal(0, candle_vol * 0.5))
            high = max(open_, close) * (1 + wick_factor)
            low  = min(open_, close) * (1 - wick_factor)
            # Volume with some noise
            vol_noise = rng.lognormal(0, 0.4)
            volume = avg_volume * vol_noise * (tf_secs / 86400) if avg_volume > 0 else 0

            ts = now_ts - (n - i) * tf_secs
            candles.append(Candle(
                time=ts,
                open=round(open_, 2),
                high=round(high, 2),
                low=round(low, 2),
                close=round(close, 2),
                volume=round(volume),
            ))

        # Return last `limit` candles
        return candles[-limit:]

    def get_quote(self, symbol: str) -> Quote:
        candles = self.get_candles(symbol, "1m", limit=2)
        prev = candles[-2]
        last = candles[-1]
        change = last.close - prev.close
        change_pct = (change / prev.close) * 100
        return Quote(
            symbol=symbol.upper(),
            ltp=last.close,
            open=last.open,
            high=last.high,
            low=last.low,
            close=last.close,
            volume=last.volume,
            change=round(change, 2),
            change_pct=round(change_pct, 3),
        )

    def search_symbols(self, query: str) -> List[SymbolInfo]:
        q = query.upper()
        results = []
        for sym, cfg in SYMBOLS.items():
            if q in sym or q in cfg["name"].upper():
                results.append(SymbolInfo(
                    symbol=sym,
                    name=cfg["name"],
                    exchange=cfg["exchange"],
                    segment="INDEX" if sym in ("NIFTY50", "BANKNIFTY", "FINNIFTY") else "EQ",
                    lot_size=cfg["lot"],
                    tick_size=0.05,
                ))
        return results[:10]
