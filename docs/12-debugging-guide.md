# Module 12 — Debugging Playbook

Every issue in a three-service app has one of a few root causes. This module
gives you a systematic way to find them.

## Rule zero — check every log window

The moment something breaks, glance at all three terminals:

- **Frontend** (`npm run dev`) — Next.js compile errors, hydration errors.
- **Node** (`npm run dev`) — HTTP status codes and stack traces.
- **Python** (uvicorn) — indicator errors, LLM errors, DB errors.

**Where is the last line printed?** That's where the request died.

If Python is silent when Node logs "Python AI service error", the request
didn't reach Python. That's a network / port issue.

If Python logs 500 with a stack trace, the request reached Python but failed
there. Read the stack.

## The five categories of errors

### 1. "Service can't reach service"

Symptoms:
- Axios error with `status: undefined` in Node logs.
- `AggregateError` or `ECONNREFUSED` in the stack.

Causes:
- Python (or Node) crashed silently. Check its terminal — is uvicorn still
  showing "Waiting for requests"?
- Wrong port in `.env`. Node points at `PYTHON_SERVICE_URL=http://localhost:8000`.

Fix: restart whichever service died. Look at the LAST lines before it died.

### 2. Import / module errors (Python)

Symptoms:
- `ModuleNotFoundError: No module named 'X'` at uvicorn startup.

Cause: you added an import but haven't installed the package.

Fix:
```powershell
cd D:\Jayant\Trade-Analyser\backend-python
.venv\Scripts\Activate.ps1
pip install X
# Then add X==version to requirements.txt
```

### 3. Database errors

**"Column does not exist"** or **"Relation X does not exist"**:
- Schema drift. Node's `prisma db push` wasn't run after a schema change.
- Fix: `cd backend-node; npx prisma db push`

**"syntax error at or near ':'"** (from pgvector queries):
- Python is calling `<=> :vec::vector` which asyncpg mistakenly parses.
- Fix: use `CAST(:vec AS vector)` in the SQL string.

**"connection refused"**:
- Postgres container isn't up.
- Fix: `docker compose ps` — is `trade_postgres` running and healthy?

### 4. Auth errors

**Frontend suddenly redirects to /login on every reload**:
- Zustand hydration race — we fixed this in `auth.store.ts` with
  `hasHydrated`. If it comes back, that flag isn't being awaited in the
  DashboardLayout.
- Verify cookie is being set: DevTools → Application → Cookies →
  `trade_token` should exist.

**Node returns 401 to a valid token**:
- JWT_SECRET mismatch between Node and Python.
- Ensure both `.env` files have the same `JWT_SECRET`.

### 5. Frontend runtime errors

**"Cannot read properties of undefined (reading 'call')"**:
- Stale webpack chunk cache. Run:
  ```powershell
  Remove-Item -Recurse -Force D:\Jayant\Trade-Analyser\frontend\.next-dev
  npm run dev
  ```
- Hard refresh browser (Ctrl+Shift+R).

**Hydration mismatch**:
- Server HTML ≠ client HTML on first render.
- Common culprits: `Date.now()`, `Math.random()`, `document.cookie` in
  render, or components using browser-only APIs. Wrap those in
  `useEffect` or use `next/dynamic({ ssr: false })`.

## Concrete debugging recipes

### "The AI Agent isn't calling my new tool"

1. Confirm the tool is exported from `make_agent_tools()` in `tools.py`.
2. Confirm the `@tool("name")` decorator has a clear name.
3. Check the **docstring** — the LLM uses this to decide when to call. Make
   it explicit. "Use this when the user asks about X."
4. Uvicorn logs the JSON body sent to OpenAI at DEBUG level. Turn on:
   `logging.getLogger("openai").setLevel(logging.DEBUG)`.
5. Look for `tools:` in the debug output. Is your tool there? Is the schema
   right?

### "RAG is returning irrelevant chunks"

1. Confirm the chunks landed. In psql:
   ```sql
   SELECT COUNT(*) FROM document_chunks WHERE document_id = 'yourDocId';
   ```
2. Look at a few:
   ```sql
   SELECT chunk_index, LEFT(content, 100) FROM document_chunks
   WHERE document_id = 'yourDocId' ORDER BY chunk_index LIMIT 5;
   ```
3. Run the same query manually:
   ```python
   from app.services.rag_service import retrieve_relevant_chunks
   chunks = await retrieve_relevant_chunks(db, user_id, "your question")
   for c in chunks:
       print(c['score'], c['content'][:80])
   ```
4. If scores are < 0.5, your question phrasing differs too much from the
   chunk content. Try rewording, or add a HyDE step (see Module 06).

### "One stock's analysis is broken but others work"

1. Check uvicorn logs for the specific symbol. There's probably an exception
   for that seed.
