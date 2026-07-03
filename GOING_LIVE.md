# Trade Analyser AI — Going Live with Real Markets

> **Hard safety rule (do not remove from MVP):**
> The system provides analysis, possible setups, risk-reward, entry zones, stop loss,
> targets, confidence scores, and explanations. **Live order placement must require
> explicit manual confirmation from the user — no autonomous execution.**

This document is your roadmap from the current mock-data MVP to a production system
trading real Indian stocks with a real broker. It is opinionated, step-ordered, and
written so you (or any engineer joining the project) can follow it without
re-deriving decisions.

---

## 0. Where You Are Today

| Layer | Current state | What it does |
|---|---|---|
| Market data | `MockMarketProvider` (deterministic GBM noise) | Generates synthetic OHLCV from `seed = symbol + timeframe`. |
| Analysis | `analysis_service.run_analysis()` | Real indicators (EMA/RSI/MACD/ATR/VWAP), setup detection, position sizing. |
| MTF confluence | `mtf_analysis.analyse_mtf_confluence()` | Real algorithm, but runs on mock candles. |
| Signal validation | `signal_validator.validate_signal()` | Real walk-forward hit-rate scan, runs on mock candles. |
| Recommendations | `recommendation_service` | Real composite scoring + ranking, runs on mock candles. |
| RAG (theory chat) | Real — pgvector + OpenAI embeddings | Already production-ready, including vision. |
| Broker | None | No order placement, no positions, no holdings. |
| Persistence | Postgres + MongoDB + pgvector | Schemas are real and stable. |

**Key insight:** every component that does meaningful work — indicators, scoring,
RAG, vision — is already production-grade. The only thing standing between you and
a live system is **the data feed and the broker connection**. Both plug into the
existing `BaseMarketProvider` abstract class (`backend-python/app/services/market_data/base_provider.py`).

---

## 1. The Five Stages from MVP to Live

Each stage is independently deployable. You can ship Stage 1 alone and have a
useful product for traders who want analysis. Stages 2-5 unlock progressively
more capability.

| Stage | What you add | Effort | Outcome |
|---|---|---|---|
| **1. Real historical data** | One historical OHLCV provider | 1-2 weeks | Recommendations and backtests reflect real markets. Theory chat unchanged. |
| **2. Real real-time quotes** | LTP + intraday candles via REST polling | 3-5 days | Analysis cards show live prices instead of synthetic. |
| **3. Real WebSocket feed** | Streaming ticks for selected symbols | 1 week | Watchlist updates in real time without polling. |
| **4. Broker integration (read-only)** | User connects their broker account; you read positions/holdings/orders | 1-2 weeks | Dashboard shows real P&L, holdings, open positions. **No order placement.** |
| **5. Confirmed order placement** | Place orders only after explicit user click + 2FA | 2-3 weeks | Trader reviews AI recommendation → confirms → broker API places order → audit log written. |

---

## 2. Stage 1 — Real Historical Market Data

### 2.1 Choose a provider

Compare the realistic options for Indian markets:

| Provider | Cost | Historical depth | Real-time | Pros | Cons |
|---|---|---|---|---|---|
| **Zerodha Kite Connect** | ₹2000/month/app | 2-5 years (paid: full) | Yes | Most reliable for retail in India; huge community; full F&O coverage. | App approval needed; user must have Zerodha account. |
| **Upstox API** | Free | 2 years | Yes | Free; modern REST + WebSocket. | User must have Upstox account; rate limits stricter. |
| **Dhan API** | Free | 5+ years | Yes | Free; good for algo traders; supports options chain. | Smaller ecosystem; fewer code examples. |
| **Angel One SmartAPI** | Free | 5+ years | Yes | Free; OAuth onboarding. | API quirky; documentation patchy. |
| **FYERS API** | Free | 5+ years | Yes | Free; advanced options data. | Smaller user base. |
| **NSE bhavcopy + EOD CSV** | Free | 20+ years | No (next-day) | Massive history; great for backtests. | Daily only — useless for intraday/swing. |
| **Alpha Vantage / TwelveData** | Freemium | Varies | Limited India | Easy to start. | Indian coverage spotty, often delayed. |

