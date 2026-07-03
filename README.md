# Trade Analyser AI

An AI-powered trade analysis and decision support platform for the Indian Stock Market (NIFTY, BANKNIFTY, NSE/BSE).

> **Disclaimer:** This platform provides analysis, backtesting, and decision support only. It is NOT a financial advisor and does NOT place live orders automatically. All trade setups require manual user confirmation.

---

## Features (Phase 1 — Current)

- JWT authentication with RBAC (user / admin)
- PDF theory document upload with pgvector embeddings
- RAG-powered theory chatbot — answers strictly from your documents
- Professional dark-mode dashboard with sidebar layout
- Document processing status polling (PENDING → PROCESSING → READY)

## Planned Features

| Phase | Features |
|-------|----------|
| 2 | Market data abstraction, indicator engine (SMA/EMA/RSI/MACD/ATR/VWAP), stock analysis page |
| 3 | Strategy rule engine, risk calculator, entry/SL/target generation |
| 4 | LangGraph agentic workflow (8-step analysis pipeline) |
| 5 | Backtesting engine (win rate, drawdown, P&L) |
| 6 | Paper trading + AI trade journal review |
| 7 | Broker placeholder (Zerodha, Upstox, Dhan, Angel One, FYERS) |
| 8 | Deployment + README polish |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, ShadCN UI, Zustand |
| Node API | Express.js + TypeScript, Prisma ORM, Zod validation |
| AI Backend | Python FastAPI, LangChain, OpenAI, pgvector |
| Database | PostgreSQL 15 + pgvector extension |
| Chat Logs | MongoDB (optional) |
| DevOps | Docker Compose, Nginx, GitHub Actions |

---

## Local Setup (Without Docker)

### Prerequisites
- Node.js 20+
- Python 3.11+
- PostgreSQL 15 with pgvector extension
- OpenAI API key

### 1. Clone and configure environment

```bash
git clone <repo-url>
cd Trade-Analyser
cp .env.example .env
# Edit .env with your values (OPENAI_API_KEY, JWT_SECRET, database creds)
```

### 2. Start the Node.js backend

```bash
cd backend-node
npm install
npx prisma generate
npx prisma migrate deploy   # applies the init migration
npm run dev
# Runs on http://localhost:3001
```

### 3. Start the Python AI backend

```bash
cd backend-python
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Mac/Linux:
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# Runs on http://localhost:8000
```

### 4. Start the Next.js frontend

```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:3000
```

---

## Docker Setup (Recommended)

```bash
cp .env.example .env
# Fill in OPENAI_API_KEY and JWT_SECRET at minimum

docker-compose up --build
```

Services:
- Frontend: http://localhost:3000
- Node API: http://localhost:3001
- Python AI: http://localhost:8000
- Nginx gateway: http://localhost:80
- PostgreSQL: localhost:5432
- MongoDB: localhost:27017

---

## Environment Variables

See [.env.example](.env.example) for all variables.

**Required to set manually:**
```
OPENAI_API_KEY=sk-...
JWT_SECRET=<random 64-char string>
```

---

## API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new account |
| POST | `/api/auth/login` | Login and get JWT |
| GET | `/api/auth/me` | Get current user + settings |

### Documents
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/documents/upload` | Upload PDF/TXT |
| GET | `/api/documents` | List user's documents |
| DELETE | `/api/documents/:id` | Delete document + embeddings |
| POST | `/api/documents/:id/reprocess` | Re-embed a document |

### Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat/theory` | RAG theory Q&A |

---

## Project Structure

```
Trade-Analyser/
├── frontend/           # Next.js 14 App Router
├── backend-node/       # Express.js REST API + Prisma
├── backend-python/     # FastAPI AI backend (RAG, indicators, agents)
├── docker/             # Dockerfiles + Nginx config
└── docker-compose.yml
```

---

## Architecture

```
Browser (Next.js)
    │
    ▼
Nginx (port 80)
    ├── /api/*  → Node.js :3001  (auth, CRUD, documents)
    └── /ai/*   → Python :8000   (RAG, embeddings, agents)
                        │
                        ▼
               PostgreSQL :5432
               ├── Prisma tables (users, docs, trades…)
               └── pgvector (document_chunks + embeddings)
```
