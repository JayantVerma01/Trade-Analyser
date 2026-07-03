"""
Indicator engine — wraps pandas-ta to compute all technical indicators
used by the analysis and strategy rule engines.
"""

from typing import Any, Dict, List, Tuple
import numpy as np
import pandas as pd
import pandas_ta_classic as ta

from app.services.market_data.base_provider import Candle


# ─── Helpers ──────────────────────────────────────────────────────────────────

def candles_to_df(candles: List[Candle]) -> pd.DataFrame:
    """Convert Candle list to a pandas DataFrame with lowercase column names."""
    df = pd.DataFrame([{
        "time":   c.time,
        "open":   c.open,
        "high":   c.high,
        "low":    c.low,
        "close":  c.close,
        "volume": c.volume,
    } for c in candles])
    df["time"] = pd.to_datetime(df["time"], unit="s", utc=True)
    df = df.set_index("time").sort_index()
    df = df.astype({"open": float, "high": float, "low": float, "close": float, "volume": float})
    return df


# ─── Support / Resistance ─────────────────────────────────────────────────────

def _find_pivots(df: pd.DataFrame, window: int = 5) -> Tuple[List[float], List[float]]:
    """
    Identify swing highs and lows using a rolling window.
    Returns (support_levels, resistance_levels).
    """
    highs = df["high"].values
    lows  = df["low"].values
    n     = len(df)

    pivot_highs: List[float] = []
    pivot_lows:  List[float] = []

    for i in range(window, n - window):
        if highs[i] == max(highs[i - window: i + window + 1]):
            pivot_highs.append(highs[i])
        if lows[i] == min(lows[i - window: i + window + 1]):
            pivot_lows.append(lows[i])

    return pivot_lows, pivot_highs


def _cluster_levels(levels: List[float], tolerance_pct: float = 0.003) -> List[float]:
    """Merge nearby S/R levels that are within tolerance_pct of each other."""
    if not levels:
        return []
    levels = sorted(levels)
    clusters: List[List[float]] = [[levels[0]]]
    for lvl in levels[1:]:
        if (lvl - clusters[-1][-1]) / clusters[-1][-1] < tolerance_pct:
            clusters[-1].append(lvl)
        else:
            clusters.append([lvl])
    return [round(sum(c) / len(c), 2) for c in clusters]


def find_support_resistance(df: pd.DataFrame, current_price: float) -> Dict[str, List[float]]:
    raw_support, raw_resistance = _find_pivots(df, window=5)
    supports    = _cluster_levels(raw_support)
    resistances = _cluster_levels(raw_resistance)

    # Keep only levels near current price (±15%)
    lo, hi = current_price * 0.85, current_price * 1.15
    supports    = sorted([s for s in supports    if lo < s < current_price], reverse=True)[:4]
    resistances = sorted([r for r in resistances if current_price < r < hi])[:4]

    return {"support": supports, "resistance": resistances}


# ─── VWAP ─────────────────────────────────────────────────────────────────────

def calculate_vwap(df: pd.DataFrame) -> float:
    """
    Rolling session VWAP.
    Uses the last 78 15-min bars (~1 full intraday session) or all bars if fewer.
    """
    session = df.tail(78)
    typical_price = (session["high"] + session["low"] + session["close"]) / 3
    vwap = (typical_price * session["volume"]).sum() / session["volume"].sum()
    return round(float(vwap), 2) if session["volume"].sum() > 0 else float(df["close"].iloc[-1])


# ─── Previous Day High / Low ──────────────────────────────────────────────────

def prev_day_hl(df: pd.DataFrame) -> Dict[str, float]:
    """Return yesterday's high and low using daily grouping."""
    daily = df.resample("1D").agg({"high": "max", "low": "min"}).dropna()
    if len(daily) < 2:
        return {"pdh": 0.0, "pdl": 0.0}
    yday = daily.iloc[-2]
    return {"pdh": round(float(yday["high"]), 2), "pdl": round(float(yday["low"]), 2)}