**Recommended starter stack:**

- **Backtests + historical pulls** → Use Dhan API (free, deep history) OR direct NSE bhavcopy for EOD.
- **Live / recent data + per-user execution** → Each user connects their own Zerodha/Upstox/Dhan account via OAuth. This shifts data costs to the user's existing broker subscription instead of you.

### 2.2 Implement a real provider

The abstract base is already in place:

```
backend-python/app/services/market_data/
  base_provider.py          ← unchanged
  mock_provider.py          ← keep — useful for tests
  dhan_provider.py          ← NEW, you write this
  __init__.py               ← update to switch active provider via env var
```

Skeleton — `dhan_provider.py`:

```python
import os, requests, time
from typing import List, Optional
from datetime import datetime, timedelta
from .base_provider import BaseMarketProvider, Candle, Quote, SymbolInfo


class DhanMarketProvider(BaseMarketProvider):
    """Dhan API v2 implementation."""

    BASE_URL = "https://api.dhan.co/v2"

    def __init__(self):
        self.access_token = os.environ["DHAN_ACCESS_TOKEN"]
        self.client_id    = os.environ["DHAN_CLIENT_ID"]
        self._headers = {
            "access-token": self.access_token,
            "client-id":    self.client_id,
            "Content-Type": "application/json",
        }
        # Cache the master symbol list — you'll need security_id for every call
        self._symbol_map = self._load_symbol_master()

    @property
    def provider_name(self) -> str:
        return "dhan"

    def get_candles(self, symbol, timeframe, limit=200, from_ts=None, to_ts=None) -> List[Candle]:
        sec = self._symbol_map.get(symbol.upper())
        if not sec:
            raise ValueError(f"Unknown symbol {symbol}")

        to_ts   = to_ts or int(time.time())
        from_ts = from_ts or to_ts - {"1m":3600, "15m":7*86400, "1h":60*86400, "1d":730*86400}[timeframe]

        response = requests.post(
            f"{self.BASE_URL}/charts/intraday" if timeframe != "1d" else f"{self.BASE_URL}/charts/historical",
            headers=self._headers,
            json={
                "securityId":    sec["security_id"],
                "exchangeSegment": sec["segment"],   # NSE_EQ, NSE_FNO, etc.
                "instrument":    sec["instrument"],   # EQUITY, OPTIDX, etc.
                "interval":      {"1m":"1","5m":"5","15m":"15","30m":"30","1h":"60","1d":"D"}[timeframe],
                "fromDate":      datetime.fromtimestamp(from_ts).strftime("%Y-%m-%d"),
                "toDate":        datetime.fromtimestamp(to_ts).strftime("%Y-%m-%d"),
            },
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()

        candles = []
        for i, ts in enumerate(data["timestamp"]):
            candles.append(Candle(
                time=ts,
                open=data["open"][i],
                high=data["high"][i],
                low=data["low"][i],
                close=data["close"][i],
                volume=data["volume"][i],
            ))
        return candles[-limit:]

    def get_quote(self, symbol) -> Quote:
        # Use Dhan's quote endpoint or compute from latest 1m candle
        ...

    def search_symbols(self, query) -> List[SymbolInfo]:
        # Filter self._symbol_map
        ...

    def _load_symbol_master(self):
        # Dhan publishes a CSV of all securities. Download once at startup.
        # Cache to local file with TTL = 24h.
        ...
```

### 2.3 Wire the provider selection through env

```python
# backend-python/app/services/market_data/__init__.py

import os
from .mock_provider import MockMarketProvider
from .dhan_provider import DhanMarketProvider
# from .zerodha_provider import ZerodhaMarketProvider   # add later

_provider_registry = {
    "mock":    MockMarketProvider,
    "dhan":    DhanMarketProvider,
    # "zerodha": ZerodhaMarketProvider,
}

def get_market_provider():
    name = os.getenv("MARKET_PROVIDER", "mock").lower()
    cls  = _provider_registry.get(name, MockMarketProvider)
    return cls()
```

