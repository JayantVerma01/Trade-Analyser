"""
Stock analysis service.

Pipeline:
  candles → indicators → market bias → setup detection
  → entry/SL/target → position sizing → confidence → output
"""

import math
from typing import Any, Dict, List, Optional, Tuple

from app.services.indicator_service import calculate_indicators, candles_to_df, get_candles_for_chart
from app.services.market_data import MockMarketProvider
from app.services.strategy_engine import evaluate_strategy
from app.services.signal_validator import validate_signal
from app.services.mtf_analysis import analyse_mtf_confluence

# Single instance — swap to real provider in Phase 7
_provider = MockMarketProvider()

RISK_WARNING = (
    "This is AI-generated analysis for educational and planning purposes only. "
    "It is NOT financial advice. Never trade based solely on this output. "
    "Always apply your own judgement, confirm manually, and manage your risk."
)


# ─── Market bias ──────────────────────────────────────────────────────────────

def _detect_market_bias(ind: Dict[str, Any]) -> Tuple[str, str]:
    """
    Returns (bias, reason).
    bias: 'Bullish' | 'Bearish' | 'Sideways'
    """
    price  = ind["price"]
    ema9   = ind["ema9"]
    ema21  = ind["ema21"]
    ema50  = ind["ema50"]
    ema200 = ind["ema200"]
    rsi    = ind["rsi"]
    macd_h = ind["macd_hist"]

    bullish_score = 0
    bearish_score = 0

    if price > ema9:   bullish_score += 1
    else:              bearish_score += 1
    if price > ema21:  bullish_score += 1
    else:              bearish_score += 1
    if price > ema50:  bullish_score += 1
    else:              bearish_score += 1
    if ema9 > ema21:   bullish_score += 1
    else:              bearish_score += 1
    if ema21 > ema50:  bullish_score += 1
    else:              bearish_score += 1
    if rsi > 55:       bullish_score += 1
    elif rsi < 45:     bearish_score += 1
    if macd_h > 0:     bullish_score += 1
    else:              bearish_score += 1

    total = bullish_score + bearish_score
    if total == 0:
        return "Sideways", "Insufficient data for bias detection"

    bull_pct = bullish_score / total

    if bull_pct >= 0.7:
        reason = (
            f"Strong bullish: price above EMA9/EMA21/EMA50 stack, "
            f"RSI={rsi:.1f}, MACD histogram {'positive' if macd_h > 0 else 'negative'}"
        )
        return "Bullish", reason
    elif bull_pct >= 0.55:
        reason = f"Mild bullish bias: {bullish_score}/{total} indicators aligned. RSI={rsi:.1f}"
        return "Bullish", reason
    elif bull_pct <= 0.3:
        reason = (
            f"Strong bearish: price below EMA stack, "
            f"RSI={rsi:.1f}, MACD histogram {'negative' if macd_h < 0 else 'positive'}"
        )
        return "Bearish", reason
    elif bull_pct <= 0.45:
        reason = f"Mild bearish bias: {bearish_score}/{total} indicators bearish. RSI={rsi:.1f}"
        return "Bearish", reason
    else:
        reason = f"Mixed signals ({bullish_score}B/{bearish_score}Bear). RSI={rsi:.1f} in neutral zone."
        return "Sideways", reason


# ─── Setup detection ──────────────────────────────────────────────────────────

