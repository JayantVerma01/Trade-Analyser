"""
YFinanceMarketProvider — FREE real market data via Yahoo Finance.

Uses the `yfinance` library which scrapes Yahoo Finance publicly. Zero cost,
zero API keys. Coverage:

  • NSE stocks         → append ".NS"  (RELIANCE   → RELIANCE.NS)
  • BSE stocks         → append ".BO"  (RELIANCE   → RELIANCE.BO)
  • NSE indices        → special mapping (NIFTY50 → ^NSEI)
  • Global tickers     → pass-through

Data is delayed by ~15 minutes for most Indian stocks, which is fine for
analysis (indicators, MTF, backtest). For live tick trading you still need
a paid feed — but for setup detection & recommendation ranking, this is
perfect.

We wrap every call with:
  • In-memory TTL cache (avoid hammering Yahoo)
  • Retry with exponential backoff (Yahoo occasionally returns empty)
  • Timeout so a hung call doesn't stall the scanner
  • Fallback to MockMarketProvider when Yahoo is unreachable — the app stays
    functional even if the data feed dies briefly
"""

import logging
import time
from datetime import datetime, timezone
from threading import Lock
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd

from .base_provider import BaseMarketProvider, Candle, Quote, SymbolInfo
from .mock_provider import MockMarketProvider

logger = logging.getLogger(__name__)

# ─── Symbol mapping ──────────────────────────────────────────────────────────
# Yahoo Finance uses specific tickers for Indian indices.
_INDEX_MAP: Dict[str, str] = {
    "NIFTY50":     "^NSEI",
    "NIFTY":       "^NSEI",
    "BANKNIFTY":   "^NSEBANK",
    "FINNIFTY":    "NIFTY_FIN_SERVICE.NS",
    "MIDCAP50":    "^NSEMDCP50",
    "NIFTYNEXT50": "^NSMIDCP",
    "NIFTYIT":     "^CNXIT",
    "NIFTYPHARMA": "^CNXPHARMA",
    "NIFTYAUTO":   "^CNXAUTO",
    "NIFTYFMCG":   "^CNXFMCG",
    "NIFTYMETAL":  "^CNXMETAL",
    "SENSEX":      "^BSESN",
    "BANKEX":      "^BSEBANK",
}

# yfinance interval strings
_INTERVAL_MAP: Dict[str, str] = {
    "1m":  "1m",
    "2m":  "2m",
    "5m":  "5m",
    "15m": "15m",
    "30m": "30m",
    "1h":  "60m",
    "4h":  "60m",   # yfinance has no 4h — we resample from 1h
    "1d":  "1d",
    "1w":  "1wk",
    "1M":  "1mo",
}

# Yahoo restricts intraday history depth. Pick a safe period per interval.
_PERIOD_FOR_INTERVAL: Dict[str, str] = {
    "1m":  "5d",     # 1m data available for 7d max
    "2m":  "5d",
    "5m":  "60d",
    "15m": "60d",
    "30m": "60d",
    "1h":  "730d",   # ~2 years
    "4h":  "730d",
    "1d":  "5y",
    "1w":  "max",
    "1M":  "max",
}

# TTL per interval (seconds) — how stale a cached response is acceptable
_CACHE_TTL: Dict[str, int] = {
    "1m":  30,
    "2m":  60,
    "5m":  120,
    "15m": 300,
    "30m": 600,
    "1h":  900,
    "4h":  1800,
    "1d":  3600,     # 1 hour cache for daily
    "1w":  86400,
    "1M":  86400,
}