Then every service that currently imports `MockMarketProvider` directly switches to:

```python
from app.services.market_data import get_market_provider
_provider = get_market_provider()
```

Files to update:
- `analysis_service.py`
- `signal_validator.py`
- `mtf_analysis.py`
- `backtest_engine.py`
- `agent/tools.py`

### 2.4 Add a caching layer

Real providers have **rate limits**. Dhan allows ~100 req/min; Zerodha ~3 req/sec.
Without caching, scanning 280 stocks for recommendations would hammer the API.

Use **Redis** as the cache:

```python
# backend-python/app/services/market_data/cache.py
import json, os, redis
r = redis.Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"))

CANDLE_TTL = {"1m": 60, "5m": 300, "15m": 900, "1h": 3600, "1d": 86400}

def get_cached_candles(symbol, timeframe):
    raw = r.get(f"candles:{symbol}:{timeframe}")
    return json.loads(raw) if raw else None

def set_cached_candles(symbol, timeframe, candles):
    ttl = CANDLE_TTL.get(timeframe, 900)
    r.setex(f"candles:{symbol}:{timeframe}", ttl, json.dumps([c.__dict__ for c in candles]))
```

Wrap your provider with cache calls. Add Redis to `docker-compose.yml`:

```yaml
redis:
  image: redis:7-alpine
  ports: ["6379:6379"]
  volumes: [redis_data:/data]
```

### 2.5 Quality checklist before flipping the switch

- [ ] Provider returns candles in chronological order (oldest first or newest first — pick one, document it).
- [ ] Timestamps are in UTC seconds, not milliseconds, not local time.
- [ ] Volume is the actual traded volume, not the lot count.
- [ ] You handle market-closed responses (no candles for today before 9:15 AM IST).
- [ ] You handle holidays. The NSE publishes the holiday list — hardcode it or fetch it.
- [ ] Symbol normalization: `RELIANCE` vs `RELIANCE-EQ` vs `NSE:RELIANCE` — pick a canonical form.
- [ ] Corporate actions: split-adjusted close vs raw close. Most APIs give adjusted by default; verify.

---

## 3. Stage 2 — Real-Time Quotes via REST

You don't need WebSockets yet to be useful. A 5-second polling loop is fine for
analysis cards.

Add an endpoint that the frontend can call every 5s while the analysis panel is open:

```python
# backend-python/app/routers/market.py — add this
@router.get("/quote/{symbol}/stream")
async def stream_quote(symbol: str):
    quote = _provider.get_quote(symbol)
    return {"symbol": symbol, "ltp": quote.ltp, "ts": int(time.time())}
```

Frontend hook (already idiomatic in your codebase):

```typescript
// Use SWR or just a setInterval in useEffect
const { data } = useSWR(
  `/api/market/quote/${symbol}/stream`,
  fetcher,
  { refreshInterval: 5000 }
);
```

**Rate limit warning:** if 100 users have 3 charts open each = 300 calls every 5s.
Your provider gives ~100/min. **Fix with a per-symbol fan-out cache** — only one
upstream call per symbol per 5s, fanned out to all subscribers from Redis.

---

## 4. Stage 3 — WebSocket Streaming

Once polling stops scaling, replace it with a proper streaming layer.

Architecture:

```
[Broker WebSocket] → [Python WebSocket consumer] → [Redis Pub/Sub] → [FastAPI WebSocket endpoints] → [browser]
```

Most Indian broker WebSockets:
- Authenticate with the same access token
- Use binary protocols (LTP every tick, occasional full quote)
- Limit ~3000 symbols per connection

For a multi-user app, you only need ONE upstream WebSocket per shared symbol pool —
not one per user. Subscribe to the union of all users' watchlists.

