# Trade Analyser AI — Complete Product Documentation

> **Author:** Jayant Verma  
> **Last updated:** June 2026  
> **Status:** MVP complete (Phases 1–8) + Intelligence Layer (4 Approaches)

---

## Table of Contents

1. [What Is This Product?](#1-what-is-this-product)
2. [What It Does NOT Do](#2-what-it-does-not-do)
3. [Architecture Overview](#3-architecture-overview)
4. [Technology Stack](#4-technology-stack)
5. [Project Structure](#5-project-structure)
6. [Prerequisites](#6-prerequisites)
7. [Environment Variables Reference](#7-environment-variables-reference)
8. [Running with Docker (Recommended)](#8-running-with-docker-recommended)
9. [Running Locally (Without Docker)](#9-running-locally-without-docker)
10. [Database Setup & Migrations](#10-database-setup--migrations)
11. [Feature Walkthrough](#11-feature-walkthrough)
12. [All API Endpoints](#12-all-api-endpoints)
13. [How the AI Works](#13-how-the-ai-works)
14. [Strategy Rule Engine](#14-strategy-rule-engine)
15. [Backtesting Engine](#15-backtesting-engine)
16. [Paper Trading Lifecycle](#16-paper-trading-lifecycle)
17. [Broker Integration](#17-broker-integration)
18. [Security Model](#18-security-model)
19. [Configuration Tuning](#19-configuration-tuning)
20. [Troubleshooting](#20-troubleshooting)
21. [Enhancement Roadmap](#21-enhancement-roadmap)
22. [Production Deployment Guide](#22-production-deployment-guide)
23. [Frequently Asked Questions](#23-frequently-asked-questions)
24. [Intelligence Layer — 4 Approaches](#24-intelligence-layer--4-approaches)

---

## 1. What Is This Product?

**Trade Analyser AI** is a personal, AI-powered trading analysis platform built specifically for the **Indian Stock Market** (NSE/BSE — NIFTY, BANKNIFTY, equities).

It is a **decision-support tool**, not an auto-trading bot. Everything it produces is meant to help you think better about trades — never to execute them without you.

### Core Capabilities

| Capability | Description |
|---|---|
| **Stock Analysis** | AI analyses any symbol+timeframe and returns bias (bull/bear), entry zone, stop loss, T1/T2 targets, confidence score, indicator snapshot, rules checklist, and natural language reasoning |
| **Strategy Builder** | Visual rule editor — define custom strategies with indicator conditions, AND/OR logic, and test them instantly on any symbol |
| **Strategy Scanner** | Run your strategy across multiple symbols simultaneously and get a ranked shortlist |
| **AI Agent** | Natural language trading queries powered by LangGraph ReAct — asks questions, calls tools (analyse, search theory, get price), and synthesises a structured recommendation |
| **Theory Chat (RAG)** | Upload your trading books/PDFs → ask questions → get answers grounded in YOUR uploaded content via semantic search |
| **Backtesting** | Walk-forward simulation on 100–1,000 synthetic candles — win rate, profit factor, drawdown, equity curve, full trade log |
| **Paper Trading** | Open virtual trades (LONG/SHORT) with full lifecycle: Pending → Active → Close (Target/SL/Manual) → automatic journal entry |
| **Trade Journal** | Annotate every closed trade with emotion tags, mistake categories, lessons learned. Get aggregated statistics to improve your process |
| **Broker Dashboard** | Connect MockBroker (paper account simulation) or future real brokers — see account balance, margin, positions, orders, holdings |

---

## 2. What It Does NOT Do

- **No auto-trading.** The system never places orders automatically. Not now, not ever (by design).
- **No real broker orders.** The current MVP uses mock/simulated data. Live broker APIs (Zerodha Kite, Upstox, etc.) are placeholders.
- **No real-time live market data.** Market data uses a GBM + mean-reversion simulation (MockMarketProvider). Prices are deterministic per symbol+timeframe and change between runs.
- **No financial advice.** All analysis is for educational and analytical purposes only.

---

## 3. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                          BROWSER                                  │
│                    Next.js 14 App Router                          │
│         (Auth, Dashboard, Charts, Forms, AI outputs)              │
└──────────────────────┬───────────────────────────────────────────┘
                       │  HTTP (localhost:3000)
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                       NGINX (port 80)                             │
│   /api/* → Node.js :3001   /ai/* → Python :8000   / → Next :3000 │
└──────────┬──────────────────────────────┬────────────────────────┘
           │                              │
           ▼                              ▼
┌──────────────────┐          ┌───────────────────────────────────┐
│  Node.js/Express │          │   Python FastAPI (AI Service)     │
│     Port 3001    │          │        Port 8000                  │
│                  │          │                                   │
│  • Auth (JWT)    │  X-Internal-Secret  • RAG / pgvector        │
│  • CRUD (Prisma) │──────────▶  • Indicator engine (pandas-ta)  │
│  • File upload   │          │  • Strategy rule engine          │
│  • Proxies to    │          │  • LangGraph ReAct agent         │
│    Python for    │          │  • Backtest engine               │
│    AI ops        │          │  • MockMarketProvider (GBM)      │
└──────────┬───────┘          │  • MockBrokerProvider            │
           │                  └──────────────┬────────────────────┘
           │                                 │
           ▼                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL (port 5432)                         │
│         pgvector extension • All app data + embeddings           │
└─────────────────────────────────────────────────────────────────┘
           ▼
┌──────────────────┐
│   MongoDB        │   (Chat session logs — optional, can be removed)
│   Port 27017     │
└──────────────────┘
```

### Service Responsibilities

**Node.js (backend-node)** is the **trust boundary**. All browser requests go through it. It:
- Authenticates every request with JWT
- Owns the Prisma/PostgreSQL ORM layer (users, strategies, trades, journal, backtests)
- Calls Python for all AI operations, passing `X-Internal-Secret: JWT_SECRET` so Python rejects direct external calls
- Handles file uploads (PDFs for RAG)

**Python (backend-python)** is the **AI engine**. It:
- Never exposes itself directly to the browser (protected by the internal secret header)
- Runs pgvector-backed RAG over uploaded theory documents
- Computes 15+ technical indicators via pandas-ta
- Runs the strategy rule engine
- Runs the LangGraph ReAct agent (OpenAI gpt-4o-mini)
- Runs the backtesting walk-forward simulation
- Provides mock market and broker data

---

## 4. Technology Stack

### Frontend
| Library | Version | Purpose |
|---|---|---|
| Next.js | 14.2 | App Router, SSR/CSR hybrid |
| React | 18 | UI |
| Tailwind CSS | 3 | Styling |
| shadcn/ui + Radix UI | latest | Components (Button, Card, Badge, etc.) |
| TradingView Lightweight Charts | v4 | Candlestick + volume + indicators chart |
| Zustand | 4 | Auth state with localStorage persistence |
| Axios | 1.7 | HTTP client |
| React Markdown | 9 | Render AI reasoning as formatted markdown |
| Lucide React | 0.395 | Icons |

### Node.js Backend
| Library | Version | Purpose |
|---|---|---|
| Express | 4.19 | HTTP server |
| Prisma | 5.14 | ORM (PostgreSQL) |
| jsonwebtoken | 9 | JWT auth |
| bcryptjs | 2.4 | Password hashing |
| multer | 1.4 | File upload |
| zod | 3.23 | Request validation |
| winston | 3.13 | Structured logging |
| helmet | 7 | Security headers |
| cors | 2.8 | CORS policy |
| express-rate-limit | 7 | Rate limiting (200 req/15min global, 20 auth) |
| axios | 1.7 | Proxy calls to Python |
| morgan | 1.10 | HTTP request logging |

### Python Backend
| Library | Version | Purpose |
|---|---|---|
| FastAPI | 0.111 | Async HTTP server |
| uvicorn | 0.29 | ASGI server |
| LangChain | 0.2.5 | LLM orchestration, RAG chain |
| LangGraph | 0.2.14 | ReAct agent graph |
| langchain-openai | 0.1.13 | OpenAI integration |
| OpenAI | 1.35 | gpt-4o-mini for analysis+agent; text-embedding-3-small for RAG |
| pandas | 2.2 | Data manipulation |
| pandas-ta | 0.3.14b | 15+ technical indicators |
| numpy | 1.26 | Numerical ops |
| pgvector | 0.3.2 | Vector similarity search in PostgreSQL |
| SQLAlchemy | 2.0 | Async DB access for vectors |
| asyncpg | 0.29 | PostgreSQL async driver |
| pypdf | 4.2 | PDF text extraction |
| pydantic | 2.7 | Data models + settings |
| python-jose | 3.3 | JWT verification (shared secret) |
| tenacity | 8.4 | Retry logic |

### Infrastructure
| Tool | Purpose |
|---|---|
| Docker + Docker Compose | Full-stack containerisation |
| Nginx | Reverse proxy (port 80 → routes to services) |
| PostgreSQL 15 + pgvector | Primary database + vector store |
| MongoDB 7 | Chat session log storage |

---

## 5. Project Structure

```
trade-analyser/
├── docker-compose.yml          # Full-stack orchestration
├── Makefile                    # Developer shortcuts (make up, make db-migrate, etc.)
├── .env.example                # Copy to .env and fill in
├── taDocs.md                   # This file
│
├── docker/
│   ├── Dockerfile.node         # Node.js container
│   ├── Dockerfile.python       # Python container
│   ├── Dockerfile.frontend     # Next.js container
│   ├── nginx/nginx.conf        # Reverse proxy config
│   └── postgres/init.sql       # Enable pgvector + uuid-ossp
│
├── backend-node/
│   ├── src/
│   │   ├── index.ts            # Express app entry, route registration
│   │   ├── config/             # Environment config, database connection
│   │   ├── middleware/         # JWT auth, error handler
│   │   ├── utils/              # Logger (winston)
│   │   ├── services/
│   │   │   └── ai.service.ts   # Axios client to Python (all AI proxy methods)
│   │   └── modules/
│   │       ├── auth/           # Register, login, /me
│   │       ├── documents/      # PDF upload, processing trigger, list, delete
│   │       ├── chat/           # Theory chat proxy
│   │       ├── market/         # Market data proxy (candles, quote, symbols)
│   │       ├── analysis/       # Stock analysis proxy
│   │       ├── strategies/     # Strategy CRUD + evaluate/scan proxy
│   │       ├── agent/          # AI agent proxy + trade setup persistence
│   │       ├── backtest/       # Backtest run + CRUD
│   │       ├── paper-trades/   # Paper trade lifecycle
│   │       ├── journal/        # Trade journal CRUD + stats
│   │       └── broker/         # Broker connection CRUD + data proxy
│   └── prisma/
│       ├── schema.prisma       # Full database schema
│       └── migrations/         # SQL migration files
│
├── backend-python/
│   ├── requirements.txt
│   └── app/
│       ├── main.py             # FastAPI app, router registration
│       ├── config.py           # Pydantic settings
│       ├── middleware/
│       │   └── auth.py         # verify_internal_request (X-Internal-Secret guard)
│       ├── db/
│       │   └── postgres.py     # SQLAlchemy async setup, vector table creation
│       ├── routers/
│       │   ├── rag.py          # /ai/documents/*, /ai/chat/theory
│       │   ├── market.py       # /ai/market/*
│       │   ├── analysis.py     # /ai/analysis/stock
│       │   ├── strategy.py     # /ai/strategy/evaluate, scan, meta
│       │   ├── agent.py        # /ai/agent/trade-query
│       │   ├── backtest.py     # /ai/backtest/run
│       │   └── broker.py       # /ai/broker/*
│       └── services/
│           ├── market_data.py          # MockMarketProvider (GBM candles)
│           ├── indicator_engine.py     # pandas-ta indicator computation
│           ├── analysis_service.py     # Full stock analysis orchestrator
│           ├── strategy_engine.py      # Rule evaluation (AND/OR, operators)
│           ├── rag_service.py          # pgvector RAG (embed, retrieve, answer)
│           ├── agent/
│           │   ├── tools.py    # LangGraph tool factory (analyse, search, quote)
│           │   └── graph.py    # ReAct graph + system prompt
│           ├── backtest_engine.py      # Walk-forward backtest
│           └── broker/
│               └── mock_broker.py     # Deterministic paper account simulation
│
└── frontend/
    ├── app/
    │   ├── (auth)/             # Login, Register pages (no sidebar)
    │   └── (dashboard)/        # All authenticated pages
    │       ├── dashboard/      # Home — quick links + stats
    │       ├── analysis/       # Stock Analysis page
    │       ├── agent/          # AI Agent page
    │       ├── strategies/     # Strategy management
    │       ├── backtest/       # Backtesting
    │       ├── paper-trades/   # Paper Trading
    │       ├── journal/        # Trade Journal
    │       ├── chat/           # Theory Chat
    │       ├── documents/      # PDF upload
    │       ├── broker/         # Broker Integration
    │       └── settings/       # User settings
    ├── components/
    │   ├── shared/             # Sidebar, Header, auth guards
    │   ├── analysis/           # AnalysisForm, IndicatorPanel, TradeSetupCard
    │   ├── backtest/           # EquityCurve, BacktestResults
    │   ├── paper-trades/       # PaperTradeCard, OpenTradeForm
    │   ├── journal/            # JournalEntry
    │   ├── strategies/         # RuleBuilder, StrategyCard
    │   ├── agent/              # StepBadge
    │   └── ui/                 # shadcn components (Button, Card, Badge, etc.)
    └── lib/
        ├── api/                # Typed API clients for every domain
        │   ├── client.ts       # Axios base client (attaches JWT)
        │   ├── auth.api.ts
        │   ├── analysis.api.ts
        │   ├── strategy.api.ts
        │   ├── agent.api.ts
        │   ├── backtest.api.ts
        │   ├── paper-trade.api.ts
        │   ├── journal.api.ts
        │   └── broker.api.ts
        └── store/
            └── auth.store.ts   # Zustand auth store (persists to localStorage)
```

---

## 6. Prerequisites

### Required

| Tool | Min Version | Check |
|---|---|---|
| **Docker Desktop** | 4.x | `docker --version` |
| **Docker Compose** | v2 (built-in) | `docker compose version` |
| **OpenAI API Key** | — | Any tier with gpt-4o-mini + text-embedding-3-small access |

### Optional (for local development without Docker)

| Tool | Min Version | Check |
|---|---|---|
| Node.js | 20 LTS | `node --version` |
| npm | 10+ | `npm --version` |
| Python | 3.11 | `python --version` |
| pip | 23+ | `pip --version` |
| PostgreSQL | 15 with pgvector | `psql --version` |
| MongoDB | 7 | `mongod --version` |

---

## 7. Environment Variables Reference

Create a `.env` file in the project root by copying `.env.example`:

```bash
cp .env.example .env
```

Then fill in the required values:

### Required (must change)

| Variable | Example | Description |
|---|---|---|
| `OPENAI_API_KEY` | `sk-proj-abc...` | Your OpenAI API key. Used by Python for GPT + embeddings. |
| `JWT_SECRET` | `64-char random string` | Shared between Node.js and Python. **Change this before running.** Generate with: `openssl rand -hex 32` |

### Database

| Variable | Default | Description |
|---|---|---|
| `POSTGRES_USER` | `trade_user` | PostgreSQL username |
| `POSTGRES_PASSWORD` | `trade_pass` | PostgreSQL password — change for production |
| `POSTGRES_DB` | `trade_analyser` | Database name |
| `DATABASE_URL` | `postgresql://...` | Full connection string — auto-built from above in Docker |
| `MONGO_USER` | `mongo_user` | MongoDB username |
| `MONGO_PASSWORD` | `mongo_pass` | MongoDB password |
| `MONGODB_URI` | `mongodb://...` | MongoDB connection string |

### Node.js

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | Set to `production` in prod |
| `PORT` | `3001` | Node.js server port |
| `CLIENT_URL` | `http://localhost:3000` | CORS allowed origin |
| `PYTHON_SERVICE_URL` | `http://localhost:8000` | Python service URL (auto-set in Docker) |
| `JWT_EXPIRES_IN` | `7d` | Token expiry |
| `UPLOAD_DIR` | `./uploads` | File upload directory |
| `MAX_FILE_SIZE_MB` | `20` | Max PDF upload size |

### Python

| Variable | Default | Description |
|---|---|---|
| `OPENAI_MODEL` | `gpt-4o-mini` | GPT model for analysis + agent |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | Embedding model for RAG |
| `CHUNK_SIZE` | `1000` | Characters per RAG chunk |
| `CHUNK_OVERLAP` | `200` | Overlap between chunks |
| `RETRIEVAL_TOP_K` | `5` | Number of RAG chunks to retrieve per query |

### Frontend

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_NODE_API_URL` | `http://localhost:3001` | Node.js API base URL (exposed to browser) |
| `NEXT_PUBLIC_PYTHON_API_URL` | `http://localhost:8000` | Python API base URL (optional, not used directly by browser) |

---

## 8. Running with Docker (Recommended)

This is the **easiest way** to run the full stack. Everything — databases, all backends, frontend, Nginx — starts with one command.

### Step 1 — Copy and fill the env file

```bash
cp .env.example .env
# Edit .env and set OPENAI_API_KEY and JWT_SECRET
```

Generate a strong JWT secret:
```bash
# On Linux/Mac:
openssl rand -hex 32

# On Windows PowerShell:
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

### Step 2 — Start everything

```bash
docker compose up -d
# or with make:
make up
```

This starts (in dependency order):
1. **PostgreSQL** → waits for healthy
2. **MongoDB** → waits for healthy
3. **backend-python** → waits for postgres healthy
4. **backend-node** → waits for postgres + mongo healthy
5. **frontend** → waits for node + python healthy
6. **nginx** → waits for all services

### Step 3 — Run database migrations

On first run, apply the Prisma schema to PostgreSQL:

```bash
docker compose exec backend-node npx prisma migrate deploy
# or locally:
make db-migrate
```

> The `docker/postgres/init.sql` already creates the `pgvector` and `uuid-ossp` extensions automatically on first container boot.

### Step 4 — Open the app

| URL | Service |
|---|---|
| `http://localhost` | Full app via Nginx (recommended) |
| `http://localhost:3000` | Next.js frontend direct |
| `http://localhost:3001` | Node.js API direct |
| `http://localhost:8000` | Python AI service direct |
| `http://localhost:8000/docs` | FastAPI auto-generated API docs (Swagger UI) |

### Step 5 — Register your first account

Go to `http://localhost/register`, create an account, and log in.

### Useful Docker commands

```bash
# View logs
make logs
docker compose logs -f backend-node     # Node.js logs only
docker compose logs -f backend-python   # Python logs only

# Restart a single service
docker compose restart backend-node

# Shell into a container
docker compose exec backend-node sh
docker compose exec backend-python bash

# Stop everything
make down

# Stop and delete all data (volumes)
make clean
```

---

## 9. Running Locally (Without Docker)

This requires PostgreSQL and MongoDB installed locally. Useful for faster hot-reload development.

### PostgreSQL setup

```bash
# Install pgvector (Ubuntu/Debian)
sudo apt install postgresql-15-pgvector

# macOS with Homebrew
brew install pgvector

# Create DB
psql -U postgres -c "CREATE USER trade_user WITH PASSWORD 'trade_pass';"
psql -U postgres -c "CREATE DATABASE trade_analyser OWNER trade_user;"
psql -U postgres -d trade_analyser -c "CREATE EXTENSION IF NOT EXISTS vector;"
psql -U postgres -d trade_analyser -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
```

### Node.js backend

```bash
cd backend-node
cp ../.env.example .env          # or copy manually and fill values
npm ci
npx prisma migrate dev           # apply migrations
npx prisma generate              # generate Prisma client
npm run dev                      # starts on :3001 with hot reload
```

### Python backend

```bash
cd backend-python
python -m venv venv
# Linux/Mac:
source venv/bin/activate
# Windows PowerShell:
.\venv\Scripts\Activate.ps1

pip install -r requirements.txt
# Set env vars:
export OPENAI_API_KEY=sk-...
export DATABASE_URL=postgresql://trade_user:trade_pass@localhost:5432/trade_analyser
export JWT_SECRET=your_secret_here

uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm ci
# Create .env.local:
echo "NEXT_PUBLIC_NODE_API_URL=http://localhost:3001" > .env.local
npm run dev                      # starts on :3000
```

Now open `http://localhost:3000`.

---

## 10. Database Setup & Migrations

### Initial migration

```bash
# First time (creates all tables from schema.prisma):
cd backend-node
npx prisma migrate dev --name init

# Or in Docker:
docker compose exec backend-node npx prisma migrate dev --name init
```

### After schema changes

When you change `backend-node/prisma/schema.prisma`:

```bash
npx prisma migrate dev --name describe_your_change
# e.g.:
npx prisma migrate dev --name add_trade_direction
```

### Push without migration files (quick dev)

```bash
npx prisma db push
# or:
make db-push
```

### Phase 6 migration (TradeDirection enum)

Phase 6 added a `direction` field to the `paper_trades` table. The migration file is at:
`backend-node/prisma/migrations/20240601000000_add_trade_direction/migration.sql`

Run it with:
```bash
cd backend-node && npx prisma migrate deploy
```

### Prisma Studio (visual DB browser)

```bash
make db-studio
# or:
cd backend-node && npx prisma studio
# Opens at http://localhost:5555
```

---

## 11. Feature Walkthrough

### 11.1 Register & Login

- Go to `/register` → fill name, email, password
- JWT token is returned and stored in `localStorage` via Zustand
- All subsequent API calls attach `Authorization: Bearer <token>` automatically
- Token expires in 7 days (configurable via `JWT_EXPIRES_IN`)

### 11.2 Theory Documents (RAG)

**Purpose:** Upload your trading books/PDFs and ask questions about them. The AI answers using YOUR content, not generic training data.

**How to use:**
1. Go to **Documents** → click "Upload PDF"
2. Select your trading book (max 20MB by default)
3. Wait for status to show **Ready** (processing takes 5–30 sec per PDF)
4. Go to **Theory Chat** → ask any question

**Under the hood:**
- PDF is uploaded to `/app/uploads/` via multer
- Node.js calls Python `/ai/documents/process`
- Python extracts text with pypdf → splits into chunks (1000 chars, 200 overlap) → generates embeddings with `text-embedding-3-small` → stores in pgvector table
- Theory Chat queries: embed the question → cosine similarity search → top-5 chunks → GPT-4o-mini generates answer grounded in those chunks

### 11.3 Stock Analysis

**Purpose:** AI analyses a symbol and produces a structured trade setup.

**How to use:**
1. Go to **Stock Analysis**
2. Select symbol (quick-picks or type any NSE symbol)
3. Select timeframe (1m, 5m, 15m, 30m, 1h, 4h, 1d)
4. Enter capital and risk % (e.g., ₹1,00,000 with 1% = ₹1,000 risk per trade)
5. Optionally select a saved strategy to layer on top
6. Click **Analyse**

**Output includes:**
- Market bias (Bull/Bear/Neutral) with icon
- Confidence score (0–100) — affected by indicator alignment and strategy match
- Entry zone (low–high price range)
- Stop Loss price
- Target 1 (T1) and Target 2 (T2) prices
- Position size (number of shares/lots)
- Rules passed and rules failed (checklist)
- AI reasoning (markdown narrative)
- Theory references (if RAG finds relevant content)
- Strategy result (if strategy selected — shows which rules matched)
- Candlestick chart with EMA lines, volume, SL/T1/T2 price lines

### 11.4 Strategy Builder

**Purpose:** Define precise technical entry conditions and save them as reusable strategies.

**Built-in templates:**
- EMA Trend Follow (EMA9 above EMA21, RSI 45–65, price above EMA50)
- RSI Oversold Bounce (RSI below 35, price above VWAP, ATR > 10)
- VWAP Power Trend (price above VWAP, EMA9 above EMA21, volume_ratio > 1.5)

**Rule structure:**
```json
{
  "rules": [
    {
      "indicator": "rsi",
      "operator": "between",
      "value_min": 45,
      "value_max": 65
    },
    {
      "indicator": "ema_9",
      "operator": "above",
      "compare_to": "ema_21"
    }
  ],
  "logic": "AND",
  "min_rr": 1.5
}
```

**Available indicators:**
`close`, `ema_9`, `ema_21`, `ema_50`, `ema_200`, `sma_20`, `sma_50`, `sma_200`, `rsi`, `macd`, `macd_signal`, `macd_hist`, `atr`, `bb_upper`, `bb_middle`, `bb_lower`, `vwap`, `volume`, `volume_ratio`, `pdh`, `pdl`

**Available operators:**
- `above` — indicator > value or compare_to indicator
- `below` — indicator < value or compare_to indicator
- `between` — value_min ≤ indicator ≤ value_max
- `crossover` — indicator crossed above compare_to in last 3 bars
- `equal` — indicator == value (within 0.01%)

**Confidence bonus:** When a strategy fully matches (all rules pass in AND mode), the analysis confidence score gets up to +15 points.

### 11.5 AI Agent

**Purpose:** Ask natural language trading questions and get a structured recommendation.

**Example queries:**
- "Is RELIANCE looking bullish on the 15-minute chart? Suggest an entry."
- "What is BANKNIFTY doing on the 5-minute chart and is there a setup?"
- "Explain why the RSI divergence matters for NIFTY right now."
- "Give me a complete trade plan for HDFC Bank on the 1-hour chart."

**How it works (ReAct loop):**
1. You type a query + select symbol/timeframe/capital
2. LangGraph ReAct agent (`create_react_agent` from langgraph) runs
3. Agent has 3 tools: `analyse_stock`, `search_theory_documents`, `get_price_quote`
4. Agent decides which tools to call (always calls `analyse_stock` first per system prompt)
5. Runs up to 12 tool calls (recursion limit)
6. Synthesises a final recommendation in structured markdown

**Agent output:**
- Step-by-step tool execution trail (StepBadge components)
- Full AI recommendation (markdown)
- Candlestick chart (from analysis)
- Trade setup card (entry/SL/targets)

### 11.6 Backtesting

**Purpose:** Test how a strategy would have performed on historical (simulated) candles.

**How to use:**
1. Go to **Backtesting**
2. Select a saved strategy
3. Select symbol + timeframe
4. Set capital (₹) and risk %
5. Drag the candles slider (100–1,000 candles)
6. Click **Run Backtest**

**Metrics produced:**
- Net P&L (absolute + % return)
- Win Rate (with W/L/Timeout breakdown)
- Profit Factor (gross profit ÷ gross loss)
- Max Drawdown %
- Average R:R ratio
- Best / Worst individual trade
- Equity curve (SVG visual)
- Full trade log (entry/exit/SL/T1/P&L/result per trade)

**How the backtest works (no look-ahead bias):**
1. Fetch N candles from MockMarketProvider (GBM, deterministic seed)
2. Pre-compute full indicator matrix once (pandas-ta rolling → O(n), causal)
3. Walk-forward from bar `WARMUP=55` onwards
4. At each bar: evaluate strategy rules on `indicators[i]` (only past data)
5. On signal: enter at `candles[i+1].open` (next bar's open — no look-ahead)
6. Track trade: exit when intracandle high/low hits SL or T1, or after 20 bars (timeout)
7. Aggregate metrics and return

### 11.7 Paper Trading

**Purpose:** Simulate real trades without risking money. Full lifecycle tracking.

**Trade states:**
```
PENDING → (activate) → ACTIVE → (close) → TARGET_HIT
                                        → STOP_LOSS_HIT
                                        → MANUALLY_CLOSED
          (cancel) → CANCELLED
```

**How to use:**
1. Go to **Paper Trading** → click "New Trade"
2. Fill symbol, direction (LONG/SHORT), entry price, SL, T1, T2, quantity
3. Click **Open Trade** → trade is created as PENDING
4. When you actually enter the trade: click **Activate** → records entry time
5. When the trade completes: click **Close Trade** → enter exit price, select type (Target/SL/Manual) → P&L computed automatically
6. A journal entry is **automatically created** for every closed trade

**P&L calculation:**
- LONG: `P&L = (exit_price - entry_price) × quantity`
- SHORT: `P&L = (entry_price - exit_price) × quantity`

### 11.8 Trade Journal

**Purpose:** Annotate every trade with emotion tags, mistake categories, and lessons. Track your psychology and process over time.

**Built-in emotion tags:**
Confident, Anxious, Greedy, Fearful, Disciplined, Impatient, Calm, Frustrated

**Built-in mistake categories:**
FOMO entry, Early exit, Ignored SL, Overtraded, No setup, Chased price, Wrong timeframe, Poor R:R

**Statistics tracked:**
- Total entries, Wins, Losses, Breakevens
- Win Rate %
- Total P&L and Average P&L per trade
- Top 5 mistakes by frequency
- Top 5 emotions by frequency

**How to use:**
1. Paper trade closes → journal entry auto-created with WIN/LOSS/BREAKEVEN
2. Go to **Trade Journal** → click the edit (pencil) icon on any entry
3. Add notes, select emotion tags, check mistakes, write lessons learned
4. Click **Save**

You can also add manual entries (click "Add Entry") for trades taken outside the system.

### 11.9 Broker Integration

**Purpose:** Connect a broker to see live account balance, positions, orders, and holdings. Placeholder for future real broker APIs.

**Connect MockBroker (fully functional):**
1. Go to **Broker** → click **Connect Demo** on MockBroker card
2. Dashboard appears with 4 tabs: Profile, Positions, Orders, Holdings
3. All data is simulated (deterministic per user+date) — looks like a real Zerodha account

**Supported real brokers (placeholders — not yet implemented):**
Zerodha Kite Connect, Upstox v2, Dhan, Angel One SmartAPI, Fyers

---

## 12. All API Endpoints

### Node.js REST API (port 3001, prefix: `/api`)

#### Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | No | Create account |
| POST | `/api/auth/login` | No | Login, returns JWT |
| GET | `/api/auth/me` | Yes | Get current user |

#### Documents
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/documents` | Yes | List user's PDFs |
| POST | `/api/documents/upload` | Yes | Upload PDF (multipart) |
| DELETE | `/api/documents/:id` | Yes | Delete PDF + its embeddings |

#### Market
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/market/candles` | Yes | `?symbol=NIFTY&timeframe=5m&limit=200` |
| GET | `/api/market/quote` | Yes | `?symbol=NIFTY` |
| GET | `/api/market/symbols` | Yes | `?q=REL` — search symbols |

#### Analysis
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/analysis/stock` | Yes | Full AI analysis (body: `{symbol, timeframe, capital, riskPct, marketType, notes, strategyId}`) |

#### Strategies
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/strategies` | Yes | List strategies |
| GET | `/api/strategies/meta` | Yes | Valid indicators + operators |
| POST | `/api/strategies` | Yes | Create strategy |
| GET | `/api/strategies/:id` | Yes | Get one |
| PUT | `/api/strategies/:id` | Yes | Update |
| DELETE | `/api/strategies/:id` | Yes | Delete |
| POST | `/api/strategies/:id/evaluate` | Yes | Evaluate on `{symbol, timeframe}` |
| POST | `/api/strategies/:id/scan` | Yes | Scan `{symbols[], timeframe}` |

#### Agent
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/agent/trade-query` | Yes | `{query, symbol, timeframe, capital, riskPct, marketType, strategyId?}` |

#### Backtesting
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/backtest` | Yes | List past backtests |
| POST | `/api/backtest/run` | Yes | Run `{strategyId, symbol, timeframe, capital, riskPct, nCandles}` |
| GET | `/api/backtest/:id` | Yes | Get one (with full result data) |
| DELETE | `/api/backtest/:id` | Yes | Delete |

#### Paper Trades
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/paper-trades` | Yes | List (`?status=open\|closed\|ACTIVE\|...`) |
| POST | `/api/paper-trades` | Yes | Open trade |
| GET | `/api/paper-trades/:id` | Yes | Get one |
| PATCH | `/api/paper-trades/:id/activate` | Yes | Mark as ACTIVE |
| PATCH | `/api/paper-trades/:id/close` | Yes | Close `{exitPrice, status, notes?}` |
| PATCH | `/api/paper-trades/:id/cancel` | Yes | Cancel |
| DELETE | `/api/paper-trades/:id` | Yes | Delete |

#### Journal
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/journal/stats` | Yes | Aggregated stats (win rate, P&L, top tags) |
| GET | `/api/journal` | Yes | List (`?symbol=&result=WIN\|LOSS\|BREAKEVEN&take=50&skip=0`) |
| POST | `/api/journal` | Yes | Create entry |
| GET | `/api/journal/:id` | Yes | Get one |
| PUT | `/api/journal/:id` | Yes | Update (notes, tags, lessons) |
| DELETE | `/api/journal/:id` | Yes | Delete |

#### Broker
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/broker/connections` | Yes | List connections |
| POST | `/api/broker/connections` | Yes | Connect `{brokerName, apiKey?, apiSecret?}` |
| DELETE | `/api/broker/connections/:id` | Yes | Disconnect |
| GET | `/api/broker/account` | Yes | Profile + margins |
| GET | `/api/broker/positions` | Yes | Open positions |
| GET | `/api/broker/orders` | Yes | Order book |
| GET | `/api/broker/holdings` | Yes | Equity holdings |

#### Chat
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/chat/theory` | Yes | `{message, sessionId, history[]}` |

### Python AI Service (port 8000, prefix: `/ai`)

All Python routes require the `X-Internal-Secret` header — they are only meant to be called by Node.js, not the browser.

**Swagger UI:** `http://localhost:8000/docs` — full auto-generated docs with all request/response schemas.

---

## 13. How the AI Works

### Analysis Pipeline

When you click "Analyse" on a symbol:

```
1. Node.js receives request
2. Looks up strategy conditions from DB (if strategyId given)
3. Calls Python /ai/analysis/stock

Python:
4. MockMarketProvider generates 200 candles (GBM, seeded from symbol+timeframe)
5. indicator_engine.py computes 15+ indicators on the last candle
6. Bias logic: checks EMA stack, RSI zone, MACD direction (7 factors → bull/bear score)
7. Rule engine: evaluates base rules (EMA crossover, RSI range, VWAP position, etc.)
8. Strategy engine: evaluates user strategy rules, computes confidence bonus
9. Position sizing: qty = floor(risk_amount / risk_per_unit)
10. Entry zone: ±0.2% around close
11. SL: close - 1.5×ATR (LONG) or close + 1.5×ATR (SHORT)
12. T1: entry + 1.5×risk; T2: entry + 3×risk
13. Calls GPT-4o-mini with: symbol, timeframe, indicators, bias, rules, strategy_result
14. GPT returns: reasoning paragraph, theory_references[], setup_type
15. If RAG documents exist: searches for relevant theory chunks, appends to response

Returns full analysis dict to Node.js → saved as TradeSetup in DB → sent to browser
```

### RAG Pipeline

```
INDEXING (happens when you upload a PDF):
1. pypdf extracts text
2. RecursiveCharacterTextSplitter splits into 1000-char chunks (200 overlap)
3. OpenAI text-embedding-3-small embeds each chunk (1536 dims)
4. pgvector stores: (chunk_text, embedding, document_id, chunk_index)

QUERYING (happens on analysis or chat):
1. Embed the question/query
2. pgvector cosine similarity search → top-K chunks
3. Stuff chunks into GPT prompt: "Answer based on these excerpts: ..."
4. GPT-4o-mini generates grounded answer
```

### Agent Architecture (LangGraph)

```
User query
    ↓
AgentState (messages list)
    ↓
create_react_agent(
    llm = ChatOpenAI(gpt-4o-mini, temperature=0),
    tools = [analyse_stock, search_theory_documents, get_price_quote],
    state_modifier = SYSTEM_PROMPT
)
    ↓
ReAct loop (max 12 steps):
    LLM thinks → selects tool → ToolNode executes → result added to messages
    ...repeat until LLM produces a final AIMessage (no tool call)
    ↓
Final AIMessage content = recommendation
```

**System prompt enforces:**
- Always call `analyse_stock` first
- Structured output format (bias → indicators → trade plan → risk → theory)
- NEVER say "place an order" or similar
- Every response must include risk warning

---

## 14. Strategy Rule Engine

### Rule Evaluation Logic

Each rule is evaluated against a snapshot of indicator values at the current bar:

```python
def evaluate_rule(rule, indicators):
    left = indicators[rule.indicator]   # e.g. rsi = 48.3
    
    if rule.operator == "above":
        right = indicators[rule.compare_to] if rule.compare_to else rule.value
        return left > right
    
    elif rule.operator == "below":
        right = indicators[rule.compare_to] if rule.compare_to else rule.value
        return left < right
    
    elif rule.operator == "between":
        return rule.value_min <= left <= rule.value_max
    
    elif rule.operator == "crossover":
        # Check if left crossed above right in last 3 bars
        # Uses indicator_history from the matrix
        return crossed_above_recently(left, right, history, n=3)
    
    elif rule.operator == "equal":
        return abs(left - right) / right < 0.0001
```

### AND vs OR Logic

- **AND**: all rules must pass → higher selectivity, fewer signals
- **OR**: any rule passes → more signals, use for broad conditions

### Confidence Bonus

When `logic=AND` and all rules match: `confidence = min(base_confidence + 15, 92)`

The cap at 92 is intentional — no analysis should claim 100% confidence.

### Security

The indicator name and operator are validated against `VALID_INDICATORS` and `VALID_OPERATORS` allowlists before any evaluation. This prevents injection attacks if rules come from user input.

---

## 15. Backtesting Engine

### Key Design Decisions

**No look-ahead bias:**
- Indicator matrix built with pandas rolling functions — index `i` only uses `data[0..i]`
- Entry is always on `candles[i+1].open` (next bar), never the signal bar's close

**Performance — O(n) not O(n²):**
- All indicators pre-computed once: `_build_indicator_matrix(df)` → O(n)
- Each bar: `_ind_at(matrix, i)` reads one row → O(1)
- Total: O(n) regardless of candle count

**Trade exit logic:**
```python
for j in range(signal_idx+1, signal_idx+1+MAX_BARS=20):
    if LONG:
        if candle[j].low <= SL:  → STOP_LOSS_HIT
        if candle[j].high >= T1: → TARGET_HIT
    else (SHORT):
        if candle[j].high >= SL: → STOP_LOSS_HIT
        if candle[j].low <= T1:  → TARGET_HIT
    # After 20 bars: TIMEOUT (exit at bar[j].close)
```

**Cooldown:** After each trade, 5 bars (`COOLDOWN_BARS=5`) are skipped before the next signal is considered.

**Mock data seed:** `hash(symbol + timeframe)` — same symbol+timeframe always produces the same candles, so backtest results are reproducible.

---

## 16. Paper Trading Lifecycle

```
                    ┌─────────┐
     open()         │ PENDING │
  ──────────────▶   └────┬────┘
                         │ activate()           cancel()
                         ▼                ──────────────▶ CANCELLED
                    ┌─────────┐
                    │ ACTIVE  │
                    └────┬────┘
                         │ close(exitPrice, status)
              ┌──────────┼──────────┐
              ▼          ▼          ▼
        TARGET_HIT  STOP_LOSS  MANUALLY_CLOSED
                        _HIT

On close: P&L computed → TradeJournal stub auto-created
```

---

## 17. Broker Integration

### Current State (MockBroker)

The `MockBrokerProvider` generates all data deterministically using `MD5(user_id + date)` as a random seed. This means:
- Same user sees same data within the same calendar day
- Data looks like a real Zerodha Kite API response (same field names)
- A different user sees completely different numbers

### Adding a Real Broker (Future)

To add Zerodha Kite Connect:

1. Implement `ZerodhaBrokerProvider` in `backend-python/app/services/broker/zerodha_broker.py`:
   ```python
   class ZerodhaBrokerProvider:
       def __init__(self, api_key, access_token): ...
       def get_profile(self, user_id): ...
       def get_margins(self, user_id): ...
       # ... same interface as MockBrokerProvider
   ```

2. In `backend-node/src/modules/broker/broker.service.ts`, change the `getAccount()` branch:
   ```typescript
   if (conn.brokerName === 'ZERODHA') {
     const apiKey = Buffer.from(conn.apiKeyEncrypted, 'base64').toString();
     return aiService.getBrokerAccountLive(userId, 'ZERODHA', apiKey);
   }
   ```

3. For OAuth flow (Kite Connect): add `GET /api/broker/zerodha/login` and `GET /api/broker/zerodha/callback` routes

### Broker Security Note

API keys are currently stored base64-encoded (not encrypted). Before using real broker keys in production:
- Use AES-256-GCM encryption with a dedicated `BROKER_ENCRYPTION_KEY` env var
- Store the IV with the ciphertext
- Consider using a secrets manager (AWS Secrets Manager, HashiCorp Vault)

---

## 18. Security Model

### Authentication Flow
```
Browser → POST /api/auth/login → Node.js
                              → bcrypt.compare(password, hash)
                              → jwt.sign({userId, role}, JWT_SECRET, {expiresIn: '7d'})
                              ← {token, user}
Browser stores token in localStorage (Zustand persist)
All subsequent requests: Authorization: Bearer <token>
Node.js middleware: jwt.verify(token, JWT_SECRET) → req.user = {id, role}
```

### Internal Service Security
Node.js passes `X-Internal-Secret: JWT_SECRET` on every call to Python. Python's `verify_internal_request` middleware rejects any request that doesn't have this exact header. In production, additionally put Python behind an internal-only network (Docker network, VPC private subnet) so it's not reachable from outside even without the header.

### Input Validation
- All request bodies validated with Zod (Node.js) or Pydantic (Python)
- Strategy indicator names allowlisted against `VALID_INDICATORS` set
- File upload restricted to PDF MIME type + size limit
- Rate limiting: 200 req/15min globally, 20 req/15min on auth routes

### CORS
Only `CLIENT_URL` (default: `http://localhost:3000`) is allowed as a CORS origin. Change this to your production domain.

### Password Security
- bcrypt with default cost factor (10 rounds)
- Passwords never returned in any API response

---

## 19. Configuration Tuning

### Analysis Quality

| Setting | Where | Effect |
|---|---|---|
| `OPENAI_MODEL` | `.env` | Swap to `gpt-4o` for better reasoning (higher cost) |
| `RETRIEVAL_TOP_K` | `.env` | Increase to 8–10 for more RAG context (slower) |
| `CHUNK_SIZE` | `.env` | Smaller = more precise retrieval; larger = more context per chunk |
| Confidence thresholds | `analysis_service.py` | Change min_rules_required, bias_score thresholds |

### Backtest Behaviour

| Parameter | File | Default | Notes |
|---|---|---|---|
| `WARMUP` | `backtest_engine.py` | 55 | Bars before strategy can trigger (allow EMA200 to warm up) |
| `_MAX_BARS_IN_TRADE` | `backtest_engine.py` | 20 | Trade timeout in bars |
| `_COOLDOWN_BARS` | `backtest_engine.py` | 5 | Bars to skip after a trade |
| SL multiplier | `backtest_engine.py` | 1.5×ATR | Change for tighter/wider stops |
| T1 multiplier | `backtest_engine.py` | 1.5×risk | Risk:reward ratio |

### Rate Limiting

In `backend-node/src/index.ts`:
```typescript
const globalLimiter = rateLimit({ windowMs: 15*60*1000, max: 200 });
const authLimiter   = rateLimit({ windowMs: 15*60*1000, max: 20  });
```
Increase `max` if you're hitting limits during development.

### Token Expiry

```bash
JWT_EXPIRES_IN=30d   # 30 days for personal use
JWT_EXPIRES_IN=1d    # 1 day for shared/production
```

---

## 20. Troubleshooting

### Docker won't start

```bash
# Check if ports are in use:
netstat -ano | findstr "3000\|3001\|5432\|8000\|27017"

# See container logs:
docker compose logs postgres
docker compose logs backend-node
docker compose logs backend-python

# Full reset:
docker compose down -v
docker compose up -d
```

### "prisma generate" error in Docker

Add `openssl` to the Node.js Dockerfile:
```dockerfile
RUN apk add --no-cache openssl
```
(Already done in Phase 8.)

### Python service fails to start — "OPENAI_API_KEY not set"

```bash
# Check your .env file has:
OPENAI_API_KEY=sk-proj-...

# Restart after editing .env:
docker compose down && docker compose up -d
```

### RAG returns empty results / "No relevant documents found"

1. Confirm document status is **Ready** (not PENDING/PROCESSING/FAILED)
2. Check Python logs for embedding errors: `docker compose logs backend-python`
3. Verify pgvector extension: `psql -d trade_analyser -c "SELECT * FROM pg_extension WHERE extname='vector';"`
4. Try re-uploading the PDF

### Analysis always returns same candles

This is expected — MockMarketProvider uses a deterministic seed per `symbol+timeframe`. The candle data is reproducible, not random per-request. To get different candles, change the symbol or timeframe.

### "Backtest has no trades" result

The strategy rules may be too strict. Try:
1. Loosening conditions (e.g., RSI 40–60 instead of 50–55)
2. Increasing `nCandles` to 1000 to have more opportunities
3. Testing with the default EMA Trend Follow template first

### Frontend shows "Network Error"

The frontend can't reach Node.js. Check:
```bash
# Is Node.js running?
curl http://localhost:3001/health

# Frontend env var correct?
cat frontend/.env.local
# Should have: NEXT_PUBLIC_NODE_API_URL=http://localhost:3001
```

### JWT token expired / "Unauthorized" errors

Log out and log back in. The token is stored in localStorage — clear it manually if needed:
```javascript
// In browser console:
localStorage.clear()
```

### "Paper trade not found" when closing

The trade was deleted, or you're logged in as a different user. Paper trades are user-scoped.

---

## 21. Enhancement Roadmap

These are ordered roughly by value/effort ratio.

### High Value, Moderate Effort

**1. Real Market Data (Zerodha Historical / NSE)**
Replace `MockMarketProvider` with real candles:
- Files: `backend-python/app/services/market_data.py`
- Add `ZerodhaMarketProvider` or `NSEBhavCopyProvider`
- Environment: add `MARKET_DATA_PROVIDER=zerodha|mock`
- The rest of the system works unchanged (same interface)

**2. Live Zerodha/Upstox Broker Integration**
- Implement `ZerodhaBrokerProvider` (see Section 17)
- Add OAuth flow for Kite login
- Enable live position/order tracking
- Manual order placement form (with confirmation dialog — never auto)

**3. Real-Time Price Updates (WebSocket)**
- Add Socket.IO or native WebSocket to Node.js
- Push live LTP updates from broker feed
- Update open paper trade P&L in real time
- Show live price on charts

**4. Notifications System**
- Email alerts when SL or target is hit on paper trades
- Add `nodemailer` + SMTP config to Node.js
- Push notification via browser Notification API

**5. Upgrade to GPT-4o for Analysis**
Simply change `OPENAI_MODEL=gpt-4o` in `.env`. Immediately better analysis quality (3–5× higher API cost).

### Medium Value, Low Effort

**6. More Technical Indicators**
In `backend-python/app/services/indicator_engine.py`:
- Supertrend, Ichimoku Cloud, Stochastic RSI, Williams %R, CCI, ADX
- pandas-ta already supports all of these — just add to `_compute_indicators()`
- Then add to `VALID_INDICATORS` in `strategy_engine.py`

**7. Multi-Timeframe Analysis**
Run analysis on 3 timeframes simultaneously (e.g., 1h for trend, 15m for entry, 5m for trigger) and synthesise. Requires minor changes to `analysis_service.py` and the frontend form.

**8. Watchlist Feature**
- Add `Watchlist` model to Prisma schema
- "Add to watchlist" button on analysis results
- Watchlist page runs mini-analysis on all symbols and shows a table

**9. Trade Sharing / Export**
- Export trade journal as CSV
- Export backtest results as CSV
- Share analysis screenshots (server-side PNG generation with puppeteer/canvas)

**10. Strategy Performance Dashboard**
Track how each strategy is performing across backtests and paper trades. Show per-strategy: total trades, win rate, avg P&L, last used.

**11. AI Journal Review**
Add a "Get AI Review" button on journal entries:
- Send the trade details + notes + mistakes to GPT-4o-mini
- Get back: what went right, what went wrong, specific improvement suggestions
- Store in `aiReview` column (already in schema)

### Higher Effort, High Value

**12. Options Analysis**
Support NIFTY/BANKNIFTY options:
- Add option chain fetching (NSE API or Zerodha)
- Add IV percentile, max pain, OI buildup indicators
- Separate "Options Setup" analysis mode

**13. Positional / Swing Trade Mode**
Current analysis is optimised for intraday. Add:
- Weekly/monthly chart analysis
- Fundamental data overlay (P/E ratio, EPS from screener.in)
- Sector rotation view

**14. Backtesting with Real Historical Data**
Replace GBM mock candles with real NSE historical data:
- Source: NSE Bhavcopy CSVs (free), Yahoo Finance, or paid data vendor
- Store in PostgreSQL with OHLCV tables per symbol+timeframe
- Much more accurate backtest results

**15. Portfolio-Level Backtesting**
Test a strategy across a basket of symbols simultaneously (portfolio simulation with correlation-aware position sizing).

**16. Mobile PWA**
- Add `manifest.json` and service worker
- Make the UI fully responsive for mobile
- Offline support for viewing past analysis

**17. Admin Dashboard**
- User management (CRUD, ban/unban)
- System health overview (DB size, API usage, error rates)
- Requires `role: ADMIN` check in Node.js

---

## 22. Production Deployment Guide

### Option A — Docker on a VPS (e.g., DigitalOcean, Hetzner, AWS EC2)

**1. Provision a server**
- Minimum: 2 vCPU, 4GB RAM (8GB recommended for AI ops)
- Ubuntu 22.04 LTS

**2. Install Docker**
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

**3. Clone repo and set env**
```bash
git clone <your-repo> trade-analyser
cd trade-analyser
cp .env.example .env
# Edit .env: set strong JWT_SECRET, OPENAI_API_KEY, strong DB passwords
nano .env
```

**4. Production docker-compose override**

Create `docker-compose.prod.yml`:
```yaml
version: '3.9'
services:
  backend-node:
    environment:
      NODE_ENV: production
    command: ["npm", "start"]    # uses compiled JS

  backend-python:
    command: ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]

  frontend:
    environment:
      NEXT_PUBLIC_NODE_API_URL: https://your-domain.com
    command: ["npm", "start"]    # built Next.js
```

Run with:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

**5. Apply migrations**
```bash
docker compose exec backend-node npx prisma migrate deploy
```

**6. SSL with Nginx + Certbot**

Update `docker/nginx/nginx.conf` to add HTTPS, then:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

**7. Firewall**
```bash
ufw allow 80
ufw allow 443
ufw deny 3000 3001 8000 5432 27017   # block direct access to services
ufw enable
```

**8. Monitoring**
```bash
# Container health
docker compose ps

# Resource usage
docker stats

# Logs with timestamps
docker compose logs --timestamps -f backend-python
```

### Option B — Cloud-Native (Separate Services)

| Service | Cloud Option |
|---|---|
| PostgreSQL | AWS RDS, Supabase, Neon |
| MongoDB | MongoDB Atlas |
| Node.js backend | AWS ECS, Render, Railway |
| Python backend | AWS ECS, Modal, Render |
| Frontend | Vercel (free tier works) |
| File storage | AWS S3 (replace local `/app/uploads`) |

For this path:
1. Remove the DB services from `docker-compose.yml`
2. Update `DATABASE_URL` and `MONGODB_URI` env vars to point to cloud services
3. For S3 uploads: add `@aws-sdk/client-s3` to Node.js and update `documents.service.ts`

### Production Checklist

- [ ] `JWT_SECRET` is at least 32 random bytes (`openssl rand -hex 32`)
- [ ] All default passwords changed (`POSTGRES_PASSWORD`, `MONGO_PASSWORD`)
- [ ] `NODE_ENV=production` set
- [ ] `CLIENT_URL` set to your actual domain
- [ ] HTTPS enabled (SSL certificate)
- [ ] Direct port access to services blocked by firewall
- [ ] Python service not reachable from internet (internal Docker network only)
- [ ] `OPENAI_API_KEY` has usage limits set in OpenAI dashboard
- [ ] Database backups configured
- [ ] Log rotation configured (Docker log driver or logrotate)

---

## 23. Frequently Asked Questions

**Q: Does this work with real NSE data?**  
A: Currently no — it uses simulated candle data (MockMarketProvider with GBM). The architecture is designed so you can swap in a real data provider without changing any other code. See Section 21, Enhancement #1.

**Q: Will it ever auto-trade?**  
A: No. This is a strict design constraint. The system produces analysis and setup suggestions. You decide whether to act on them. Any future broker integration will only allow manual order placement with an explicit confirmation step.

**Q: My confidence scores are always in the 60–75% range. Is that normal?**  
A: Yes. The base analysis has calibrated thresholds. Scores above 80 require both a strong indicator confluence AND a fully matching strategy. The hard cap is 92 — no setup claims 100% certainty.

**Q: How much does it cost to run?**  
A: Infrastructure: near zero (runs on a single VPS or even a laptop). The main cost is OpenAI API:
- Each analysis call: ~500–800 tokens → ~$0.001–0.002
- Each agent run: ~2,000–5,000 tokens across tool calls → ~$0.004–0.01
- Each PDF embed (1,000 chunks): ~$0.02
- For personal use (50 analyses/day): ~$2–5/month

**Q: Can I use a local LLM instead of OpenAI?**  
A: Yes, with some changes. LangChain supports Ollama, LlamaCpp, etc. Replace `ChatOpenAI(model="gpt-4o-mini")` with `ChatOllama(model="llama3")` in `analysis_service.py` and `agent/graph.py`. You'll also need a local embedding model for RAG. Quality will be lower than GPT-4o-mini.

**Q: The backtest shows great results — should I trade this strategy live?**  
A: Be very cautious. The backtests use simulated candle data (not real historical prices), so they measure how the strategy performs on GBM-generated data with your chosen parameters. They are useful for testing rule logic and relative comparisons between strategies, but should not be taken as proof of real-world profitability.

**Q: How do I reset everything and start fresh?**  
A: `make clean` — this stops all containers, deletes all Docker volumes (database data, uploads), and removes `node_modules`. Then run `make up` and `make db-migrate` to start fresh.

**Q: Can multiple users use this simultaneously?**  
A: Yes. All data is user-scoped (every DB query filters by `userId`). The JWT identifies the user on every request. The rate limit (200 req/15min) applies globally across all users — increase it if needed.

**Q: The Python service is slow to start. Is that normal?**  
A: Yes — on first startup, Python imports LangChain, LangGraph, pandas, and other heavy libraries. Allow 20–30 seconds for the health check to pass. Subsequent starts (same Docker layer cache) are faster.

---

## 24. Intelligence Layer — 4 Approaches

To move from "indicator-aligned guess" to "evidence-backed recommendation", four cooperating systems augment every analysis. They run automatically — no extra user action — and surface in the analysis UI.

### 24.1 Approach 1 — Signal Validator (mini-backtest per analysis)

**File:** `backend-python/app/services/signal_validator.py`

**What it does:** For the current setup (Bullish/Bearish + Setup Type), scan the last 500 candles and find every historical bar where the same conditions were present. Simulate a 1.5×ATR SL / 1.5×ATR T1 trade from each match. Return aggregated stats.

**Algorithm:**
1. Build a causal indicator matrix (`_build_scan_matrix`) — no look-ahead.
2. Walk forward from bar 55 (WARMUP) to bar N−20 (N_FORWARD).
3. At each bar, call `_matches(ind, bias, setup_type)` — setup-specific condition matcher:
   - Common: trend filter (price vs EMA50, EMA9 vs EMA21, RSI band).
   - `EMA21 Pullback` → price within 1×ATR of EMA21.
   - `VWAP Bounce` → price 0–1×ATR above VWAP.
   - `Breakout Retest` → MACD histogram positive, volume > 1×avg.
4. On a match, simulate the trade with `_simulate_forward` — hit SL = loss, hit T1 = win, otherwise timeout.
5. After a decided trade, skip `N_FORWARD` bars (cooldown) so trades don't overlap.

**Output fields (in `analysis.validation`):**
| Field | Meaning |
|---|---|
| `occurrences` | Total bars where conditions matched |
| `decided` | Trades that hit SL or T1 (timeouts excluded) |
| `wins` / `losses` / `timeouts` | Outcome counts |
| `hit_rate` | `wins / decided × 100` |
| `is_validated` | `True` if `decided ≥ 5` |
| `confidence_label` | `Strong` (≥60%), `Moderate` (≥50%), `Weak` (<50%), `Unverified` (insufficient data) |

**Confidence impact:** `Strong` → `+5`; `Weak` → `−3`; otherwise unchanged.

### 24.2 Approach 2 — Multi-Timeframe (MTF) Confluence

**File:** `backend-python/app/services/mtf_analysis.py`

**What it does:** Run market bias analysis on the primary timeframe plus 2 higher timeframes, then score alignment. The premise: a 15m long has much higher odds when 1h and 4h are also bullish.

**Timeframe hierarchy:**
```
1m  → [5m,  15m]
5m  → [15m, 1h]
15m → [1h,  4h]
1h  → [4h,  1d]
4h  → [1d,  1w]
1d  → [1w,  1M]
```

**Algorithm:**
1. For each timeframe, fetch 250 candles, compute full indicators.
2. `_compute_bias` runs 7 directional checks (price vs EMA9/21/50, EMA stack, RSI band, MACD hist).
3. `bull_pct ≥ 0.65` → Bullish; `≤ 0.35` → Bearish; else Sideways.
4. Aggregate dominant bias count across all 3 TFs:
   - 3/3 same direction → `Strong`, `+12` confidence.
   - 2/3 → `Moderate`, `+6`.
   - 1/3 → `Weak`, `−5`.
   - 0/3 (perfectly split) → `Conflicting`, `−10`.
   - Primary is Sideways → label `Sideways Primary`, `−4`.

**Output fields (in `analysis.mtf_confluence`):**
| Field | Meaning |
|---|---|
| `primary_tf` / `higher_tfs` | Timeframes used |
| `timeframe_bias` | Per-TF dict: `{bias, bull_pct, label, is_primary, key_indicators}` |
| `confluence_score` | 0–3 |
| `confluence_label` | Strong / Moderate / Weak / Conflicting / Sideways Primary |
| `confidence_adjustment` | Points added to (or subtracted from) the base confidence score |

**UI:** The TradeSetupCard renders per-TF bias bars with bull% fill, label, and the score badge. Primary TF is highlighted.

### 24.3 Approach 3 — Built-in Theory Knowledge Base (RAG seed)

**Files:**
- `backend-python/app/services/builtin_theory/content.py` — 15 long-form theory documents.
- `backend-python/app/services/builtin_theory/__init__.py` — empty package marker (Python needs this so `app.services.builtin_theory` can be imported; no re-exports needed).
- `backend-python/app/services/theory_seeder.py` — chunks, embeds, and inserts the 15 docs into pgvector under `user_id='__builtin__'`.

**Why this exists:** Until the user uploads their own theory PDFs, the RAG chat had nothing to retrieve from. Now the system ships with a professional baseline — Dow Theory, EMA systems, RSI, MACD, Volume/VSA, Candlestick patterns (with Bulkowski reliability stats), VWAP, Bollinger Bands, ATR, Risk Management, Indian Market specifics, Intraday strategies, MTF analysis, Wyckoff, Price Action.

**How retrieval combines sources:**
`backend-python/app/services/rag_service.py` was updated to query both spaces in one cosine search:
```sql
WHERE user_id = :user_id OR user_id = '__builtin__'
```
Each returned chunk carries an `is_builtin` flag so the UI can label sources distinctly.

**Seeding (run once after first deploy):**
```bash
make seed-theory
# or
curl -X POST http://localhost:8000/ai/documents/seed-builtin \
     -H "X-Internal-Secret: $JWT_SECRET"
# or (authenticated via Node proxy):
POST /api/documents/seed-builtin
```
The endpoint is idempotent — it clears existing `__builtin__` chunks before re-inserting. Status check:
```bash
GET /api/documents/seed-builtin/status   →   {"is_seeded": true|false}
```

**To extend:** edit `content.py`, append a new dict `{id, title, content}` to `BUILTIN_THEORIES`, re-run `make seed-theory`.

### 24.4 Approach 4 — Tavily Web Search Tool (real-time market news)

**File:** `backend-python/app/services/agent/tools.py` — new `search_market_news` LangChain tool added to the ReAct agent's toolbox.

**What it does:** Lets the LangGraph agent fetch live news, analyst notes, and sentiment from moneycontrol / livemint / economic times / NSE / BSE when the user asks "Why is HDFC Bank moving today?" or "Any news on Reliance Q4 results?".

**Graceful degradation:** If `TAVILY_API_KEY` is empty, the tool returns a clear message ("Real-time web search is not available …") instead of raising — the agent continues with its other 3 tools.

**Configuration:**
```env
# .env
TAVILY_API_KEY=tvly-...your-key...
```
Get a free key at <https://app.tavily.com>. Added to `requirements.txt` (`tavily-python==0.3.3`) and `docker-compose.yml` (passed to backend-python env).

The query is automatically scoped: `"<your query> NSE BSE Indian stock market"` — biases results toward Indian-market sources. Up to 5 results, title + snippet + source URL.

### 24.5 How the four approaches combine in one analysis call

A single `POST /api/analysis/stock` now produces this enriched flow:

```
1. Candles fetched
2. Indicators computed
3. Bias + Setup detected
4. Base confidence (from rule checklist)
5. + Strategy bonus (if a custom strategy matched)
6. + MTF confluence adjustment (Approach 2)        ← runs analysis on 2 higher TFs
7. + Validation hit-rate bonus (Approach 1)        ← runs mini-backtest
8. Reasoning text built
9. Response returned with `validation`, `mtf_confluence`, plus everything else
```

Confidence is clamped to `[10, 92]` — never 0% (always some signal) and never 100% (epistemic humility, per the safety constraint).

### 24.6 New / changed files at a glance

| File | Change |
|---|---|
| `backend-python/app/services/signal_validator.py` | NEW — Approach 1 |
| `backend-python/app/services/mtf_analysis.py` | NEW — Approach 2 |
| `backend-python/app/services/builtin_theory/__init__.py` | NEW — empty package marker |
| `backend-python/app/services/builtin_theory/content.py` | NEW — 15 theory docs |
| `backend-python/app/services/theory_seeder.py` | NEW — Approach 3 embed pipeline |
| `backend-python/app/services/analysis_service.py` | MODIFIED — integrates A1 + A2 |
| `backend-python/app/services/rag_service.py` | MODIFIED — queries `__builtin__` chunks too; new system prompt |
| `backend-python/app/services/agent/tools.py` | MODIFIED — added `search_market_news` (A4) |
| `backend-python/app/routers/rag.py` | MODIFIED — `POST/GET /ai/documents/seed-builtin[/status]` |
| `backend-python/app/models/schemas.py` | MODIFIED — `SourceChunk.is_builtin` |
| `backend-python/app/config.py` | MODIFIED — `tavily_api_key` |
| `backend-python/requirements.txt` | MODIFIED — `tavily-python==0.3.3` |
| `backend-node/src/services/ai.service.ts` | MODIFIED — `seedBuiltinTheories`, `getBuiltinSeedStatus` |
| `backend-node/src/modules/documents/documents.controller.ts` | MODIFIED — `seedBuiltin`, `builtinSeedStatus` handlers |
| `backend-node/src/modules/documents/documents.routes.ts` | MODIFIED — proxy routes |
| `frontend/lib/api/analysis.api.ts` | MODIFIED — `validation`, `mtf_confluence` types |
| `frontend/components/analysis/TradeSetupCard.tsx` | MODIFIED — two new panels |
| `.env.example` | MODIFIED — `TAVILY_API_KEY` |
| `docker-compose.yml` | MODIFIED — passes `TAVILY_API_KEY` to backend-python |
| `Makefile` | MODIFIED — added `seed-theory` target |

### 24.7 Quick first-run with the intelligence layer

```bash
# 1. (one time) Add Tavily key for live news (optional)
echo "TAVILY_API_KEY=tvly-..." >> .env

# 2. Start the stack
make up

# 3. Apply DB migrations
make db-migrate

# 4. Seed the built-in trading theory (one time, ~30s — OpenAI embeddings)
make seed-theory

# 5. Open http://localhost — every Analysis now shows
#      ├─ Signal Validation panel (hit rate + occurrences)
#      └─ MTF Confluence panel (3 TFs aligned/conflicting)
#    The Agent and Theory Chat can now answer trading-theory questions
#    even without uploading your own PDFs.
```

---

*Trade Analyser AI — Built by Jayant Verma | June 2026 | Personal project, not financial advice*
