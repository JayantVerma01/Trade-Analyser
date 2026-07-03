# Module 09 — The Recommendation Engine

The Recommendations page lets you scan a sector, custom shortlist, or the
entire NSE+BSE liquid universe (~280 stocks) and get ranked top-N. This module
covers exactly how that ranking is produced.

## Files involved

```
backend-python/app/services/
├── stock_universe.py           # 20 sectors × ~280 symbols; helpers to flatten
├── recommendation_service.py   # main entry: get_recommendations()
└── analysis_service.py         # each stock's analysis (re-used from Module 08)

backend-python/app/routers/
└── recommendations.py           # /ai/recommendations/scan, /search, /sectors
```

## The user's mental model

The user wants: **"Show me the best setups right now."**

They tune three things:
- **Scope** — a specific sector, a custom list, or the whole market.
- **Trading style** — intraday / swing / positional (which chooses the timeframe: 15m / 1h / 1d).
- **Top N** — how many results.

Everything else is chosen automatically.

## The pipeline

```
Client → POST /ai/recommendations/scan {trading_style, sector?, symbols?, ...}
             │
             ▼
   get_recommendations() in recommendation_service.py
             │
             │ 1. Resolve the universe
             │      • symbols provided?    → use them (scope = "custom")
             │      • sector provided?     → use SECTORS[sector] (scope = "sector")
             │      • else                 → all_symbols() (scope = "market")
             │
             │ 2. Create asyncio.Semaphore(MAX_CONCURRENCY=20)
             │
             │ 3. Launch _analyse_one(sym) for every sym in the universe
             │    (all coroutines start immediately, but only 20 run at once)
             │
             │ 4. asyncio.gather() awaits all of them
             │
             │ 5. Drop None results (skipped stocks)
             │
             │ 6. Sort by recommendation_score DESC
             │
             │ 7. Return top_n with ranks 1..N
             ▼
   Response: { total_scanned, total_qualified, recommendations, ...}
```

## Step 1 — Resolve the universe

`stock_universe.py` holds the master list. Structure:

```python
SECTORS = {
    "IT & Software": ["TCS", "INFY", "WIPRO", ...],
    "PSU Banks":     ["SBIN", "PNB", ...],
    ...
    "Indices":       ["NIFTY50", "BANKNIFTY", ...],
}

def all_symbols() -> List[str]:
    # flatten every sector, deduplicate, return sorted
    ...
```

`get_recommendations()` picks its universe by priority:
1. `symbols=[...]` explicit list wins.
2. Else if `sector="IT & Software"`, use `SECTORS[sector]`.
3. Else scan the whole market.

## Step 2-3 — The parallel scan

```python
semaphore = asyncio.Semaphore(MAX_CONCURRENCY)   # = 20

async def _analyse_one(sym, ...):
    async with semaphore:                        # limit concurrent scans
        result = await asyncio.wait_for(
            loop.run_in_executor(None, run_analysis, sym, timeframe, ...),
            timeout=PER_STOCK_TIMEOUT,           # = 12 sec
        )
        # filter Sideways and low-confidence
        if result["market_bias"] == "Sideways" or result["confidence_score"] < 45:
            return None
        return _build_recommendation(result)

tasks   = [_analyse_one(s, ...) for s in universe]
results = await asyncio.gather(*tasks)
```

Two techniques worth understanding:

### `run_in_executor` — running sync code without blocking

`run_analysis()` is a normal (synchronous) function — it does pure math with
pandas. If we called it directly with `await`, we'd block the entire event
loop for a couple of seconds per stock.

`loop.run_in_executor(None, fn, *args)` sends the sync function to a **thread
pool**. The event loop stays responsive; other coroutines can make progress.
It's like `worker_threads` in Node but built into Python's stdlib.

### `Semaphore(20)` — bounded concurrency

Without this we'd launch 280 parallel analyses. Each spawns pandas computations
and (in a future real-data setup) API calls. That would exhaust memory and
rate limits.

`asyncio.Semaphore(20)` acts as a token bucket: at most 20 coroutines are
past the `async with semaphore:` line at any moment. The other 260 wait
politely. Same effect as `Promise.all` with a concurrency cap library like
`p-limit` in Node.

### `asyncio.wait_for(..., timeout=12)` — kill hangs

If one stock's analysis stalls (bug in a rare code path, network fluke), we
don't want the whole scan stuck. `wait_for` cancels the coroutine after 12s
and we log a warning + skip that stock.

