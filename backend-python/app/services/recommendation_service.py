"""
Stock Recommendation Engine.

Modes:
  • sector="IT & Software"  → scan ~20 stocks within that sector
  • sector=None             → scan the full NSE+BSE liquid universe (~280 stocks)
  • symbols=[...]           → scan a custom shortlist (e.g. user search results)

Pipeline per stock:
  1. Run analysis_service (indicators + setup detection + RR + position sizing)
  2. MTF confluence across 3 timeframes
  3. Signal validation against historical bars (hit rate)
  4. Composite score 0-100, sorted descending
  5. Top-N returned with full structured rationale

Composite score weights:
  40% — confidence_score
  30% — MTF confluence
  20% — validated hit rate (fallback 50 when unverified)
  10% — risk:reward (capped at 3:1)

Concurrency:
  The full universe scan would overwhelm the event loop if launched all at once.
  We use an asyncio.Semaphore(MAX_CONCURRENCY) so at most N analyses run in
  parallel — keeps memory bounded and total wall time predictable.
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.services.analysis_service import run_analysis
from app.services.stock_universe import (
    SECTORS,
    all_symbols,
    sector_count,
    symbols_for_sector,
    total_universe_size,
)

logger = logging.getLogger(__name__)


STYLE_TIMEFRAME: Dict[str, str] = {
    "intraday":   "15m",
    "swing":      "1h",
    "positional": "1d",
}

MIN_CONFIDENCE   = 45   # filter floor — below this isn't worth recommending
MAX_CONCURRENCY  = 5    # max stocks analysed in parallel (was 20 — Yahoo throttles above ~8)
PER_STOCK_TIMEOUT = 30  # seconds — abort outlier slow analyses (was 12s)

# Score weighting (must sum to 1.0)
W_CONFIDENCE = 0.40
W_MTF        = 0.30
W_VALIDATION = 0.20
W_RR         = 0.10


# ─── Scoring ──────────────────────────────────────────────────────────────────

def _composite_score(result: Dict[str, Any]) -> float:
    conf = result.get("confidence_score", 0)
    conf_norm = (conf / 92.0) * 100  # confidence is clamped to [10, 92]

    mtf = result.get("mtf_confluence") or {}
    mtf_norm = (mtf.get("confluence_score", 0) / 3.0) * 100

    validation = result.get("validation") or {}
    if validation.get("is_validated"):
        val_norm = float(validation.get("hit_rate", 50))
    else:
        val_norm = 50.0

    rr = result.get("risk_reward") or 0
    rr_norm = min(rr / 3.0, 1.0) * 100

    score = (
        conf_norm * W_CONFIDENCE
      + mtf_norm  * W_MTF
      + val_norm  * W_VALIDATION
      + rr_norm   * W_RR
    )
    return round(score, 1)


def _key_reasons(result: Dict[str, Any]) -> List[str]:
    reasons: List[str] = []
    bias    = result.get("market_bias", "")
    setup   = result.get("setup_type", "")
    tf      = result.get("timeframe", "")
    ind     = result.get("indicators") or {}

    if setup and tf:
        reasons.append(f"{setup} setup confirmed on {tf} chart")

    mtf = result.get("mtf_confluence") or {}
    if mtf.get("confluence_label") in ("Strong", "Moderate"):
        reasons.append(
            f"{mtf['confluence_label']} multi-timeframe confluence "
            f"across {mtf.get('total_tfs_analysed', 3)} timeframes"
        )

    validation = result.get("validation") or {}
    if validation.get("is_validated"):
        hr  = validation.get("hit_rate", 0)
        dec = validation.get("decided", 0)
        if hr >= 55:
            reasons.append(f"Historical hit rate {hr}% over {dec} similar past setups")

    rsi = ind.get("rsi", 0)
    if bias == "Bullish" and 45 <= rsi <= 65:
        reasons.append(f"RSI {rsi:.0f} — momentum zone, not overbought")
    elif bias == "Bearish" and 35 <= rsi <= 55:
        reasons.append(f"RSI {rsi:.0f} — bearish momentum, not oversold")

    vr = ind.get("volume_ratio", 0)
    if vr >= 1.3:
        reasons.append(f"Volume {vr:.1f}× average — institutional activity likely")

    rr = result.get("risk_reward") or 0
    if rr >= 2.0:
        reasons.append(f"Attractive risk/reward of {rr:.1f}:1")

    return reasons[:4]


def _build_recommendation(result: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "symbol":               result.get("symbol"),
        "recommendation_score": _composite_score(result),
        "bias":                 result.get("market_bias"),
        "setup_type":           result.get("setup_type"),
        "confidence_score":     result.get("confidence_score"),
        "entry_zone":           result.get("entry_zone"),
        "stop_loss":            result.get("stop_loss"),
        "target1":              result.get("target1"),
        "target2":              result.get("target2"),
        "risk_reward":          result.get("risk_reward"),
        "position_size":        result.get("position_size"),
        "analysis_timeframe":   result.get("timeframe"),
        "trading_style":        result.get("market_type") or result.get("trading_style"),
        "mtf_confluence":       result.get("mtf_confluence"),
        "validation":           result.get("validation"),
        "indicators":           result.get("indicators"),
        "entry_condition":      result.get("entry_condition"),
        "invalidation_condition": result.get("invalidation_condition"),
        "rules_passed":         (result.get("rules_passed") or [])[:5],
        "key_reasons":          _key_reasons(result),
    }


# ─── Per-stock worker ─────────────────────────────────────────────────────────

async def _analyse_one(
    symbol: str,
    timeframe: str,
    capital: float,
    risk_pct: float,
    trading_style: str,
    semaphore: asyncio.Semaphore,
) -> Optional[Dict[str, Any]]:
    """Acquire a semaphore slot, run analysis in a thread, filter low quality."""
    async with semaphore:
        try:
            loop = asyncio.get_event_loop()
            result = await asyncio.wait_for(
                loop.run_in_executor(
                    None, run_analysis,
                    symbol, timeframe, capital, risk_pct, trading_style,
                ),
                timeout=PER_STOCK_TIMEOUT,
            )

            bias = result.get("market_bias", "Sideways")
            conf = result.get("confidence_score", 0)

            if bias == "Sideways" or conf < MIN_CONFIDENCE:
                return None

            return _build_recommendation(result)

        except asyncio.TimeoutError:
            logger.warning(f"Recommendation scan: {symbol} timed out after {PER_STOCK_TIMEOUT}s")
            return None
        except Exception as exc:
            logger.warning(f"Recommendation scan: {symbol} skipped — {exc}")
            return None


# ─── Public API ───────────────────────────────────────────────────────────────

async def get_recommendations(
    trading_style: str,
    sector:    Optional[str]       = None,
    symbols:   Optional[List[str]] = None,
    capital:   float               = 100_000,
    risk_pct:  float               = 1.0,
    top_n:     int                 = 5,
) -> Dict[str, Any]:
    """
    Scan stocks → score → return top_n.

    Universe resolution priority (first non-empty wins):
      1. explicit `symbols` list
      2. `sector` lookup
      3. full liquid NSE+BSE universe (~280 stocks)
    """
    style = trading_style.lower().strip()
    if style not in STYLE_TIMEFRAME:
        raise ValueError(f"Unknown trading style '{style}'. Choose: intraday, swing, positional")
    timeframe = STYLE_TIMEFRAME[style]

    # Resolve the universe
    if symbols:
        universe = [s.upper().strip() for s in symbols if s.strip()]
        scope = "custom"
    elif sector:
        if sector not in SECTORS:
            raise ValueError(f"Unknown sector '{sector}'. Available: {list(SECTORS.keys())}")
        universe = symbols_for_sector(sector)
        scope = "sector"
    else:
        universe = all_symbols()
        scope = "market"

    if not universe:
        raise ValueError("Empty stock universe — provide symbols or pick a sector")

    logger.info(
        f"Recommendation scan: scope={scope} | universe={len(universe)} stocks "
        f"| style={style} | tf={timeframe} | max_concurrency={MAX_CONCURRENCY}"
    )
    started = datetime.now(timezone.utc)

    # Bulk pre-warm the provider cache with ONE Yahoo download for the whole
    # universe. Individual _analyse_one() calls then hit the cache instead of
    # hammering Yahoo per-symbol. Also fetch the two higher timeframes MTF
    # analysis will need, so nothing goes cold mid-scan.
    from app.services.market_data import get_market_provider
    from app.services.mtf_analysis import TF_HIERARCHY
    _prov = get_market_provider()
    if hasattr(_prov, "warm_cache") and len(universe) >= 8:
        loop = asyncio.get_event_loop()
        needed_tfs = {timeframe, *TF_HIERARCHY.get(timeframe, [])}
        for tf in needed_tfs:
            try:
                await asyncio.wait_for(
                    loop.run_in_executor(None, _prov.warm_cache, universe, tf),
                    timeout=90,
                )
            except asyncio.TimeoutError:
                logger.warning(f"warm_cache({tf}) exceeded 90s — proceeding with partial cache")

    semaphore = asyncio.Semaphore(MAX_CONCURRENCY)
    tasks = [
        _analyse_one(sym, timeframe, capital, risk_pct, style, semaphore)
        for sym in universe
    ]
    results = await asyncio.gather(*tasks)

    valid = [r for r in results if r is not None]
    valid.sort(key=lambda r: r["recommendation_score"], reverse=True)

    top = valid[:top_n]
    for i, rec in enumerate(top, 1):
        rec["rank"] = i

    elapsed = (datetime.now(timezone.utc) - started).total_seconds()
    logger.info(
        f"Recommendation scan done: scanned={len(universe)}, qualified={len(valid)}, "
        f"returned={len(top)}, elapsed={elapsed:.1f}s"
    )

    return {
        "scope":              scope,
        "sector":             sector,
        "trading_style":      trading_style,
        "analysis_timeframe": timeframe,
        "top_n_requested":    top_n,
        "total_scanned":      len(universe),
        "total_qualified":    len(valid),
        "recommendations":    top,
        "elapsed_seconds":    round(elapsed, 1),
        "generated_at":       datetime.now(timezone.utc).isoformat(),
    }


def list_sectors() -> Dict[str, Any]:
    return {
        "sectors":            list(SECTORS.keys()),
        "sector_stocks":      sector_count(),
        "trading_styles":     list(STYLE_TIMEFRAME.keys()),
        "style_timeframes":   STYLE_TIMEFRAME,
        "total_universe":     total_universe_size(),
    }


def search_symbols(query: str, limit: int = 20) -> List[str]:
    """Case-insensitive substring match over the full universe — for the search box."""
    if not query or not query.strip():
        return []
    q = query.upper().strip()
    matches = [s for s in all_symbols() if q in s]
    return matches[:limit]
