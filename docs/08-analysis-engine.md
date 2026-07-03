# Module 08 — The Analysis Engine

The `POST /ai/analysis/stock` endpoint is the beating heart of the product.
Given a symbol, timeframe, capital, and trading style, it returns a complete
trade setup: bias, entry, SL, targets, R:R, position size, confidence, and
rationale.

This module walks through every service file it touches.

## The pipeline in one picture

```
User → POST /ai/analysis/stock {symbol, timeframe, ...}
             │
             ▼
   run_analysis()  (analysis_service.py)
             │
             ├── 1. Get candles          → market_data/mock_provider.get_candles()
             ├── 2. Compute indicators   → indicator_service.compute_indicators()
             ├── 3. Detect market bias   → analysis_service._determine_bias()
             ├── 4. Detect setup type    → analysis_service._detect_setup()
             ├── 5. Calculate levels     → _calc_entry_sl_targets()
             ├── 6. Size the position    → _position_size()
             ├── 7. Score confidence     → _confidence_score()
             ├── 7a. MTF confluence      → mtf_analysis.analyse_mtf_confluence()
             ├── 7b. Signal validation   → signal_validator.validate_signal()
             ├── 8. Build rules list     → _build_rules_lists()
             └── 9. Return dict
```

Each numbered step is a small pure function. That makes the whole thing easy
to test and easy to reason about.

## 1. Market data — `market_data/mock_provider.py`

Today this is a **mock**. It generates deterministic synthetic candles from a
seeded RNG so `RELIANCE + 15m` always returns the same series. Real broker
providers plug in later — see `GOING_LIVE.md`.

The important interface (in `base_provider.py`):

```python
class BaseMarketProvider(ABC):
    @abstractmethod
    def get_candles(symbol, timeframe, limit=200, ...) -> List[Candle]: ...
    @abstractmethod
    def get_quote(symbol) -> Quote: ...
    @abstractmethod
    def search_symbols(query) -> List[SymbolInfo]: ...
```

`Candle` is a dataclass: `time (int), open, high, low, close, volume`. Newest
candle last.

## 2. Indicators — `indicator_service.py`

Uses **pandas-ta-classic** (`import pandas_ta_classic as ta`) — a library
that adds technical indicators as pandas methods.

Steps inside `compute_indicators()`:

1. Convert `List[Candle]` → pandas DataFrame with columns open/high/low/close/volume.
2. Compute each indicator:

| Indicator | What it measures | Our column |
|---|---|---|
| EMA9 / EMA21 / EMA50 | Exponential moving averages of price | `ema9`, `ema21`, `ema50` |
| RSI (14) | Momentum (0-100). >70 overbought, <30 oversold. | `rsi` |
| MACD (12, 26, 9) | Trend momentum. `macd_hist` is what we mostly use. | `macd_hist` |
| ATR (14) | Average True Range = volatility in price units. | `atr` |
| VWAP | Volume-weighted average price for the session. | `vwap` |
| Volume ratio | current volume / 20-period average. >1.3 means unusual. | `volume_ratio` |
| Support / Resistance | Recent swing highs and lows. | `support`, `resistance` |

3. Return the last row as a dict — that's the "current indicator snapshot."

### The one gotcha — causal vs future-leaking

If you compute `ema21` today, you use ALL 200 candles including today. That's
fine for the current snapshot. But if you want a **historical scan** (like
signal validation), you must recompute using ONLY the data available up to
that historical bar. Otherwise you leak future information into the past.

`signal_validator._build_scan_matrix()` and `backtest_engine` do this
carefully — see them later.

## 3. Market bias — `analysis_service._determine_bias()`

Given the current indicator snapshot, we vote:

```python
score = 0
if price > ema50: score += 1
if ema9 > ema21:  score += 1
if rsi > 55:      score += 1
if macd_hist > 0: score += 1
if price > vwap:  score += 1

if score >= 4: bias = "Bullish"
elif score <= 1: bias = "Bearish"
else: bias = "Sideways"
```

Simple and robust. "Sideways" analyses are dropped by the recommendation
engine because they don't have a directional edge.

## 4. Setup type — `_detect_setup()`

Given the bias, look for a specific pattern:

| Setup | Triggers when | Notes |
|---|---|---|
| `EMA21 Pullback` | Price is within 1×ATR of EMA21 in trend direction | Highest quality — trend continuation. |
| `VWAP Bounce` | Price is right above VWAP after pulling back to it | Intraday bread and butter. |
| `Breakout Retest` | `macd_hist > 0` and `volume_ratio > 1.0` | Momentum with volume confirmation. |
| `General <bias>` | Fallback when nothing more specific fits | Lower confidence. |

The setup name feeds into the `confidence_score` bonus later.

## 5. Entry / SL / Targets — `_calc_entry_sl_targets()`

All levels are anchored to **ATR** (volatility-scaled):