Implementation skeleton:

```python
# backend-python/app/services/realtime/tick_collector.py
import asyncio, json
from dhanhq import marketfeed   # or zerodha kiteconnect.ticker, etc.

class TickCollector:
    def __init__(self, redis_client):
        self.redis = redis_client
        self.subscriptions: set[str] = set()
        self.feed = marketfeed.DhanFeed(...)

    async def subscribe(self, symbol: str):
        if symbol not in self.subscriptions:
            self.subscriptions.add(symbol)
            await self.feed.subscribe([symbol])

    async def run(self):
        async for tick in self.feed.iter_ticks():
            await self.redis.publish(f"ticks:{tick.symbol}", json.dumps(tick.__dict__))
```

Browser side: open `wss://your-domain/ws/ticks?symbols=RELIANCE,TCS` — your FastAPI
endpoint reads from Redis and forwards. **One WS per browser tab, not per chart.**

Skip this stage entirely if you're under 100 concurrent users — polling is fine.

---

## 5. Stage 4 — Broker Integration (Read-Only)

Read user holdings, positions, orders, and account balance. **No writes yet.**

### 5.1 OAuth flow

Every Indian broker uses OAuth 2.0 with a similar pattern:

1. You register your app with the broker → get `api_key` + `api_secret`.
2. User clicks "Connect Zerodha" in your frontend.
3. Redirect to `https://kite.zerodha.com/connect/login?api_key=...`.
4. User logs in on broker's domain, approves your app.
5. Broker redirects back to `your-domain/broker/zerodha/callback?request_token=...`.
6. Your backend exchanges `request_token` + `api_secret` → `access_token`.
7. Store `access_token` encrypted in `broker_connections` table.

You already have a `BrokerConnection` model in Prisma — verify it has fields for
`provider`, `access_token` (encrypted), `refresh_token` (if applicable), and
`expires_at`.

### 5.2 Token encryption

**Never store broker access tokens in plaintext.** Use a per-user envelope:

```python
from cryptography.fernet import Fernet
KEY = os.environ["BROKER_TOKEN_ENCRYPTION_KEY"]   # 32-byte base64 key
cipher = Fernet(KEY)

def encrypt_token(token: str) -> str:
    return cipher.encrypt(token.encode()).decode()

def decrypt_token(blob: str) -> str:
    return cipher.decrypt(blob.encode()).decode()
```

Generate `BROKER_TOKEN_ENCRYPTION_KEY` once: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`.
Store in `.env` and (for production) AWS Secrets Manager / GCP Secret Manager.

### 5.3 Implement the existing `broker.py` router

Your `app/routers/broker.py` is already scaffolded for `get_broker_account`,
`get_broker_positions`, `get_broker_orders`, `get_broker_holdings`. Currently
those proxy to placeholder data. Replace with real calls:

```python
@router.get("/positions")
async def get_positions(user_id: str = Depends(...)):
    conn = await get_active_broker_connection(user_id)
    if conn.provider == "zerodha":
        kite = KiteConnect(api_key=conn.api_key)
        kite.set_access_token(decrypt_token(conn.access_token))
        return kite.positions()["net"]
    elif conn.provider == "dhan":
        ...
```

### 5.4 Token refresh

Zerodha tokens expire at end-of-day. Schedule a daily cron at 6 AM IST to mark
expired connections as `needs_reauth` so the UI prompts the user to reconnect.

---

## 6. Stage 5 — Confirmed Order Placement

This is the line you must not cross without explicit user action **every single time**.

### 6.1 The mandatory confirmation flow

```
User sees AI recommendation
    │
    ▼
Clicks "Review Trade"
    │
    ▼
Modal shows: symbol, qty, entry, SL, T1, T2, R:R, broker, estimated cost
    │
    ▼
User types the SYMBOL into a confirm box (defeats accidental clicks)
    │
    ▼
User clicks "Place Order" — frontend POSTs to /api/broker/orders/place
    │
    ▼
