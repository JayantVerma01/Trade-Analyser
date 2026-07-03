"""
Multi-Timeframe (MTF) Confluence Analyser — Approach 2.

For a given symbol and primary timeframe, runs market bias detection
on 2 higher timeframes and scores how well they align.

A strong MTF confluence (all 3 TFs agree) adds up to +12 points to the
confidence score; a conflicting picture deducts up to -10 points.
"""

from typing import Any, Dict, List, Tuple

from app.services.indicator_service import calculate_indicators, candles_to_df
from app.services.market_data import MockMarketProvider

_provider = MockMarketProvider()

# Primary TF → [immediate parent, grandparent]
TF_HIERARCHY: Dict[str, List[str]] = {
    "1m":  ["5m",  "15m"],
    "3m":  ["15m", "1h"],
    "5m":  ["15m", "1h"],
    "15m": ["1h",  "4h"],
    "30m": ["1h",  "4h"],
    "1h":  ["4h",  "1d"],
    "4h":  ["1d",  "1w"],
    "1d":  ["1w",  "1M"],
}

TF_LABELS: Dict[str, str] = {
    "1m": "1 Min", "3m": "3 Min", "5m": "5 Min", "15m": "15 Min",
    "30m": "30 Min", "1h": "1 Hour", "4h": "4 Hour",
    "1d": "Daily", "1w": "Weekly", "1M": "Monthly",
}


def _compute_bias(symbol: str, timeframe: str) -> Tuple[str, float, Dict[str, float]]:
    """
    Return (bias, bull_pct, key_indicators).
    bias     : 'Bullish' | 'Bearish' | 'Sideways'
    bull_pct : 0.0–1.0 (proportion of 7 bias checks that are bullish)
    """
    try:
        candles = _provider.get_candles(symbol.upper(), timeframe, limit=250)
        if len(candles) < 55:
            return "Sideways", 0.5, {}
        df  = candles_to_df(candles)
        ind = calculate_indicators(df)
    except Exception:
        return "Sideways", 0.5, {}

    price = ind["price"]
    checks = [
        price > ind["ema9"],
        price > ind["ema21"],
        price > ind["ema50"],
        ind["ema9"]      > ind["ema21"],
        ind["ema21"]     > ind["ema50"],
        ind["rsi"]       > 55,
        ind["macd_hist"] > 0,
    ]
    bull_pct = sum(checks) / len(checks)

    if bull_pct >= 0.65:
        bias = "Bullish"
    elif bull_pct <= 0.35:
        bias = "Bearish"
    else:
        bias = "Sideways"

    key = {
        "price":     round(price, 2),
        "rsi":       round(ind["rsi"], 1),
        "macd_hist": round(ind["macd_hist"], 2),
        "ema21":     round(ind["ema21"], 2),
        "vwap":      round(ind["vwap"], 2),
    }
    return bias, round(bull_pct, 3), key


def analyse_mtf_confluence(symbol: str, primary_tf: str) -> Dict[str, Any]:
    """
    Run bias analysis on primary TF + up to 2 higher TFs and score alignment.

    Returns
    -------
    primary_tf           : str
    higher_tfs           : list[str]
    timeframe_bias       : {tf -> {bias, bull_pct, label, is_primary, key_indicators}}
    confluence_score     : int  0-3
    confluence_label     : 'Strong' | 'Moderate' | 'Weak' | 'Conflicting'
    primary_bias         : str
    all_bullish          : bool
    all_bearish          : bool
    confidence_adjustment: int  (add this to the analysis confidence score)
    """
    higher_tfs = TF_HIERARCHY.get(primary_tf, [])[:2]
    all_tfs    = [primary_tf] + higher_tfs

    tf_results: Dict[str, Dict] = {}

    for tf in all_tfs:
        bias, bull_pct, key_ind = _compute_bias(symbol, tf)
        tf_results[tf] = {
            "bias":           bias,
            "bull_pct":       bull_pct,
            "label":          TF_LABELS.get(tf, tf),
            "is_primary":     tf == primary_tf,
            "key_indicators": key_ind,
        }

    biases         = [tf_results[tf]["bias"] for tf in all_tfs]
    primary_bias   = tf_results[primary_tf]["bias"]
    bullish_count  = biases.count("Bullish")
    bearish_count  = biases.count("Bearish")
    total          = len(all_tfs)
    dominant       = max(bullish_count, bearish_count)

    if dominant == total:
        score = 3; label = "Strong";      adj = 12
    elif dominant == total - 1:
        score = 2; label = "Moderate";    adj = 6
    elif dominant == 1:
        score = 1; label = "Weak";        adj = -5
    else:
        score = 0; label = "Conflicting"; adj = -10

    # Reduce penalty when primary itself is sideways
    if primary_bias == "Sideways":
        label = "Sideways Primary"
        adj   = -4

    return {
        "primary_tf":             primary_tf,
        "higher_tfs":             higher_tfs,
        "timeframe_bias":         tf_results,
        "confluence_score":       score,
        "confluence_label":       label,
        "primary_bias":           primary_bias,
        "all_bullish":            bullish_count == total,
        "all_bearish":            bearish_count == total,
        "confidence_adjustment":  adj,
        "total_tfs_analysed":     total,
    }