```python
entry_low  = price - atr * 0.3
entry_high = price + atr * 0.3
stop_loss  = price - atr * 1.5    (for Bullish)
target1    = price + atr * 1.5
target2    = price + atr * 3.0
```

For Bearish, invert. This guarantees setups adapt to each stock's own
volatility — a slow-mover gets tight levels; a volatile stock gets wide ones.

`risk_reward = (target1 - price) / (price - stop_loss)` — always ~1:1 for
target1, ~1:2 for target2 by construction.

## 6. Position size — `_position_size()`

```python
risk_per_share = |entry_price - stop_loss|
risk_capital   = capital * (risk_pct / 100)
shares         = int(risk_capital / risk_per_share)
```

If your ₹100,000 capital + 1% risk allows ₹1,000 of loss, and each share
risks ₹5 (ATR × 1.5), you can hold 200 shares. The card shows this number.

## 7. Confidence — `_confidence_score()`

Starts at 50 (neutral), applies bonuses/penalties:

```python
+ 15 if price > ema50 (bullish) or < (bearish)
+ 10 if ema9-ema21 spread favours the bias
+ 8  if RSI is in the momentum zone
+ 5  if MACD histogram supports the bias
+ 5  if volume_ratio > 1.3
+ 12 for named setups (Pullback, Bounce, Retest)
```

Then clamped to [10, 92]. The upper cap prevents "100% certain" bravado —
markets can always surprise.

### 7a. MTF confluence — `mtf_analysis.py`

We repeat the bias vote on TWO higher timeframes and score alignment:

```python
TF_HIERARCHY = {
    "1m":  ["5m", "15m"],
    "15m": ["1h", "4h"],
    "1h":  ["4h", "1d"],
    "1d":  ["1w", "1M"],
    ...
}
```

If the primary and both higher TFs agree, we call it **Strong confluence**
and add +12 to confidence. Conflicting = -10. See `_score_confluence()` for
the full table.

Why higher timeframes matter: a bullish 15-minute setup fighting a bearish
daily trend often gets stopped out. Confluence weeds those out.

### 7b. Signal validation — `signal_validator.py`

We take the current bias + setup type and scan the last 500 candles asking:
"When these same conditions appeared historically, what happened next 20 bars
later?"

For each historical match:
- Simulate an entry at the next bar's open.
- SL at entry ± ATR × 1.5.
- T1 at entry ∓ ATR × 1.5.
- Whichever fires first (SL vs T1 within 20 bars) is the outcome.

```python
hit_rate = wins / (wins + losses) * 100
```

If we found at least 5 decided trades and `hit_rate >= 60%`, +5 to confidence.
If `hit_rate < 45%`, −3. Otherwise no adjustment.

This is a **mini backtest embedded in every analysis**. It answers the
critical question: "does this setup actually work historically, or does it
just look good on paper?"

### Final confidence pipeline

```
base_confidence  (50)
    │
    + setup bonus                             → e.g. 60
    │
    + MTF confluence adjustment (+12/-10)     → e.g. 72
    │
    + validation adjustment (+5/-3)           → e.g. 77
    │
    → clamp to [10, 92]                       → final = 77
```

## 8. Rules passed / failed — `_build_rules_lists()`

Purely for **UX**: the frontend renders a checklist showing which criteria
were met (green ticks) and which were missed (red crosses). No effect on the
math — just transparency for the trader.

## 9. Return dict

The final response includes everything needed for the trade card:

```python
{
    "symbol": "RELIANCE",
    "timeframe": "15m",
    "market_bias": "Bullish",
    "setup_type": "EMA21 Pullback",
    "entry_zone": {"from": 2915.4, "to": 2927.6},
    "stop_loss": 2895.0,
    "target1": 2950.0,
    "target2": 2985.0,
    "risk_reward": 1.5,
    "position_size": 42,
    "confidence_score": 77,
    "rules_passed": [...],
    "rules_failed": [...],
    "entry_condition": "Enter long on...",
    "invalidation_condition": "Trade fails if...",
    "indicators": { "rsi": 58.2, "macd_hist": 0.12, ... },
    "mtf_confluence": { ... },       # full breakdown
    "validation": { ... },           # occurrences, hit_rate, etc.
}
```

The frontend's `TradeSetupCard.tsx` renders each piece.

## Backtest engine — one level deeper

For a full backtest (`POST /ai/backtest/run`), see
`backend-python/app/services/backtest_engine.py`. It uses the same causal
matrix approach as the validator but on a longer time series, tracking:

- Cumulative P&L curve
- Max drawdown
- Sharpe ratio
- Trade log with entry/exit for each simulated position

The frontend renders these on the Backtesting page.

## What's real vs mock

Every math function in this pipeline is production code. What's synthetic is
only the OHLCV data feeding it. Swap `MockMarketProvider` for a real
`DhanMarketProvider` (`GOING_LIVE.md`) and every card immediately reflects
real markets — no changes to any other file.

Head to **[Module 09 — The Recommendation Engine](./09-recommendation-engine.md)**.