2. Look at whether the indicator DataFrame has NaN in the last row. When
   there aren't enough candles, EMA50 is NaN → the setup detector short-circuits.
3. Add `if len(candles) < 60: raise ValueError(...)` at the top of
   `run_analysis()` to fail loudly.

### "PDF processing hangs at 'PROCESSING' forever"

1. Uvicorn logs will show the last step reached — likely the vision phase.
2. Check if OpenAI is rate-limiting (429 responses). Reduce
   `vision_concurrency` in `.env`.
3. Check the file size — pymupdf can OOM on 500MB PDFs. Add a size cap in
   the multer middleware.

### "prisma db push says table exists but Postgres says it doesn't"

- You're pointing at two different databases. Compare the DATABASE_URL in
  `backend-node/.env` and root `.env`.
- Or the wrong port (5432 vs 5433).

## Poking around the DB — the essentials

Every debugging session, you'll want to look at the data. Two ways:

### Prisma Studio (recommended)

```powershell
cd backend-node
npx prisma studio
```

Opens http://localhost:5555 — visual browser for every table. Click rows,
inspect JSON columns, filter.

### psql

```powershell
docker exec -it trade_postgres psql -U postgres -d trade_analyser
```

Then:
```sql
-- What tables exist?
\dt

-- Describe a table:
\d document_chunks

-- Count by source_type:
SELECT metadata->>'source_type' AS type, COUNT(*)
FROM document_chunks
GROUP BY 1;

-- Latest 5 chat sessions:
SELECT * FROM chat_sessions ORDER BY created_at DESC LIMIT 5;

-- Any embeddings with the wrong dimension?
SELECT id, LENGTH(embedding::text) FROM document_chunks LIMIT 3;
```

`\q` to quit.

## Poking around the vector data

The embedding column is huge and unreadable. But you CAN inspect distances:

```sql
-- Given a chunk you like (id=42), find the 5 most similar chunks:
SELECT id, LEFT(content, 60), 1 - (embedding <=> (SELECT embedding FROM document_chunks WHERE id=42)) AS score
FROM document_chunks
WHERE id != 42
ORDER BY embedding <=> (SELECT embedding FROM document_chunks WHERE id=42)
LIMIT 5;
```

If the results are semantic neighbours — retrieval is working. If they look
random — either the embeddings are broken, or the HNSW index is corrupted.

## Reading Node's structured logs

We use Winston in dev format:

```
23:56:50 [error]: Python AI service error: <object>  { url: '/ai/documents/process', status: 500 }
```

The `{ ... }` at the end is the metadata bag. Look for:
- `url` — which endpoint.
- `status` — the HTTP code.
- `message` — the error string (often a stack trace inside).

## Reading Python's structured logs

```
2026-06-30 22:26:41,003 [INFO] app.services.rag_service: Retrieved 5 chunks
2026-06-30 22:26:41,157 [ERROR] app.main: Traceback (most recent call last): ...
```

Format: `<timestamp> [<level>] <logger name>: <message>`. The logger name
tells you which file logged it — jump there.

## The one-hour recovery drill

If everything is broken and you have no idea why:

1. `docker compose ps` — is Postgres healthy?
2. `docker compose logs postgres | tail -30` — any errors?
3. `cd backend-python && .venv\Scripts\Activate.ps1 && python -c "from app.main import app; print('ok')"` — do imports succeed?
4. `cd backend-node && npm run dev` — does it boot? First 10 log lines matter.
5. `cd frontend && Remove-Item -Recurse -Force .next-dev && npm run dev` — fresh compile.
6. Hard refresh the browser.
7. Register a new user (skip auth complexity from prior sessions).
8. Try the simplest endpoint: `curl http://localhost:8000/health`.

If step 8 doesn't return `{"status": "ok"}`, Python is your problem. Everything
downstream is a symptom.

## The three commands to remember

| Command | When to run |
|---|---|
| `docker compose ps` | Anytime you're unsure if DBs are up. |
| `npx prisma db push` | Anytime the Prisma schema changed. |
| `Remove-Item -Recurse -Force .next-dev; npm run dev` | Anytime `options.factory undefined` appears in the browser. |

## Wrap-up

You now know how the whole stack fits together, what every folder does, how
to call the AI features, how to read the data, and how to fix things when
they break.

Go back to the [README](./README.md) and skim the module titles again — you
should be able to explain each in one sentence. If you can, you've absorbed
the architecture.

The best learning from here is **making changes**. Pick a small feature idea
from module 09 ("filters on the Recommendations page") or module 06 ("HyDE
step for RAG") and implement it end-to-end. Break things. Fix them. That's
the loop that turns understanding into fluency.

Good luck. Ping me any time you want another module or a deeper dive on a
topic.