Backend re-validates: confidence still high? price hasn't moved >2%?
    │
    ▼
Backend writes "PENDING" row to orders table with full snapshot
    │
    ▼
Backend calls broker API → gets order_id
    │
    ▼
Backend writes audit log: who, when, why, payload, response
    │
    ▼
Frontend shows order_id + "View on broker terminal"
```

**Hard rules — code these as invariants:**

- Every order MUST have a row in your `orders` table BEFORE the broker call.
- Every order MUST have a row in `audit_logs` AFTER the broker call (success or failure).
- The system MUST NEVER place an order without a user-action HTTP request in the same call chain. No cron job, no background worker, no agent loop is allowed to call the order-placement function. Enforce this with a `request_context` check.
- Order placement requires re-authentication if the broker token is >4 hours old.

### 6.2 Position-sizing safety net

Before sending to broker, double-check:

```python
def safety_check(order, user_settings):
    # Max % of capital per trade
    if order.value > user_settings.capital * user_settings.max_per_trade_pct:
        raise UserError("Position size exceeds your max-per-trade limit")

    # Max % daily loss already hit?
    daily_pnl = await get_today_pnl(user)
    if abs(daily_pnl) > user_settings.capital * user_settings.max_daily_loss_pct:
        raise UserError("Daily loss limit reached — no more trades today")

    # Margin available at broker
    margin = await broker.get_available_margin()
    if order.required_margin > margin * 0.9:   # 10% buffer
        raise UserError("Insufficient broker margin")
