# Trade Analyser AI — Learning Docs

Welcome. This folder is a **teaching guide** for how the Trade Analyser AI project
works internally. It's written for someone who:

- Knows **Node.js / Next.js** already (so we breeze past those).
- Has little or no experience with **Python, FastAPI, LangChain, LangGraph, RAG, Docker, Nginx, Postgres, or pgvector**.
- Wants to understand every folder, every file, and every concept **from first principles**.

Read the modules in order. Each one builds on the previous. If you already know
a topic, skim it — you'll still learn how it's used in this project.

## Reading order

| # | File | What you'll learn |
|---|---|---|
| 01 | [Getting Started](./01-getting-started.md) | How the whole stack boots locally, service by service. |
| 02 | [Python for Node Developers](./02-python-basics.md) | Just enough Python to read our code — imports, async, type hints, virtualenvs. |
| 03 | [FastAPI Explained](./03-fastapi.md) | The Python web framework we use (Express.js's cousin) and where to find each route. |
| 04 | [Postgres, Prisma & pgvector](./04-postgres-and-prisma.md) | Databases we use, how Prisma models them, how vectors are stored. |
| 05 | [LangChain Fundamentals](./05-langchain-fundamentals.md) | What LangChain is and why we use it — with our real usage as examples. |
| 06 | [RAG Explained](./06-rag-explained.md) | Retrieval-Augmented Generation — how the theory chat works end to end. |
| 07 | [LangGraph & AI Agents](./07-langgraph-agents.md) | How the "AI Agent" page's ReAct loop and tools are wired. |
| 08 | [The Analysis Engine](./08-analysis-engine.md) | Technical indicators, setup detection, confidence scoring, MTF confluence, signal validation. |
| 09 | [The Recommendation Engine](./09-recommendation-engine.md) | Composite scoring, parallel scans, sector universe. |
| 10 | [Vision Pipeline for PDFs](./10-vision-pipeline.md) | How GPT-4 Vision reads candlestick images in your uploads. |
| 11 | [Docker & Nginx Basics](./11-docker-and-nginx.md) | Containers, docker-compose, the reverse proxy — enough to be productive. |
| 12 | [Debugging Playbook](./12-debugging-guide.md) | How to inspect logs, DB rows, embeddings, API calls, and diagnose failures. |

## Frontend & Node.js — the light-touch summary

Since you already know Node/Next, here's a **one-page overview** you can use as
a map instead of a tutorial. Read module 01 first, then reference this as needed.

### `backend-node/` (Express + TypeScript + Prisma)

```
src/
├── config/               # env loader (zod-validated) + Prisma client
├── middleware/           # auth (JWT), upload (multer), error handler, validate (zod)
├── modules/              # one folder per feature area — controller/routes/service/schema
│   ├── auth/             # login, register, JWT issuing
│   ├── documents/        # PDF upload, list, delete, seed built-in theory
│   ├── chat/             # proxies to Python /ai/chat/theory (RAG)
│   ├── analysis/         # proxies to Python /ai/analysis/stock
│   ├── recommendations/  # proxies to Python /ai/recommendations/*
│   ├── strategies/       # user-defined rule sets
│   ├── agent/            # proxies to Python /ai/agent/trade-query
│   ├── backtest/         # proxies to Python /ai/backtest/run
│   ├── paper-trades/     # virtual trade tracking
│   ├── journal/          # trade journal notes
│   ├── broker/           # placeholder for real broker integration
│   └── market/           # symbol search, quote proxy
├── services/             # ai.service.ts is the axios wrapper for all Python calls
├── utils/                # logger (winston), response helpers, errors
└── index.ts              # Express bootstrap — CORS, rate limits, route mounting
```

**Mental model:** Node is a **thin gateway**. It authenticates users, validates
requests, hits Prisma for user data, and forwards analytical calls to Python.
Node never runs indicator math or LLM code itself.

### `frontend/` (Next.js 14 App Router)

```
app/
├── (auth)/               # login, register — public routes
├── (dashboard)/          # authenticated routes (dashboard, analysis, chat, etc.)
│   ├── layout.tsx        # wraps every page in Sidebar + auth check
│   ├── page.tsx          # dashboard home
│   ├── analysis/         # single-stock analysis
│   ├── recommendations/  # sector/market scan (feature we recently built)
│   ├── chat/             # theory chat (RAG)
│   ├── agent/            # AI Agent (LangGraph)
│   └── ...               # documents, backtest, paper-trades, journal, broker, settings
├── globals.css
└── layout.tsx            # root layout (loads Toaster client-only)

components/
├── ui/                   # shadcn-style primitives (button, card, badge, toast)
├── shared/               # Sidebar
├── analysis/             # TradeSetupCard, chart panels
├── chat/                 # ChatInterface, MessageBubble
├── documents/            # upload, list
├── recommendations/      # StockRecommendationCard
└── charts/               # CandlestickChart (lightweight-charts)

lib/
├── api/                  # one .ts file per feature — axios wrappers
├── store/                # zustand: auth.store.ts (persisted)
└── utils.ts              # cn(), formatCurrency, formatDate helpers

hooks/                    # use-toast
types/                    # shared TS interfaces (User, TheoryDocument, SourceChunk, etc.)
middleware.ts             # Next.js middleware — cookie-based auth guard
```

**Mental model:** the frontend never talks to Python directly. All API calls
go to Node (`/api/...`) or optionally to Python (`/ai/...`) through Next's
rewrite rules in `next.config.mjs`.

### `backend-python/` (FastAPI)

This is what the docs actually teach — modules 02 through 10.

---

## Suggested learning path

- **Day 1** — Modules 01, 02, 03. Get the stack running, understand Python syntax, understand how FastAPI routes are declared. You'll be able to add a new endpoint by the end.
- **Day 2** — Module 04. Learn how to open the Postgres database, look at rows, understand pgvector.
- **Day 3** — Modules 05, 06. LangChain + RAG. This is the AI heart of the app.
- **Day 4** — Modules 07, 10. LangGraph agents and the vision pipeline.
- **Day 5** — Modules 08, 09. Deep dive into the analysis and recommendation math.
- **Day 6** — Modules 11, 12. Docker basics and debugging techniques.

Each module has code references like `backend-python/app/services/rag_service.py:35` — click those in VS Code to jump straight there.

Take breaks. Re-read the parts that don't click on the first pass.