## Step 4-6 — Score, filter, sort

Every survivor becomes a `recommendation dict` via `_build_recommendation()`.
The key field is `recommendation_score` (0-100), computed by
`_composite_score()`:

```python
def _composite_score(result):
    conf     = result["confidence_score"]            # 10..92
    conf_norm = (conf / 92.0) * 100                  # → 0..100

    mtf      = result["mtf_confluence"]
    mtf_norm = (mtf["confluence_score"] / 3.0) * 100

    val      = result["validation"]
    val_norm = val["hit_rate"] if val["is_validated"] else 50

    rr       = result["risk_reward"] or 0
    rr_norm  = min(rr / 3.0, 1.0) * 100

    return (
        conf_norm * 0.40 +   # 40% weight
        mtf_norm  * 0.30 +   # 30%
        val_norm  * 0.20 +   # 20%
        rr_norm   * 0.10     # 10%
    )
```

### Why these weights

- **Confidence (40%)** — this is our aggregate belief. Everything above already
  went into it, so it deserves the biggest slot.
- **MTF confluence (30%)** — an independent cross-check across timeframes. If
  MTF disagrees with confidence, we want that penalty visible.
- **Validation (20%)** — historical hit rate is powerful evidence but noisier
  than confidence.
- **R:R (10%)** — a small bonus for setups with better reward-to-risk.

The weights are tunable — change them and rerun. Track how top-5 changes.

## Step 7 — Rank and return

```python
valid.sort(key=lambda r: r["recommendation_score"], reverse=True)
top = valid[:top_n]
for i, rec in enumerate(top, 1):
    rec["rank"] = i
```

The frontend uses `rank` to render gold/silver/bronze badges for the top 3.

## Human-readable reasons — `_key_reasons()`

Alongside the numeric score we generate up to 4 short bullets like:

- "EMA21 Pullback setup confirmed on 1h chart"
- "Strong multi-timeframe confluence across 3 timeframes"
- "Historical hit rate 63% over 8 similar past setups"
- "Attractive risk/reward of 2.1:1"

These are extracted with simple if/else rules from the same analysis output.
No LLM — deterministic, cheap, always in sync with the numbers.

## The performance profile

- Whole market (280 stocks), semaphore 20, average 1s per stock  → ~14 seconds wall time.
- Sector (20 stocks) → ~2 seconds.
- Custom list of 5 stocks → sub-second.

Almost all time is spent in pandas indicator math, not I/O. When real market
data arrives, each stock adds one API call (~50ms) — still comfortable.

## The symbol search endpoint

```
GET /ai/recommendations/search?q=BANK&limit=12
→ {"query": "BANK", "matches": ["BANDHANBNK", "BANKBARODA", ...], "count": 10}
```

Simple substring match over `all_symbols()`. The UI's search-box uses this
with a 200ms debounce; typing "BANK" fires ONE request 200ms after you stop
typing.

## The sectors metadata endpoint

```
GET /ai/recommendations/sectors
→ { sectors: [...], sector_stocks: {"IT": 20, ...}, trading_styles: [...],
    style_timeframes: {"intraday": "15m", ...}, total_universe: 280 }
```

Used by the frontend to populate the sector tabs and count badges on first
load. No expensive computation — trivial O(1) lookups.

## Where it lives in the codebase

| File | Role |
|---|---|
| `stock_universe.py` | The symbol lists — edit here to add coverage. |
| `recommendation_service.py` | Scan orchestration, scoring, ranking. |
| `routers/recommendations.py` | HTTP endpoints. |
| Node: `services/ai.service.ts` | `scanRecommendations()`, `searchSymbolsForRecommendations()` |
| Node: `modules/recommendations/*.ts` | Route + controller |
| Frontend: `lib/api/recommendations.api.ts` | Axios calls |
| Frontend: `app/(dashboard)/recommendations/page.tsx` | Full UI |
| Frontend: `components/recommendations/StockRecommendationCard.tsx` | Individual card |

## Ideas for extension

- **Filters** — "only bullish", "min confidence 65", "min R:R 2".
- **Sector heatmap** — a grid of sectors coloured by average score.
- **Watchlist mode** — user's saved symbols as a persistent custom-list scope.
- **Compare view** — pick 3 recommendations, see them side by side with charts.
- **Alerts** — when a scan surfaces a stock with score > 85, push a notification.

Head to **[Module 10 — Vision Pipeline for PDFs](./10-vision-pipeline.md)**.