```

These checks happen BOTH in the frontend (for UX) AND backend (for security).
**Never trust the frontend.**

### 6.3 Audit log schema

```prisma
model OrderAuditLog {
  id           String   @id @default(cuid())
  userId       String
  orderId      String?  // null if order rejected before broker call
  action       String   // "PLACE_ORDER", "CANCEL_ORDER", "MODIFY_ORDER"
  recommendationId String?  // ties back to the AI suggestion
  payload      Json     // exact request sent to broker
  response     Json     // exact response received
  ipAddress    String
  userAgent    String
  outcome      String   // "SUCCESS", "BROKER_REJECTED", "VALIDATION_FAILED"
  createdAt    DateTime @default(now())
}
```

Retain audit logs for **7 years** (SEBI requirement for trading systems).

---

## 7. Production Deployment

### 7.1 Hosting recommendation

For a startup-scale Indian app:

| Component | Hosting | Cost/month (~) |
|---|---|---|
| Python backend | Railway / Render / AWS ECS Fargate | ₹2000-5000 |
| Node backend | Same as above | ₹2000-5000 |
| Frontend | Vercel / Netlify | Free tier OK initially |
| Postgres + pgvector | Neon / Supabase / AWS RDS | ₹2000-8000 |
| MongoDB | Atlas free tier → M10 (₹5000) | Free → ₹5000 |
| Redis | Upstash / Railway add-on | Free → ₹1000 |
| Object storage (PDFs) | Cloudflare R2 / AWS S3 | ₹500 |
| Domain + SSL | Cloudflare | Free |
| **Total starter** | | **~₹6000-10000/month** |

Self-hosted on a single AWS Lightsail / DigitalOcean droplet (4GB RAM, 2 vCPU)
for ₹2500/month is also viable for <50 users.

### 7.2 Environment-specific configs

```
.env.development    ← local mocks, OpenAI test key
.env.staging        ← real provider, throwaway OpenAI key, separate DB
.env.production     ← real provider, real OpenAI key, real DB, encrypted secrets
```

Never commit any of these. Use a secrets manager:
- AWS: Secrets Manager + IAM roles
- GCP: Secret Manager
- Self-hosted: doppler.com or sops + git-crypt

### 7.3 Process management

Don't run `uvicorn --reload` in production. Use:

```bash
uvicorn app.main:app --workers 4 --host 0.0.0.0 --port 8000
# OR
gunicorn app.main:app -k uvicorn.workers.UvicornWorker --workers 4
```

Behind nginx for SSL termination, gzip, and rate limiting. Your existing
`docker/nginx/nginx.conf` is a starting point; add:

```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
location /api/ {
    limit_req zone=api burst=20 nodelay;
    proxy_pass http://backend-node:3001;
}
```

### 7.4 Observability — non-negotiable for a money-handling app

- **Logs**: ship to CloudWatch / Loki / Datadog. Structured JSON, never plain text.
- **Errors**: Sentry (free tier covers most startups). Both Python and Node SDKs are 5 lines to add.
- **Metrics**: Prometheus + Grafana. Track: order success rate, broker API latency, OpenAI cost per user, recommendation scan time.
- **Alerts**: page yourself on:
  - Any broker order failure
  - OpenAI 429 / 500 rate
  - DB connection pool exhaustion
  - Anyone calling `/api/broker/orders/place` >10x/min (probable bug or abuse)

### 7.5 Backup strategy

- Postgres: daily snapshot to S3, 30-day retention. Test restoration monthly.
- pgvector chunks are large; back up separately at lower frequency (weekly).
- MongoDB chat logs: weekly, 90-day retention.
- Uploaded PDFs in object storage: enable versioning + lifecycle to Glacier after 90 days.

---

## 8. Compliance & Regulatory (India-Specific)

### 8.1 What you ARE — what you are NOT

You're building an **analysis tool with optional execution shortcuts**, not a
broker. As long as:

- You don't take custody of client funds
- You don't hold client securities
- You only route orders through the user's own broker account
- You make the user click "confirm" for every order

…you're outside SEBI's broker registration scope. **But you ARE inside the
"Research Analyst" scope** if you publish stock recommendations to the public.

### 8.2 SEBI Research Analyst (RA) registration

Required if you publicly recommend buying/selling specific stocks. **Required for**
public recommendations, public scans, "top picks" pages visible to non-users.

**Not required for** purely personal/private analysis tools where the user
analyses stocks for themselves.

Borderline cases (treat conservatively):
- Sharing a recommendation in a public chat → likely needs RA
- Multiple users seeing the same "top 5 stocks" list → likely needs RA
- Each user seeing personalised analysis they configured → likely OK

RA registration: ~₹10000 application fee, NISM-XV exam (~₹1500), 2-year postgrad
qualification or 5-year experience. Annual fee ~₹5000.

### 8.3 Mandatory disclosures

Every recommendation card must show:

> "This is analysis only, not investment advice. Past performance does not
> guarantee future returns. The analyser, its operators, and their associates
> may or may not hold positions in the discussed securities. Stock market
> investments are subject to market risk. Read all related documents carefully
> before investing."

Your existing `risk_warning` field in `TradeSetupOutput` already covers the
text — make sure it actually renders on every recommendation card and PDF
export.

### 8.4 KYC

If you collect any money from users (subscription fees etc.) you don't need
KYC. If you ever take custody of trade settlement funds, you become a payment
operator and need RBI authorization — **don't go there**. Keep money flow
strictly: user → their broker → market. You never touch user funds.

### 8.5 Data residency

SEBI's CSCRF requires Indian market data + Indian user PII to be **stored in
India**. Pick AWS Mumbai (`ap-south-1`), GCP Mumbai (`asia-south1`), or
Indian providers (E2E Networks, ZNetLive). Vercel/Neon have Mumbai regions.

---

## 9. Operational Concerns

### 9.1 Market hours

NSE/BSE: 9:15 AM – 3:30 PM IST, Mon-Fri, except holidays.

Your scheduled jobs must respect this. Don't try to fetch intraday data at 2 AM —
the provider will return empty arrays, and your code should handle that gracefully.

Pre-market (9:00-9:15) and post-market (3:30-4:00) sessions exist for some
segments — usually ignore them.

### 9.2 Holidays

Hardcode the NSE holiday list each January:

```python
NSE_HOLIDAYS_2026 = {"2026-01-26", "2026-03-14", "2026-03-25", ...}