class YFinanceMarketProvider(BaseMarketProvider):
    """
    Free real market data via Yahoo Finance.
    Falls back to the mock provider on any hard failure so the app never
    returns a 500 to the user just because Yahoo blipped.
    """

    def __init__(self):
        # Import lazily so requirements.txt install failure doesn't crash
        # the whole service — user sees a clear error only when they use it.
        try:
            import yfinance as yf
            self._yf = yf
            self._available = True
            logger.info("YFinanceMarketProvider ready")
        except ImportError:
            logger.error("yfinance not installed — install with `pip install yfinance`")
            self._yf = None
            self._available = False

        self._fallback = MockMarketProvider()
        self._cache: Dict[str, Tuple[float, Any]] = {}
        self._lock = Lock()

    @property
    def provider_name(self) -> str:
        return "yfinance"

    # ─── Cache helpers ────────────────────────────────────────────────────

    def _cache_get(self, key: str, ttl: int) -> Optional[Any]:
        with self._lock:
            hit = self._cache.get(key)
            if hit and (time.time() - hit[0]) < ttl:
                return hit[1]
        return None

    def _cache_set(self, key: str, value: Any) -> None:
        with self._lock:
            self._cache[key] = (time.time(), value)
            # Simple eviction: cap at 500 entries
            if len(self._cache) > 500:
                oldest = min(self._cache.items(), key=lambda x: x[1][0])[0]
                del self._cache[oldest]

    # ─── Bulk pre-fetch ──────────────────────────────────────────────────
    # yfinance's Ticker(sym).history() = one HTTP request per symbol.
    # yfinance's yf.download(tickers=[...]) = ONE request for the whole batch.
    # For a 280-stock scan this drops wall time from ~5 minutes to ~10 seconds
    # AND avoids Yahoo's per-IP rate-limiter, which throttles hard past ~30
    # simultaneous requests.
    #
    # We warm the cache first; the subsequent single-symbol get_candles() calls
    # hit our in-memory cache instead of Yahoo.

    def warm_cache(self, symbols: List[str], timeframe: str = "1d") -> int:
        """
        Bulk-download candles for many symbols in a single Yahoo request.
        Returns count of symbols successfully cached.
        """
        if not self._available or not symbols:
            return 0

        ysyms   = [self._to_yahoo_symbol(s) for s in symbols]
        interval = _INTERVAL_MAP.get(timeframe, "15m")
        period   = _PERIOD_FOR_INTERVAL.get(timeframe, "60d")

        try:
            data = self._yf.download(
                tickers=ysyms,
                period=period,
                interval=interval,
                group_by="ticker",
                threads=True,
                progress=False,
                auto_adjust=True,
                prepost=False,
                timeout=60,      # single big call — allow more time
            )
        except Exception as exc:
            logger.warning(f"warm_cache bulk download failed: {exc}")
            return 0

        if data is None or data.empty:
            logger.warning("warm_cache: Yahoo returned empty for bulk request")
            return 0

        cached = 0
        for ysym in ysyms:
            try:
                # Single-ticker downloads return a flat DataFrame; multi-ticker
                # downloads return a MultiIndex with (ticker, field) columns.
                if len(ysyms) == 1:
                    per_ticker = data
                elif isinstance(data.columns, pd.MultiIndex):
                    if ysym not in data.columns.get_level_values(0):
                        continue
                    per_ticker = data[ysym]
                else:
                    continue

                per_ticker = per_ticker.dropna(how="all")
                if per_ticker.empty:
                    continue

                candles = self._df_to_candles(per_ticker)
                if not candles:
                    continue

                cache_key = f"c:{ysym}:{interval}:{period}"
                self._cache_set(cache_key, candles)
                cached += 1
            except Exception as exc:
                logger.debug(f"warm_cache: skip {ysym} — {exc}")

        logger.info(f"warm_cache: pre-loaded {cached}/{len(ysyms)} symbols in one request")
        return cached

    # ─── Symbol translation ──────────────────────────────────────────────

    @staticmethod
    def _to_yahoo_symbol(symbol: str) -> str:
        """
        NIFTY50   → ^NSEI
        RELIANCE  → RELIANCE.NS
        RELIANCE.BO → RELIANCE.BO   (pass-through if suffix already present)
        """
        s = symbol.upper().strip()
        if s in _INDEX_MAP:
            return _INDEX_MAP[s]
        if s.startswith("^") or "." in s:
            return s
        return f"{s}.NS"

    # ─── Candles ─────────────────────────────────────────────────────────

    def get_candles(
        self,
        symbol: str,
        timeframe: str = "15m",
        limit: int = 200,
        from_ts: Optional[int] = None,
        to_ts: Optional[int] = None,
    ) -> List[Candle]:
        if not self._available:
            logger.warning(f"yfinance unavailable, falling back to mock for {symbol}")
            return self._fallback.get_candles(symbol, timeframe, limit, from_ts, to_ts)

        ysym     = self._to_yahoo_symbol(symbol)
        interval = _INTERVAL_MAP.get(timeframe, "15m")
        period   = _PERIOD_FOR_INTERVAL.get(timeframe, "60d")

        cache_key = f"c:{ysym}:{interval}:{period}"
        cached = self._cache_get(cache_key, _CACHE_TTL.get(timeframe, 300))
        if cached is not None:
            return self._trim_and_resample(cached, timeframe, limit)

        candles = self._fetch_candles_with_retry(ysym, interval, period)

        if not candles:
            logger.warning(f"yfinance returned no data for {symbol} ({ysym}), falling back to mock")
            return self._fallback.get_candles(symbol, timeframe, limit, from_ts, to_ts)

        self._cache_set(cache_key, candles)
        return self._trim_and_resample(candles, timeframe, limit)

    def _fetch_candles_with_retry(
        self, ysym: str, interval: str, period: str, retries: int = 2,
    ) -> List[Candle]:
        """Fetch from Yahoo with retry. Returns [] on hard failure."""
        for attempt in range(retries + 1):
            try:
                df = self._yf.Ticker(ysym).history(
                    period=period,
                    interval=interval,
                    auto_adjust=True,
                    prepost=False,
                    timeout=25,       # bumped from 8s — cloud egress to Yahoo is slower
                )
                if df is None or df.empty:
                    if attempt < retries:
                        time.sleep(0.5 * (attempt + 1))
                        continue
                    return []
                return self._df_to_candles(df)
            except Exception as exc:
                logger.warning(f"yfinance fetch failed for {ysym} attempt {attempt + 1}: {exc}")
                if attempt < retries:
                    time.sleep(0.5 * (attempt + 1))
        return []

    @staticmethod
    def _df_to_candles(df: pd.DataFrame) -> List[Candle]:
        candles: List[Candle] = []
        for ts, row in df.iterrows():
            # Ticker.history() returns tz-aware indices; yf.download() returns
            # tz-naive for daily bars. Normalise both to UTC unix seconds.
            try:
                if getattr(ts, "tz", None) is not None:
                    utc_ts = int(ts.tz_convert("UTC").timestamp())
                elif hasattr(ts, "tz_localize"):
                    utc_ts = int(ts.tz_localize("UTC").timestamp())
                else:
                    utc_ts = int(ts.timestamp())
            except Exception:
                continue

            try:
                candles.append(Candle(
                    time=utc_ts,
                    open=float(row["Open"]),
                    high=float(row["High"]),
                    low=float(row["Low"]),
                    close=float(row["Close"]),
                    volume=float(row.get("Volume", 0) or 0),
                ))
            except (ValueError, TypeError, KeyError):
                continue  # skip malformed rows
        return candles

    def _trim_and_resample(self, candles: List[Candle], timeframe: str, limit: int) -> List[Candle]:
        """
        yfinance has no native 4h — build it from 1h candles by grouping 4 at a time.
        Also trim to `limit` most recent.
        """
        if timeframe == "4h" and candles:
            candles = self._resample_to_4h(candles)
        return candles[-limit:] if len(candles) > limit else candles

    @staticmethod
    def _resample_to_4h(hourly: List[Candle]) -> List[Candle]:
        out: List[Candle] = []
        chunk = []
        for c in hourly:
            chunk.append(c)
            if len(chunk) == 4:
                out.append(Candle(
                    time=chunk[0].time,
                    open=chunk[0].open,
                    high=max(x.high for x in chunk),
                    low=min(x.low for x in chunk),
                    close=chunk[-1].close,
                    volume=sum(x.volume for x in chunk),
                ))
                chunk = []
        return out

    # ─── Quote ───────────────────────────────────────────────────────────

    def get_quote(self, symbol: str) -> Quote:
        # Derive from most recent 1-day candles — cheap and reliable.
        candles = self.get_candles(symbol, "1d", limit=2)
        if len(candles) < 2:
            # Fall back to synthetic if we somehow got no data at all
            return self._fallback.get_quote(symbol)

        prev, last = candles[-2], candles[-1]
        change     = last.close - prev.close
        change_pct = (change / prev.close * 100.0) if prev.close else 0.0

        return Quote(
            symbol=symbol.upper(),
            ltp=last.close,
            open=last.open,
            high=last.high,
            low=last.low,
            close=prev.close,           # previous close, per convention
            volume=last.volume,
            change=round(change, 2),
            change_pct=round(change_pct, 2),
        )

    # ─── Symbol search ───────────────────────────────────────────────────

    def search_symbols(self, query: str) -> List[SymbolInfo]:
        """
        Yahoo has no free symbol-search API. Delegate to our curated universe
        in stock_universe.SECTORS — this returns the tracked NSE+BSE list.
        """
        from app.services.stock_universe import all_symbols

        q = (query or "").upper().strip()
        matches = [s for s in all_symbols() if q in s] if q else all_symbols()[:20]

        results: List[SymbolInfo] = []
        for sym in matches[:25]:
            is_index = sym.upper() in _INDEX_MAP
            results.append(SymbolInfo(
                symbol=sym,
                name=sym,
                exchange="NSE",
                segment="INDEX" if is_index else "EQ",
                lot_size=1,
                tick_size=0.05,
            ))
        return results