# ─── Main indicator calculator ────────────────────────────────────────────────

def calculate_indicators(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Calculate all indicators used by the analysis and rule engines.
    Returns a flat dict with latest values for each indicator.
    """
    close  = df["close"]
    high   = df["high"]
    low    = df["low"]
    volume = df["volume"]

    # ── Moving averages ──────────────────────────────────────────────────────
    ema9   = ta.ema(close, length=9)
    ema21  = ta.ema(close, length=21)
    ema50  = ta.ema(close, length=50)
    ema200 = ta.ema(close, length=200)
    sma20  = ta.sma(close, length=20)
    sma50  = ta.sma(close, length=50)
    sma200 = ta.sma(close, length=200)

    # ── Momentum ─────────────────────────────────────────────────────────────
    rsi14  = ta.rsi(close, length=14)
    macd_df = ta.macd(close, fast=12, slow=26, signal=9)

    # ── Volatility ────────────────────────────────────────────────────────────
    atr14  = ta.atr(high, low, close, length=14)
    bb     = ta.bbands(close, length=20, std=2)

    # ── Volume ────────────────────────────────────────────────────────────────
    vol_sma20 = ta.sma(volume, length=20)

    # ── Derived ───────────────────────────────────────────────────────────────
    vwap      = calculate_vwap(df)
    pdhl      = prev_day_hl(df)
    sr_levels = find_support_resistance(df, float(close.iloc[-1]))

    def last(series) -> float:
        if series is None or series.empty:
            return 0.0
        val = series.dropna()
        return round(float(val.iloc[-1]), 2) if not val.empty else 0.0

    macd_line   = last(macd_df["MACD_12_26_9"])    if macd_df is not None else 0.0
    macd_signal = last(macd_df["MACDs_12_26_9"])   if macd_df is not None else 0.0
    macd_hist   = last(macd_df["MACDh_12_26_9"])   if macd_df is not None else 0.0

    bb_upper = last(bb["BBU_20_2.0"]) if bb is not None else 0.0
    bb_lower = last(bb["BBL_20_2.0"]) if bb is not None else 0.0
    bb_mid   = last(bb["BBM_20_2.0"]) if bb is not None else 0.0

    current_price = last(close)
    current_vol   = last(volume)
    avg_vol_20    = last(vol_sma20)

    return {
        # Price
        "price":      current_price,
        # EMAs
        "ema9":       last(ema9),
        "ema21":      last(ema21),
        "ema50":      last(ema50),
        "ema200":     last(ema200),
        # SMAs
        "sma20":      last(sma20),
        "sma50":      last(sma50),
        "sma200":     last(sma200),
        # Momentum
        "rsi":        last(rsi14),
        "macd":       macd_line,
        "macd_signal": macd_signal,
        "macd_hist":  macd_hist,
        # Volatility
        "atr":        last(atr14),
        "bb_upper":   bb_upper,
        "bb_mid":     bb_mid,
        "bb_lower":   bb_lower,
        # Volume
        "volume":     current_vol,
        "avg_volume": avg_vol_20,
        "volume_ratio": round(current_vol / avg_vol_20, 2) if avg_vol_20 > 0 else 1.0,
        # Derived
        "vwap":       vwap,
        "pdh":        pdhl["pdh"],
        "pdl":        pdhl["pdl"],
        # S/R
        "support_levels":    sr_levels["support"],
        "resistance_levels": sr_levels["resistance"],
    }


def get_candles_for_chart(candles: List[Candle], limit: int = 100) -> List[Dict[str, Any]]:
    """Return last N candles formatted for TradingView Lightweight Charts."""
    return [
        {"time": c.time, "open": c.open, "high": c.high, "low": c.low, "close": c.close, "volume": c.volume}
        for c in candles[-limit:]
    ]