def is_market_open(now=None):
    now = now or datetime.now(IST)
    if now.weekday() >= 5:                 return False   # weekend
    if now.strftime("%Y-%m-%d") in NSE_HOLIDAYS_2026: return False
    return time(9, 15) <= now.time() <= time(15, 30)
```

### 9.3 Corporate actions

Splits, bonuses, dividends, mergers — these break naive price comparisons.
Most APIs return **split-adjusted** historical prices by default. **Verify.**

A 1:5 split on Reliance would make your "Reliance broke 3000 resistance!" alert
trigger on every old chart if your data isn't adjusted.

### 9.4 Data quality monitoring

Add a daily check:

```python
async def data_quality_check():
    for sym in ["RELIANCE", "TCS", "NIFTY50"]:
        candles = provider.get_candles(sym, "1d", limit=2)
        if not candles or candles[-1].time < yesterday_ts:
            alert(f"Stale data for {sym}")
        if candles[-1].close <= 0 or candles[-1].volume < 0:
            alert(f"Invalid data for {sym}")
```

Run at 4 PM IST after market close.

---

## 10. Cost Modeling

### 10.1 Variable costs per active user per month

| Item | Volume assumption | Cost |
|---|---|---|
| OpenAI embeddings (uploads) | 500 chunks × $0.02/1M tokens | ₹0.10 |
| OpenAI vision (uploads) | 50 images × $0.00015 | ₹0.60 |
| OpenAI chat (theory chat) | 30 turns × ~$0.001 | ₹2.50 |
| OpenAI chat (analysis explainer) | 20 setups × ~$0.0005 | ₹0.80 |
| OpenAI agent (trade query) | 10 queries × ~$0.005 | ₹4.00 |
| Tavily web search | 20 searches × $0.001 | ₹1.60 |
| Broker data | ₹0 (user's own broker) | ₹0.00 |
| Database storage | ~5MB/user | ₹0.05 |
| Bandwidth | ~50MB/user | ₹0.10 |
| **Total variable** | | **~₹10/active user/month** |

At ₹500/month subscription, gross margin ~98% on AI costs.

### 10.2 Fixed monthly costs

| Item | Cost |
|---|---|
| Hosting (per Section 7.1 starter) | ₹6000-10000 |
| Domain + email | ₹500 |
| Sentry (paid tier when you grow) | ₹2000 |
| Monitoring (Grafana Cloud free → paid) | Free → ₹2000 |
| Legal review (one-time) | ₹50000 |
| RA registration (one-time if needed) | ₹15000 |

**Break-even at ~20 paying users.**

---

## 11. Realistic Timeline

A solo developer working ~20 hours/week:

| Milestone | Cumulative weeks | Notes |
|---|---|---|
| Stage 1 (real historical, one provider) | +3 | Most of the work is symbol master + caching. |
| Stage 2 (REST polling for quotes) | +1 | Trivial after Stage 1. |
| Stage 3 (WebSocket) | +3 | Skip until you have >100 concurrent users. |
| Stage 4 (broker read-only) | +2 | OAuth + token encryption + the four read endpoints. |
| Stage 5 (confirmed orders) | +4 | Most of this is the safety scaffolding, not the broker call. |
| Production deployment + monitoring | +2 | Hosting, secrets, Sentry, backup, nginx, SSL. |
| Compliance polish (disclosures, terms, privacy policy) | +2 | Hire a lawyer for ₹20-50k to draft the docs. |
| Beta with 10-20 friendly users | +4 | This is where bugs surface. Plan for it. |
| **Public launch** | **~21 weeks** | **~5 months** from today, conservative. |

Aggressive solo dev or 2-person team: cut to 10-12 weeks.

---

## 12. The First Real-Trade Test — Step by Step

Once Stage 5 is built:

1. **You** open an account with your chosen broker (Zerodha recommended).
2. Fund it with ₹10,000 — money you can afford to lose.
3. Set `max_per_trade_pct = 2`, `max_daily_loss_pct = 3`, `max_trades_per_day = 1`.
4. Set `position_size_override = 1 share` for the first week — force the system
   to suggest 1-share trades regardless of math.
5. Connect your broker via the OAuth flow.
6. Open the Recommendations page. Run a scan.
7. Pick the top-ranked Bullish setup with confidence >70 and confluence "Strong".
8. Click "Review Trade" → confirm the modal → place the order.
9. Check the broker terminal in another tab — the order should appear with the
   exact same SL/T1 you saw in the AI card.
10. Take a screenshot of the audit log row.
11. Hold until SL or T1 hits. Don't intervene.
12. Repeat 10 times over 2 weeks, 1 share at a time.
13. If 6+ out of 10 trades hit T1 or break even, scale up to 5 shares.
14. **Never let the AI scale up on its own.** You decide every increase.

This is the **soft launch**. Don't open it to users until your own first 50
real trades show the system behaves as expected.

---

## 13. What to Build BEFORE Going Live (Beyond the 5 Stages)

These are non-negotiable hardening tasks that don't fit cleanly into the stages
but block production:

- [ ] Password reset flow (currently missing)
- [ ] Email verification on signup
- [ ] 2FA for broker-connected accounts (TOTP via Google Authenticator)
- [ ] Soft delete for `theory_documents` so users can recover deletions
- [ ] Rate limiting on `/api/auth/login` (you have global but not per-route)
- [ ] CSRF protection (relevant once you have non-API form submissions)
- [ ] User-facing settings page to manage broker connections, see API quotas
- [ ] Privacy policy + terms of service drafted by a lawyer
- [ ] Cookie consent banner if serving EU users (skip if India-only)
- [ ] Onboarding flow (currently lands on empty dashboard)
- [ ] Pricing page + Razorpay/Stripe subscription integration
- [ ] Help docs / FAQ

---

## 14. What NOT to Build (Resist the Temptation)

- **Autonomous trading bots** — outside the safety constraint. Don't.
- **Margin/leverage advice** — high regulatory risk, easy to lose users' money.
- **Penny stock scanner** — illiquid stocks make your analysis unreliable.
- **Copy trading** — needs PMS license, separate regulatory regime.
- **Options strategies generator** — complex, easy to get wrong, high-loss potential.
  Add later, after equity flow is rock-solid.
- **Mobile app on day 1** — your responsive web works fine. Build native after PMF.

---

## 15. Quick Reference — File Locations

| Task | File to edit |
|---|---|
| Add a market data provider | `backend-python/app/services/market_data/<name>_provider.py` |
| Switch active provider | `backend-python/app/services/market_data/__init__.py` + `MARKET_PROVIDER` env var |
| Add broker integration | `backend-python/app/routers/broker.py` + `backend-node/src/modules/broker/` |
| Order placement endpoint | `backend-node/src/modules/broker/orders.controller.ts` (TO CREATE) |
| Audit logging | `backend-node/src/utils/audit.ts` (TO CREATE) |
| Real WebSocket tick collector | `backend-python/app/services/realtime/tick_collector.py` (TO CREATE) |
| Cache layer | `backend-python/app/services/market_data/cache.py` (TO CREATE) |
| Holiday calendar | `backend-python/app/services/market_calendar.py` (TO CREATE) |
| Confirmation modal | `frontend/components/broker/OrderConfirmModal.tsx` (TO CREATE) |

---

## 16. One Final Reminder

Re-read the top of this document. The hard safety rule has not changed and
will not change. Everything in this guide assumes you keep humans in the loop
for execution. If a future feature pressures that rule, the answer is no.

The system's value comes from being *trustworthy* — a tool a serious trader
uses to think faster, not a bot that trades for them. That positioning protects
you legally, ethically, and commercially.

Build for the trader who already knows what they're doing and wants leverage,
not for the beginner who wants to be told what to buy.
