# Module 01 — Getting Started

Before we dive into concepts, let's make sure you can run the whole stack and
know which process does what. If any command fails, module 12 (Debugging
Playbook) has the fixes.

## The three services

The app is really three separate programs that talk to each other over HTTP:

```
   Browser (localhost:3000)
        │
        ▼
   Next.js frontend          (Node.js process)
        │
        ▼
   Node.js backend           (Express + Prisma, localhost:3001)
        │
        ▼
   Python AI service         (FastAPI, localhost:8000)
        │
        ▼
   Postgres + pgvector       (Docker container, localhost:5433)
```

Plus:
- **MongoDB** (chat history) — optional, only used by chat modules.
- **Redis** — only if you add real-time features (module 11).

Each service has its own folder, its own dependencies, and its own start command.

## Prerequisites

You need installed:

| Tool | Version | Check with |
|---|---|---|
| Node.js | 20.x | `node --version` |
| npm | 10.x | `npm --version` |
| Python | 3.11 or 3.12 | `python --version` |
| Docker Desktop | any recent | `docker --version` |
| Git | any recent | `git --version` |

On Windows you also need Git Bash (comes with Git for Windows) so the `Bash`
scripts in package.json work.

## Step 1 — Start the databases (Docker)

Postgres with pgvector is packaged in `docker-compose.yml`. From the project root:

```powershell
docker compose up -d postgres mongodb
```

`-d` means "detached" — runs in the background. To see if they started:

```powershell
docker compose ps
```

You want both `trade_postgres` and `trade_mongodb` in **Status: healthy** (may
take 15-30 seconds).

To see the logs of Postgres if something's wrong:

```powershell
docker compose logs postgres
```

If you'd rather not use Docker for Postgres, install it natively and edit
`.env` — but Docker is by far the easiest path.

## Step 2 — Set up Python backend

Python uses **virtualenvs** (isolated dependency folders) — module 02 explains
why. First time only:

```powershell
cd D:\Jayant\Trade-Analyser\backend-python
python -m venv .venv                    # creates .venv/ folder
.venv\Scripts\Activate.ps1              # activate the virtualenv
pip install -r requirements.txt         # installs all Python packages
```

When the venv is activated your prompt shows `(.venv)`. Any `python` or `pip`
command from now on uses this isolated environment, not your global Python.

Every subsequent session, just activate:

```powershell
cd D:\Jayant\Trade-Analyser\backend-python
.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```

**uvicorn** is the ASGI web server that runs FastAPI. `--reload` restarts on
code changes.

**Success looks like:**
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete.
```

Test it: open http://localhost:8000/docs — FastAPI's auto-generated Swagger UI
should render. Every route we build shows up there.

## Step 3 — Set up Node backend

First time only:

```powershell
cd D:\Jayant\Trade-Analyser\backend-node
npm install
npx prisma db push          # syncs Prisma schema into Postgres
```

`prisma db push` creates the tables (`users`, `theory_documents`, etc.) if
they don't exist, or updates them if the schema changed.

Every subsequent session:

```powershell
cd D:\Jayant\Trade-Analyser\backend-node
npm run dev
```

**Success looks like:**
```
🚀 Node backend running on http://localhost:3001
```

Test it: `curl http://localhost:3001/health` should return `{"status":"ok",...}`.

## Step 4 — Set up frontend

```powershell
cd D:\Jayant\Trade-Analyser\frontend
npm install                 # first time only
npm run dev
```

Open http://localhost:3000. Register a new account. If everything works you
land on the dashboard.

## Environment variables

The root `.env` file feeds all three services. Key entries:

```env
DATABASE_URL=postgresql+asyncpg://postgres:trade_pass@localhost:5433/trade_analyser
#                       ^^^^^^^^^^ Python driver (asyncpg)
# Note: Node reads a separate backend-node/.env that uses plain postgresql://
#       (Prisma doesn't understand the asyncpg driver prefix).

OPENAI_API_KEY=sk-proj-...            # required
OPENAI_MODEL=gpt-4o-mini              # chat model
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
JWT_SECRET=...                         # any long random string
TAVILY_API_KEY=tvly-...                # optional (news search)
```

**When you change `.env`, restart every service** — Python and Node cache env
vars at startup.

## The request lifecycle — a concrete example

You click "Analyse RELIANCE" in the browser. Here's what happens:

1. **Browser** → POST `http://localhost:3000/api/analysis/stock` (Next.js rewrite forwards this)
2. **Next.js middleware** → checks `trade_token` cookie, allows through.
3. **Next.js rewrite** (in `next.config.mjs`) → forwards to `http://localhost:3001/api/analysis/stock`.
4. **Node backend** → verifies JWT, validates body against zod schema, calls `aiService.analyseStock()`.
5. **Node's `aiService`** → uses `axios` to POST to `http://localhost:8000/ai/analysis/stock` with an `X-Internal-Secret` header.
6. **Python's FastAPI router** → verifies internal secret, delegates to `analysis_service.run_analysis()`.
7. **Python** → fetches candles from `MockMarketProvider`, computes indicators, detects setup, calculates confidence, runs MTF confluence + validation.
8. **Python** → returns a JSON dict.
9. **Node** → passes it back to the browser.
10. **Frontend** → renders the `TradeSetupCard` component.

Every module in this documentation zooms into one of these steps.

## Quick sanity check

If everything is running you should see in three separate terminals:

- Uvicorn logging `INFO: 127.0.0.1:xxxx - "POST /ai/analysis/stock HTTP/1.1" 200`
- Node logging `POST /api/analysis/stock 200`
- Browser showing the trade card

If any of the three is silent when you click the button, that's your bug location.

## Ready?

You now have all three services running and know which port owns which
responsibility. Head to **[Module 02 — Python for Node Developers](./02-python-basics.md)** to start reading the code.
