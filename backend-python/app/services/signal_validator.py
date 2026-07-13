"""
Signal Validator — Approach 1.

Scans historical candle data for bars where the same setup conditions
were present, simulates a 1:1.5 R:R trade from each such bar, and
returns win/loss/hit_rate statistics.

This turns every analysis into a mini backtest so the confidence score
reflects actual historical edge rather than just indicator alignment.
"""

import math
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
import pandas_ta_classic as ta

from app.services.market_data import get_market_provider
from app.services.indicator_service import candles_to_df

_provider = get_market_provider()

WARMUP        = 55   # bars needed before indicators are reliable
N_FORWARD     = 20   # bars to look ahead per simulated trade
MIN_DECIDED   = 5    # minimum wins+losses to consider signal "validated"
ATR_MULT      = 1.5  # ATR multiplier for both SL and T1 (1:1 R:R baseline)


# ─── Indicator matrix for the scan ────────────────────────────────────────────

def _build_scan_matrix(df: pd.DataFrame) -> pd.DataFrame:
    ind = pd.DataFrame(index=df.index)
    ind["price"]    = df["close"]
    ind["ema9"]     = ta.ema(df["close"], length=9)
    ind["ema21"]    = ta.ema(df["close"], length=21)
    ind["ema50"]    = ta.ema(df["close"], length=50)
    ind["rsi"]      = ta.rsi(df["close"], length=14)

    macd_df = ta.macd(df["close"], fast=12, slow=26, signal=9)
    ind["macd_hist"] = (
        macd_df.get("MACDh_12_26_9", pd.Series(0, index=df.index))
        if macd_df is not None else 0.0
    )

    ind["atr"] = ta.atr(df["high"], df["low"], df["close"], length=14)

    vol_sma20 = ta.sma(df["volume"], length=20)
    ind["volume_ratio"] = (df["volume"] / vol_sma20).replace([np.inf, -np.inf], 1.0)

    tp = (df["high"] + df["low"] + df["close"]) / 3
    ind["vwap"] = (
        (tp * df["volume"]).rolling(78, min_periods=1).sum()
        / df["volume"].rolling(78, min_periods=1).sum()
    )

    return ind.fillna(0.0)


def _ind_row(matrix: pd.DataFrame, i: int) -> Dict[str, float]:
    row = matrix.iloc[i]
    return {col: float(row[col]) for col in matrix.columns}


# ─── Condition matching ────────────────────────────────────────────────────────

def _matches(ind: Dict[str, float], bias: str, setup_type: str) -> bool:
    """Return True if this bar's indicators replicate the current setup conditions."""
    price, ema9, ema21, ema50 = ind["price"], ind["ema9"], ind["ema21"], ind["ema50"]
    atr, rsi, macd_h, vwap, vr = ind["atr"], ind["rsi"], ind["macd_hist"], ind["vwap"], ind["volume_ratio"]

    if atr <= 0 or ema21 <= 0 or rsi == 0:
        return False

    if bias == "Bullish":
        base_ok = price > ema50 and ema9 > ema21 and rsi > 43
    elif bias == "Bearish":
        base_ok = price < ema50 and ema9 < ema21 and rsi < 57
    else:
        return False  # sideways — no directional edge to validate

    if not base_ok:
        return False

    # Setup-specific tightening
    if setup_type == "EMA21 Pullback":
        return abs(price - ema21) < atr * 1.0
    elif setup_type == "VWAP Bounce":
        return vwap > 0 and 0.0 <= (price - vwap) < atr * 1.0
    elif setup_type == "Breakout Retest":
        return macd_h > 0 and vr > 1.0
    else:
        # General directional signal
        return macd_h > 0 if bias == "Bullish" else macd_h < 0


# ─── Forward simulation ───────────────────────────────────────────────────────

def _simulate_forward(candles: list, entry_idx: int, bias: str, atr: float) -> str:
    """Return 'win', 'loss', or 'timeout' for the hypothetical trade."""
    if entry_idx >= len(candles) or atr <= 0:
        return "timeout"

    entry = candles[entry_idx].open
    sl_dist = atr * ATR_MULT

    if bias == "Bullish":
        sl, t1 = entry - sl_dist, entry + sl_dist
        for j in range(entry_idx + 1, min(entry_idx + N_FORWARD + 1, len(candles))):
            c = candles[j]
            if c.low  <= sl: return "loss"
            if c.high >= t1: return "win"
    else:
        sl, t1 = entry + sl_dist, entry - sl_dist
        for j in range(entry_idx + 1, min(entry_idx + N_FORWARD + 1, len(candles))):
            c = candles[j]
            if c.high >= sl: return "loss"
            if c.low  <= t1: return "win"

    return "timeout"


# ─── Public API ───────────────────────────────────────────────────────────────

def validate_signal(
    symbol: str,
    timeframe: str,
    bias: str,
    setup_type: str,
    n_candles: int = 500,
) -> Dict[str, Any]:
    """
    Scan historical bars for similar setup conditions and compute
    a historical hit rate (wins / decided, timeouts excluded).

    Returns:
        occurrences      — total bars where conditions matched
        decided          — occurrences that hit SL or T1 within N_FORWARD bars
        wins             — hit T1 first
        losses           — hit SL first
        hit_rate         — wins / decided * 100  (0 if decided < MIN_DECIDED)
        is_validated     — True if decided >= MIN_DECIDED
        confidence_label — 'Strong' | 'Moderate' | 'Weak' | 'Unverified'
    """
    candles = _provider.get_candles(symbol.upper(), timeframe, limit=max(n_candles, 250))

    if len(candles) < WARMUP + N_FORWARD + 10:
        return _empty(symbol, timeframe, bias, setup_type, "Not enough history")

    df     = candles_to_df(candles)
    matrix = _build_scan_matrix(df)

    wins = losses = timeouts = 0
    skip_until = 0   # simple cooldown: one trade at a time

    for i in range(WARMUP, len(candles) - N_FORWARD - 1):
        if i < skip_until:
            continue

        ind = _ind_row(matrix, i)
        if not _matches(ind, bias, setup_type):
            continue

        result = _simulate_forward(candles, i + 1, bias, ind["atr"])
        if   result == "win":     wins     += 1; skip_until = i + N_FORWARD
        elif result == "loss":    losses   += 1; skip_until = i + N_FORWARD
        else:                     timeouts += 1

    decided  = wins + losses
    hit_rate = round(wins / decided * 100, 1) if decided > 0 else 0.0

    if decided < MIN_DECIDED:
        label = "Unverified"
    elif hit_rate >= 60:
        label = "Strong"
    elif hit_rate >= 50:
        label = "Moderate"
    else:
        label = "Weak"

    return {
        "symbol":           symbol.upper(),
        "timeframe":        timeframe,
        "bias":             bias,
        "setup_type":       setup_type,
        "occurrences":      wins + losses + timeouts,
        "decided":          decided,
        "wins":             wins,
        "losses":           losses,
        "timeouts":         timeouts,
        "hit_rate":         hit_rate,
        "is_validated":     decided >= MIN_DECIDED,
        "confidence_label": label,
        "n_candles_scanned": len(candles),
    }


def _empty(symbol: str, timeframe: str, bias: str, setup_type: str, reason: str) -> Dict[str, Any]:
    return {
        "symbol": symbol.upper(), "timeframe": timeframe,
        "bias": bias, "setup_type": setup_type,
        "occurrences": 0, "decided": 0, "wins": 0, "losses": 0, "timeouts": 0,
        "hit_rate": 0.0, "is_validated": False, "confidence_label": "Unverified",
        "n_candles_scanned": 0, "reason": reason,
    }
