"""
Backtesting Engine — Phase 5.

Approach:
  1. Fetch N candles from MockProvider (default 500)
  2. Pre-compute ALL indicator series on the full DataFrame in one pass
     (pandas-ta rolling computations are causal: value at i only uses data[0..i])
  3. Walk forward bar-by-bar; at each bar evaluate strategy rules on the
     indicator snapshot at that index
  4. On a match: enter trade on NEXT candle's open; simulate exit via
     subsequent candle high/low vs SL / Target1
  5. Aggregate trade list into performance metrics + equity curve

No look-ahead bias because:
  - Standard TA (EMA, RSI, MACD, ATR) are computed as rolling series —
    the value at bar i genuinely depends only on bars 0..i.
  - Entry is on the NEXT bar's open after the signal bar.
  - Exit checks use intracandle high/low (realistic).
"""

import math
from statistics import mean, stdev
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import pandas_ta_classic as ta

from app.services.market_data import MockMarketProvider
from app.services.strategy_engine import evaluate_strategy

_provider = MockMarketProvider()

# ─── Indicator matrix ─────────────────────────────────────────────────────────

def _build_indicator_matrix(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute all indicator series for the full DataFrame in one vectorised pass.
    Each row i gives the indicator state AT bar i (causal — no look-ahead).
    """
    ind = pd.DataFrame(index=df.index)

    ind["price"]       = df["close"]
    ind["ema9"]        = ta.ema(df["close"], length=9)
    ind["ema21"]       = ta.ema(df["close"], length=21)
    ind["ema50"]       = ta.ema(df["close"], length=50)
    ind["ema200"]      = ta.ema(df["close"], length=200)
    ind["sma20"]       = ta.sma(df["close"], length=20)
    ind["sma50"]       = ta.sma(df["close"], length=50)
    ind["sma200"]      = ta.sma(df["close"], length=200)
    ind["rsi"]         = ta.rsi(df["close"], length=14)

    macd_df = ta.macd(df["close"], fast=12, slow=26, signal=9)
    if macd_df is not None:
        ind["macd"]        = macd_df.get("MACD_12_26_9",  0)
        ind["macd_signal"] = macd_df.get("MACDs_12_26_9", 0)
        ind["macd_hist"]   = macd_df.get("MACDh_12_26_9", 0)
    else:
        ind["macd"] = ind["macd_signal"] = ind["macd_hist"] = 0.0

    ind["atr"]  = ta.atr(df["high"], df["low"], df["close"], length=14)

    bb = ta.bbands(df["close"], length=20, std=2)
    if bb is not None:
        ind["bb_upper"] = bb.get("BBU_20_2.0", 0)
        ind["bb_mid"]   = bb.get("BBM_20_2.0", 0)
        ind["bb_lower"] = bb.get("BBL_20_2.0", 0)
    else:
        ind["bb_upper"] = ind["bb_mid"] = ind["bb_lower"] = 0.0

    vol_sma20 = ta.sma(df["volume"], length=20)
    ind["volume_ratio"] = (df["volume"] / vol_sma20).replace([np.inf, -np.inf], 1.0)

    # Rolling VWAP (78-bar session window)
    tp = (df["high"] + df["low"] + df["close"]) / 3
    ind["vwap"] = (tp * df["volume"]).rolling(78, min_periods=1).sum() \
                / df["volume"].rolling(78, min_periods=1).sum()

    ind["pdh"] = 0.0   # not used in backtest — strategy engine skips list indicators
    ind["pdl"] = 0.0
    ind["support_levels"]    = None   # placeholder; engine skips list types
    ind["resistance_levels"] = None

    return ind.fillna(0.0)


def _ind_at(matrix: pd.DataFrame, i: int) -> Dict[str, Any]:
    """Extract indicator snapshot at bar i as a plain dict."""
    row = matrix.iloc[i]
    d: Dict[str, Any] = {}
    for col in matrix.columns:
        val = row[col]
        d[col] = 0.0 if (val is None or (isinstance(val, float) and math.isnan(val))) else float(val)
    d["support_levels"]    = []
    d["resistance_levels"] = []
    return d


# ─── Bias from indicators ─────────────────────────────────────────────────────

def _bias_from_ind(ind: Dict[str, Any]) -> str:
    """Lightweight market bias from EMA stack + RSI + MACD (same logic as analysis_service)."""
    price = ind["price"]
    bull  = sum([
        price > ind["ema9"],
        price > ind["ema21"],
        price > ind["ema50"],
        ind["ema9"]  > ind["ema21"],
        ind["ema21"] > ind["ema50"],
        ind["rsi"]   > 55,
        ind["macd_hist"] > 0,
    ])
    bear = 7 - bull
    if bull / 7 >= 0.7:  return "Bullish"
    if bull / 7 <= 0.3:  return "Bearish"
    return "Sideways"


# ─── Trade simulation ─────────────────────────────────────────────────────────

_MAX_BARS_IN_TRADE = 20   # force exit after 20 bars if neither SL nor target hit
_COOLDOWN_BARS    = 5     # bars to skip after a trade exits before taking the next


def _simulate_trade(
    candles_list: list,
    signal_idx:   int,
    bias:         str,
    atr:          float,
    capital:      float,
    risk_pct:     float,
) -> Optional[Dict[str, Any]]:
    """
    Enter trade on candle at (signal_idx + 1).open; simulate exit.
    Returns trade dict or None if entry candle is missing / sizing issue.
    """
    entry_idx = signal_idx + 1
    if entry_idx >= len(candles_list):
        return None

    entry_c     = candles_list[entry_idx]
    entry_price = entry_c.open

    if atr <= 0:
        return None

    if bias == "Bullish":
        sl      = round(entry_price - 1.5 * atr, 2)
        target1 = round(entry_price + 1.5 * abs(entry_price - sl), 2)
        target2 = round(entry_price + 2.5 * abs(entry_price - sl), 2)
        direction = "LONG"
    elif bias == "Bearish":
        sl      = round(entry_price + 1.5 * atr, 2)
        target1 = round(entry_price - 1.5 * abs(sl - entry_price), 2)
        target2 = round(entry_price - 2.5 * abs(sl - entry_price), 2)
        direction = "SHORT"
    else:
        return None   # skip sideways — no clear directional edge

    risk_per_share = abs(entry_price - sl)
    if risk_per_share < 0.01:
        return None

    risk_amount = capital * risk_pct / 100
    qty = max(1, math.floor(risk_amount / risk_per_share))

    trade_result = "timeout"
    exit_price   = candles_list[min(entry_idx + _MAX_BARS_IN_TRADE, len(candles_list) - 1)].close
    exit_idx     = min(entry_idx + _MAX_BARS_IN_TRADE, len(candles_list) - 1)

    for j in range(entry_idx + 1, min(entry_idx + _MAX_BARS_IN_TRADE + 1, len(candles_list))):
        c = candles_list[j]
        if direction == "LONG":
            if c.low <= sl:
                trade_result = "loss";  exit_price = sl;      exit_idx = j; break
            if c.high >= target1:
                trade_result = "win";   exit_price = target1; exit_idx = j; break
        else:   # SHORT
            if c.high >= sl:
                trade_result = "loss";  exit_price = sl;      exit_idx = j; break
            if c.low <= target1:
                trade_result = "win";   exit_price = target1; exit_idx = j; break

    pnl = (exit_price - entry_price) * qty if direction == "LONG" \
          else (entry_price - exit_price) * qty

    return {
        "direction":   direction,
        "entry_idx":   entry_idx,
        "exit_idx":    exit_idx,
        "entry_time":  entry_c.time,
        "exit_time":   candles_list[exit_idx].time,
        "entry_price": round(entry_price, 2),
        "exit_price":  round(exit_price,  2),
        "sl":          sl,
        "target1":     target1,
        "target2":     target2,
        "qty":         qty,
        "result":      trade_result,
        "pnl":         round(pnl, 2),
        "risk_amount": round(risk_amount, 2),
    }


# ─── Metrics ──────────────────────────────────────────────────────────────────

def _compute_metrics(trades: List[Dict], initial_capital: float) -> Dict[str, Any]:
    if not trades:
        return {
            "total_trades": 0, "winning_trades": 0, "losing_trades": 0, "timeout_trades": 0,
            "win_rate": 0.0, "net_pnl": 0.0, "gross_profit": 0.0, "gross_loss": 0.0,
            "profit_factor": 0.0, "avg_rr": 0.0, "max_drawdown_pct": 0.0,
            "best_trade": 0.0, "worst_trade": 0.0, "equity_curve": [initial_capital],
            "trades": [],
        }

    wins     = [t for t in trades if t["result"] == "win"]
    losses   = [t for t in trades if t["result"] == "loss"]
    timeouts = [t for t in trades if t["result"] == "timeout"]

    gross_profit = sum(t["pnl"] for t in trades if t["pnl"] > 0)
    gross_loss   = abs(sum(t["pnl"] for t in trades if t["pnl"] < 0))
    net_pnl      = sum(t["pnl"] for t in trades)
    profit_factor = round(gross_profit / gross_loss, 2) if gross_loss > 0 else 999.0

    # Average R:R
    avg_win  = mean([t["pnl"] for t in wins])  if wins  else 0.0
    avg_loss = abs(mean([t["pnl"] for t in losses])) if losses else 1.0
    avg_rr   = round(avg_win / avg_loss, 2) if avg_loss > 0 else 0.0

    # Equity curve
    equity = [initial_capital]
    for t in trades:
        equity.append(round(equity[-1] + t["pnl"], 2))

    # Max drawdown
    peak = equity[0]
    max_dd = 0.0
    for e in equity:
        if e > peak: peak = e
        dd = (peak - e) / peak * 100
        if dd > max_dd: max_dd = dd

    # Annotate cumulative P&L onto trades
    cumulative = 0.0
    for t in trades:
        cumulative += t["pnl"]
        t["cumulative_pnl"] = round(cumulative, 2)

    return {
        "total_trades":    len(trades),
        "winning_trades":  len(wins),
        "losing_trades":   len(losses),
        "timeout_trades":  len(timeouts),
        "win_rate":        round(len(wins) / len(trades) * 100, 1),
        "net_pnl":         round(net_pnl, 2),
        "gross_profit":    round(gross_profit, 2),
        "gross_loss":      round(gross_loss, 2),
        "profit_factor":   profit_factor,
        "avg_rr":          avg_rr,
        "max_drawdown_pct": round(max_dd, 2),
        "best_trade":      round(max(t["pnl"] for t in trades), 2),
        "worst_trade":     round(min(t["pnl"] for t in trades), 2),
        "equity_curve":    [round(e, 2) for e in equity],
        "trades":          trades,
    }


# ─── Public entry point ───────────────────────────────────────────────────────

WARMUP = 55   # minimum bars needed for all indicators to be valid


def run_backtest(
    symbol:             str,
    timeframe:          str,
    strategy_conditions: Dict[str, Any],
    capital:            float = 100_000,
    risk_pct:           float = 1.0,
    n_candles:          int   = 500,
) -> Dict[str, Any]:
    """
    Run a walk-forward backtest of a strategy on synthetic OHLCV data.

    Args:
        symbol:              NSE/BSE ticker
        timeframe:           Candle timeframe string
        strategy_conditions: Strategy `conditions` JSON (rules + logic)
        capital:             Trading capital in INR
        risk_pct:            Max risk per trade (% of capital)
        n_candles:           Number of historical candles to simulate over

    Returns:
        {
          symbol, timeframe, n_candles, initial_capital,
          total_trades, winning_trades, losing_trades, timeout_trades,
          win_rate, net_pnl, gross_profit, gross_loss, profit_factor,
          avg_rr, max_drawdown_pct, best_trade, worst_trade,
          equity_curve, trades
        }
    """
    candles = _provider.get_candles(symbol.upper(), timeframe, limit=max(n_candles, 200))
    if len(candles) < WARMUP + 10:
        raise ValueError(f"Not enough data for {symbol}/{timeframe} (got {len(candles)} candles, need {WARMUP + 10})")

    # Build indicator matrix in one vectorised pass
    from app.services.indicator_service import candles_to_df
    df     = candles_to_df(candles)
    matrix = _build_indicator_matrix(df)

    trades:   List[Dict] = []
    i        = WARMUP
    cooldown = 0

    while i < len(candles) - 1:
        if i < cooldown:
            i += 1
            continue

        ind = _ind_at(matrix, i)

        # Skip if key indicators not yet warm
        if ind["ema21"] == 0 or ind["rsi"] == 0 or ind["atr"] == 0:
            i += 1
            continue

        strategy_result = evaluate_strategy(strategy_conditions, ind)
        if not strategy_result["matches"]:
            i += 1
            continue

        bias = _bias_from_ind(ind)
        trade = _simulate_trade(candles, i, bias, ind["atr"], capital, risk_pct)
        if trade is None:
            i += 1
            continue

        trade["trade_num"] = len(trades) + 1
        trades.append(trade)
        cooldown = trade["exit_idx"] + _COOLDOWN_BARS
        i        = trade["exit_idx"] + 1

    metrics = _compute_metrics(trades, capital)

    return {
        "symbol":          symbol.upper(),
        "timeframe":       timeframe,
        "n_candles":       len(candles),
        "initial_capital": capital,
        **metrics,
    }