def _detect_breakout_retest(ind: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Breakout Retest setup:
    - At least one resistance level was recently broken (price > resistance)
    - Price is now near that level (within 1.5x ATR = retest zone)
    - Volume above average
    - Trend is bullish
    """
    price = ind["price"]
    atr   = ind["atr"]
    vr    = ind["volume_ratio"]
    resistances = ind["resistance_levels"]

    # Find a recently broken resistance (price now above it but close to it)
    for res in sorted(resistances):
        dist = price - res
        if 0 < dist < 2.5 * atr:    # price is above resistance but in retest zone
            return {
                "setup_type": "Breakout Retest",
                "breakout_level": res,
                "entry_from": round(res * 0.998, 2),
                "entry_to":   round(res * 1.002 + atr * 0.3, 2),
                "entry_condition": (
                    f"Enter long on retest of ₹{res:.2f} breakout zone. "
                    f"Wait for a bullish candle close above ₹{res:.2f} with volume confirmation."
                ),
                "volume_confirmed": vr > 1.1,
            }
    return None


def _detect_ema_pullback(ind: Dict[str, Any], bias: str) -> Optional[Dict[str, Any]]:
    """
    EMA Pullback (most reliable intraday/swing setup):
    - Trend is Bullish
    - Price has pulled back to EMA21 zone (within 0.5x ATR)
    - RSI > 45 (not oversold — trend intact)
    - Price above EMA50
    """
    if bias != "Bullish":
        return None
    price = ind["price"]
    ema21 = ind["ema21"]
    ema50 = ind["ema50"]
    atr   = ind["atr"]
    rsi   = ind["rsi"]

    near_ema21 = abs(price - ema21) < atr * 0.8
    above_ema50 = price > ema50
    rsi_ok = rsi > 43

    if near_ema21 and above_ema50 and rsi_ok:
        return {
            "setup_type": "EMA21 Pullback",
            "ema_level": ema21,
            "entry_from": round(ema21 * 0.999, 2),
            "entry_to":   round(ema21 + atr * 0.3, 2),
            "entry_condition": (
                f"Enter long on pullback to EMA21 (₹{ema21:.2f}). "
                f"Wait for a bullish reversal candle (hammer, engulfing) near EMA21."
            ),
            "volume_confirmed": ind["volume_ratio"] > 0.9,
        }
    return None


def _detect_vwap_bounce(ind: Dict[str, Any], bias: str) -> Optional[Dict[str, Any]]:
    """
    VWAP Bounce (intraday):
    - Trend is Bullish
    - Price is near VWAP from above (within 0.6x ATR)
    - RSI not oversold
    """
    if bias != "Bullish":
        return None
    price = ind["price"]
    vwap  = ind["vwap"]
    atr   = ind["atr"]
    rsi   = ind["rsi"]

    near_vwap = 0 <= (price - vwap) < atr * 0.8
    rsi_ok    = rsi > 45

    if near_vwap and rsi_ok and vwap > 0:
        return {
            "setup_type": "VWAP Bounce",
            "vwap_level": vwap,
            "entry_from": round(vwap, 2),
            "entry_to":   round(vwap + atr * 0.4, 2),
            "entry_condition": (
                f"Enter long on bounce from VWAP (₹{vwap:.2f}). "
                f"Price should hold above VWAP with buying volume."
            ),
            "volume_confirmed": ind["volume_ratio"] > 1.0,
        }
    return None


def _detect_setup(ind: Dict[str, Any], bias: str) -> Dict[str, Any]:
    """Try each setup in priority order. Return first match or No Setup."""
    setup = (
        _detect_breakout_retest(ind)
        or _detect_ema_pullback(ind, bias)
        or _detect_vwap_bounce(ind, bias)
    )
    if setup:
        return setup
    return {
        "setup_type": "No Clear Setup",
        "entry_from": ind["price"],
        "entry_to":   ind["price"],
        "entry_condition": "No high-probability setup detected under current conditions. Wait for clearer price action.",
        "volume_confirmed": False,
    }


# ─── Trade parameters ─────────────────────────────────────────────────────────

def _calculate_trade_params(
    setup: Dict[str, Any],
    ind: Dict[str, Any],
    bias: str,
    capital: float,
    risk_pct: float,
) -> Dict[str, Any]:
    atr        = ind["atr"]
    entry_from = setup["entry_from"]
    entry_to   = setup["entry_to"]
    entry_mid  = (entry_from + entry_to) / 2

    if bias == "Bullish":
        # SL below support or 1.5x ATR below entry
        nearest_support = ind["support_levels"][0] if ind["support_levels"] else entry_mid - 2 * atr
        sl_atr_based    = entry_mid - 1.5 * atr
        stop_loss       = round(max(nearest_support - atr * 0.1, sl_atr_based), 2)
        risk_per_share  = entry_mid - stop_loss
        target1 = round(entry_mid + risk_per_share * 1.5, 2)
        target2 = round(entry_mid + risk_per_share * 2.5, 2)
    elif bias == "Bearish":
        nearest_resistance = ind["resistance_levels"][0] if ind["resistance_levels"] else entry_mid + 2 * atr
        sl_atr_based       = entry_mid + 1.5 * atr
        stop_loss          = round(min(nearest_resistance + atr * 0.1, sl_atr_based), 2)
        risk_per_share     = stop_loss - entry_mid
        target1 = round(entry_mid - risk_per_share * 1.5, 2)
        target2 = round(entry_mid - risk_per_share * 2.5, 2)
    else:
        stop_loss      = round(entry_mid - 1.5 * atr, 2)
        risk_per_share = entry_mid - stop_loss
        target1        = round(entry_mid + risk_per_share * 1.5, 2)
        target2        = round(entry_mid + risk_per_share * 2.5, 2)

    if risk_per_share <= 0:
        risk_per_share = atr

    rr_ratio  = risk_per_share and round((target1 - entry_mid) / risk_per_share, 2)
    risk_amt  = capital * risk_pct / 100
    qty       = max(1, math.floor(risk_amt / risk_per_share))

    return {
        "entry_zone":  {"from": round(entry_from, 2), "to": round(entry_to, 2)},
        "stop_loss":   stop_loss,
        "target1":     target1,
        "target2":     target2,
        "risk_reward": f"1:{rr_ratio}",
        "position_size": qty,
        "risk_per_share": round(risk_per_share, 2),
        "risk_amount":    round(risk_amt, 2),
    }


# ─── Rules evaluation ─────────────────────────────────────────────────────────

def _evaluate_rules(
    ind: Dict[str, Any],
    bias: str,
    setup: Dict[str, Any],
    trade: Dict[str, Any],
) -> Tuple[List[str], List[str]]:
    passed, failed = [], []
    price = ind["price"]

    # Trend rules
    if price > ind["ema50"]:  passed.append("Price above EMA50 (trend filter)")
    else:                     failed.append("Price below EMA50 (trend not confirmed)")

    if price > ind["ema200"] and ind["ema200"] > 0:
        passed.append("Price above EMA200 (long-term bullish)")
    elif ind["ema200"] > 0:
        failed.append("Price below EMA200 (long-term bearish)")

    if ind["ema9"] > ind["ema21"]:  passed.append("EMA9 above EMA21 (short-term momentum bullish)")
    else:                            failed.append("EMA9 below EMA21 (short-term momentum bearish)")

    # RSI rules
    if 40 <= ind["rsi"] <= 70:  passed.append(f"RSI {ind['rsi']:.1f} — in healthy trading zone")
    elif ind["rsi"] > 70:       failed.append(f"RSI {ind['rsi']:.1f} — overbought, risk of reversal")
    else:                        failed.append(f"RSI {ind['rsi']:.1f} — oversold, wait for recovery")

    # MACD
    if ind["macd_hist"] > 0:  passed.append("MACD histogram positive (bullish momentum)")
    else:                      failed.append("MACD histogram negative (bearish momentum)")

    # Volume
    vr = ind["volume_ratio"]
    if vr >= 1.2:  passed.append(f"Volume {vr:.1f}x average — strong participation")
    elif vr >= 0.9: passed.append(f"Volume {vr:.1f}x average — acceptable")
    else:           failed.append(f"Volume {vr:.1f}x average — below average, weak participation")

    # VWAP
    if ind["vwap"] > 0:
        if price > ind["vwap"]:  passed.append(f"Price above VWAP ₹{ind['vwap']:.2f}")
        else:                     failed.append(f"Price below VWAP ₹{ind['vwap']:.2f}")

    # Risk-reward
    rr_num = float(trade["risk_reward"].split(":")[1])
    if rr_num >= 2.0:  passed.append(f"Risk-reward {trade['risk_reward']} — favourable (≥1:2)")
    elif rr_num >= 1.5: passed.append(f"Risk-reward {trade['risk_reward']} — acceptable (≥1:1.5)")
    else:               failed.append(f"Risk-reward {trade['risk_reward']} — below minimum 1:1.5")

    return passed, failed


# ─── Confidence score ─────────────────────────────────────────────────────────

def _confidence_score(
    rules_passed: List[str],
    rules_failed: List[str],
    setup: Dict[str, Any],
    ind: Dict[str, Any],
) -> int:
    total_rules = len(rules_passed) + len(rules_failed)
    if total_rules == 0:
        return 30

    base = round((len(rules_passed) / total_rules) * 70)  # max 70 from rules

    # Bonus points
    bonus = 0
    if setup["volume_confirmed"]:  bonus += 8
    if ind["rsi"] > 50:            bonus += 5
    if setup["setup_type"] != "No Clear Setup": bonus += 10
    if ind["macd_hist"] > 0:       bonus += 5
    if ind["volume_ratio"] > 1.3:  bonus += 5

    return min(int(base + bonus), 92)   # cap at 92 — never give 100%


# ─── Reasoning ────────────────────────────────────────────────────────────────

def _build_reasoning(
    symbol: str, timeframe: str,
    bias: str, bias_reason: str,
    setup: Dict[str, Any],
    ind: Dict[str, Any],
    trade: Dict[str, Any],
    rules_passed: List[str],
    rules_failed: List[str],
) -> str:
    vwap_str = f"VWAP at ₹{ind['vwap']:.2f}. " if ind["vwap"] > 0 else ""
    return (
        f"**{symbol} ({timeframe}) — {bias} Setup: {setup['setup_type']}**\n\n"
        f"**Market Bias:** {bias_reason}\n\n"
        f"**Setup:** {setup['entry_condition']}\n\n"
        f"**Key Levels:** "
        f"EMA9=₹{ind['ema9']:.2f}, EMA21=₹{ind['ema21']:.2f}, EMA50=₹{ind['ema50']:.2f}. "
        f"RSI={ind['rsi']:.1f}. {vwap_str}"
        f"Volume is {ind['volume_ratio']:.1f}x the 20-period average.\n\n"
        f"**Rules passed ({len(rules_passed)}):** {', '.join(rules_passed[:3])}{'...' if len(rules_passed) > 3 else ''}.\n\n"
        f"**Rules failed ({len(rules_failed)}):** {', '.join(rules_failed[:3]) if rules_failed else 'None'}.\n\n"
        f"**Trade parameters:** Entry ₹{trade['entry_zone']['from']}–₹{trade['entry_zone']['to']}, "
        f"SL ₹{trade['stop_loss']}, Target1 ₹{trade['target1']}, Target2 ₹{trade['target2']}, "
        f"R:R {trade['risk_reward']}, Qty {trade['position_size']} shares."
    )


# ─── Public entry point ───────────────────────────────────────────────────────

def run_analysis(
    symbol: str,
    timeframe: str,
    capital: float,
    risk_pct: float,
    market_type: str = "intraday",
    notes: str = "",
    strategy_conditions: Optional[Dict[str, Any]] = None,
    strategy_name: str = "",
) -> Dict[str, Any]:
    """
    Full analysis pipeline. Returns structured JSON matching TradeSetupOutput schema.
    Optionally evaluates a user strategy's rule conditions on top of the base analysis.
    """
    # 1. Fetch candles
    candles = _provider.get_candles(symbol, timeframe, limit=250)
    if len(candles) < 50:
        raise ValueError(f"Not enough data for {symbol}/{timeframe}")

    # 2. Compute indicators
    df  = candles_to_df(candles)
    ind = calculate_indicators(df)

    # 3. Market bias
    bias, bias_reason = _detect_market_bias(ind)

    # 4. Setup detection
    setup = _detect_setup(ind, bias)

    # 5. Trade parameters
    trade = _calculate_trade_params(setup, ind, bias, capital, risk_pct)

    # 6. Base rules
    rules_passed, rules_failed = _evaluate_rules(ind, bias, setup, trade)

    # 6b. Strategy rule evaluation (optional)
    strategy_result: Optional[Dict[str, Any]] = None
    if strategy_conditions:
        strategy_result = evaluate_strategy(strategy_conditions, ind)
        # Merge strategy rules into base rule lists
        rules_passed = rules_passed + [f"[Strategy] {r}" for r in strategy_result["rules_matched"]]
        rules_failed = rules_failed + [f"[Strategy] {r}" for r in strategy_result["rules_failed"]]

    # 7. Confidence (with optional strategy bonus)
    conf = _confidence_score(rules_passed, rules_failed, setup, ind)
    if strategy_result and strategy_result["matches"]:
        conf = min(conf + strategy_result["confidence_bonus"], 92)

    # 7a. Approach 2: MTF Confluence — adjust confidence based on higher-TF alignment
    mtf_confluence = analyse_mtf_confluence(symbol, timeframe)
    conf = min(max(conf + mtf_confluence["confidence_adjustment"], 10), 92)

    # 7b. Approach 1: Signal Validation — mini-backtest of current setup conditions
    validation = validate_signal(symbol, timeframe, bias, setup["setup_type"])
    # Validated strong signal: small confidence boost; weak/unvalidated: small penalty
    if validation["is_validated"]:
        if validation["hit_rate"] >= 60:
            conf = min(conf + 5, 92)
        elif validation["hit_rate"] < 45:
            conf = max(conf - 3, 10)

    # 8. Reasoning
    reasoning = _build_reasoning(
        symbol, timeframe, bias, bias_reason, setup, ind, trade,
        rules_passed, rules_failed,
    )
    if strategy_result:
        match_str = "MATCHED" if strategy_result["matches"] else "NOT MATCHED"
        strategy_label = strategy_name or "Custom Strategy"
        reasoning += (
            f"\n\n**Strategy: {strategy_label}** — {match_str} "
            f"({strategy_result['score']*100:.0f}% rules passed). "
            f"Logic: {strategy_result['logic']}."
        )

    # 9. Invalidation condition
    invalidation = (
        f"Setup is invalid if price closes below ₹{trade['stop_loss']:.2f} (stop loss level). "
        f"Also re-evaluate if RSI drops below 40 or volume dries up significantly."
    )

    # 10. Chart candles (last 100)
    chart_candles = get_candles_for_chart(candles, limit=100)

    # Setup type label — override with strategy name if it fully matched
    setup_type = setup["setup_type"]
    if strategy_result and strategy_result["matches"] and strategy_name:
        setup_type = strategy_name

    return {
        "symbol":       symbol.upper(),
        "timeframe":    timeframe,
        "market_bias":  bias,
        "setup_type":   setup_type,
        "entry_condition": setup["entry_condition"],
        "entry_zone":   trade["entry_zone"],
        "stop_loss":    trade["stop_loss"],
        "target1":      trade["target1"],
        "target2":      trade["target2"],
        "risk_reward":  trade["risk_reward"],
        "position_size": trade["position_size"],
        "confidence_score": conf,
        "rules_passed": rules_passed,
        "rules_failed": rules_failed,
        "theory_references": [],   # LangGraph agent populates this
        "reasoning":    reasoning,
        "invalidation_condition": invalidation,
        "risk_warning": RISK_WARNING,
        "indicators":   {k: v for k, v in ind.items()},
        "candles":      chart_candles,
        "strategy_result": strategy_result,
        # Approach 1: Signal validation (mini-backtest of this setup)
        "validation":   validation,
        # Approach 2: Multi-timeframe confluence
        "mtf_confluence": mtf_confluence,
    }
