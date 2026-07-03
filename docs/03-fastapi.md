# Module 03 — FastAPI Explained

FastAPI is the Python web framework we use for the AI service. Mental model:
**it's Express.js for Python**, plus auto-generated API docs and Pydantic
validation.

## The core building blocks

| Concept | FastAPI | Express equivalent |
|---|---|---|
| App instance | `app = FastAPI()` | `const app = express()` |
| Sub-router | `router = APIRouter()` | `const router = express.Router()` |
| Route | `@router.get("/foo")` | `router.get("/foo", handler)` |
| JSON body validation | Pydantic model in function args | Zod middleware |
| Middleware | `Depends()` on the function | `app.use(...)` |
| Return JSON | `return {...}` | `res.json({...})` |
| Async I/O | `async def` | `async` handler |

## App entry point

Open `backend-python/app/main.py`. It does five things in order:

```python
1. Configure logging (so every log line has timestamp + level + module).
2. Define a `lifespan` handler — code that runs at startup and shutdown.
3. Create the FastAPI app (with title / description for auto-docs).
4. Add CORS middleware (so the browser can call it).
5. Mount routers — each `include_router()` call attaches a feature area.
```

That means every folder under `app/routers/` becomes a group of endpoints:

```python
app.include_router(rag.router,             prefix="/ai", tags=["RAG & Documents"])
app.include_router(market.router,          prefix="/ai", tags=["Market Data"])
app.include_router(analysis.router,        prefix="/ai", tags=["Analysis"])
app.include_router(strategy.router,        prefix="/ai", tags=["Strategy Engine"])
app.include_router(agent.router,           prefix="/ai", tags=["AI Agent"])
app.include_router(backtest.router,        prefix="/ai", tags=["Backtesting"])
app.include_router(broker.router,          prefix="/ai", tags=["Broker"])
app.include_router(recommendations.router, prefix="/ai", tags=["Recommendations"])
```

`prefix="/ai"` prepends `/ai` to every URL. So `POST /analysis/stock` inside
`analysis.py` actually serves at `/ai/analysis/stock`. That's why the Node
proxy calls `http://localhost:8000/ai/...`.

## Anatomy of a router file

Every file in `backend-python/app/routers/` follows the same shape. Let's read
`app/routers/recommendations.py`:

```python
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.middleware.auth import verify_internal_request
from app.services.recommendation_service import (
    get_recommendations, list_sectors, search_symbols,
)

router = APIRouter()


class RecommendationRequest(BaseModel):
    trading_style: str
    sector:        Optional[str] = None
    symbols:       Optional[List[str]] = None
    capital:       float = Field(default=100_000, gt=0)
    risk_pct:      float = Field(default=1.0, gt=0, le=10)
    top_n:         int   = Field(default=5, ge=1, le=50)


@router.get("/recommendations/sectors")
async def sectors_endpoint(_: None = Depends(verify_internal_request)):
    return list_sectors()


@router.post("/recommendations/scan")
async def scan_endpoint(
    req: RecommendationRequest,
    _:   None = Depends(verify_internal_request),
):
    try:
        result = await get_recommendations(...)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
```

Break that down:

1. **Imports** — bring in FastAPI classes, the Pydantic base, our auth middleware, and the service functions that do the actual work.
2. **`router = APIRouter()`** — creates a group we'll attach routes to.
3. **`class RecommendationRequest`** — Pydantic model describing the JSON body. FastAPI reads the function signature, sees this type, and automatically parses + validates.
4. **`@router.get("/recommendations/sectors")`** — decorator registers the URL.
5. **`Depends(verify_internal_request)`** — dependency injection. Runs the given function BEFORE the handler; if it raises, the handler never runs. This is our auth guard. Same idea as `router.get("/x", authenticate, handler)` in Express, but Python injects the result into your function as an argument (we discard it with `_`).
6. **`raise HTTPException(status_code=400, ...)`** — how you send an error response.

## Dependency injection

`Depends()` is FastAPI's killer feature. You declare "this function needs a DB
session, an authenticated user, and a rate-limit check" — and FastAPI wires them
up:

```python
@router.post("/documents/process")
async def process_document_endpoint(
    request: ProcessDocumentRequest,           # body — from JSON
    db:  AsyncSession = Depends(get_db),       # DB session — created per request
    _:   None         = Depends(verify_internal_request),   # auth guard
):
    ...
```

The pattern:
- Body: type-annotate as a Pydantic model.
- Query params: type-annotate as `str`, `int`, `Optional[str]`, etc.
- Path params: put `{name}` in the URL and add `name: str` to args.
- Anything else (DB, auth, current user): use `Depends()`.

Compare to Express, where you'd pull the DB from `req.app.locals`, the user from
`req.user`, and hope you remembered to wire the middleware. FastAPI makes each
dependency explicit in the signature — much easier to grep.

## Pydantic in depth

Pydantic models do TWO jobs:

1. **Parse and validate incoming JSON**.
2. **Serialize outgoing objects to JSON** (with `response_model=...`).

Look at `backend-python/app/models/schemas.py` — it's our central "types" file
(equivalent to `frontend/types/index.ts`).

```python
class TheoryChatRequest(BaseModel):
    user_id: str
    message: str
    session_id: str = "default"
    history: List[ChatMessage] = Field(default_factory=list)
```

If the client sends `{"user_id": "abc", "message": "hi"}`, Pydantic fills in
`session_id="default"` and `history=[]` automatically.

If the client sends `{"user_id": 123, "message": "hi"}`, Pydantic will TRY
to convert `123` to `"123"` (loose mode by default). To be strict:
`user_id: str = Field(strict=True)`.

If the client sends `{"message": "hi"}` (missing user_id), FastAPI returns 422
with a helpful error body — no code needed.

## The `main.py` startup pattern

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Python AI service...")
    await create_tables()                 # ensure pgvector tables exist
    logger.info("✅ Database ready")
    yield
    logger.info("Shutting down Python AI service")

app = FastAPI(lifespan=lifespan, ...)
```

Everything before `yield` runs at startup. Everything after runs at shutdown.
Similar to `.on('SIGTERM')` in Node, but declared as an async generator. This
is where we create the `document_chunks` table if it doesn't exist.

## Auto docs — a superpower

Visit `http://localhost:8000/docs` while uvicorn is running. FastAPI reads
every route, every Pydantic model, every parameter type, and renders a live
Swagger UI:

- Every endpoint is grouped by its `tags=[...]`.
- Every body model is documented with field types and defaults.
- You can hit "Try it out" and call the endpoint from the browser.

This is why we're careful with type hints — they power the docs, the
validation, and the auto-complete in your IDE all at once.

The same info in JSON is at `http://localhost:8000/openapi.json`.

## The middleware layer

`backend-python/app/middleware/auth.py` is 15 lines total:

```python
async def verify_internal_request(
    x_internal_secret: str = Header(default=None, alias="X-Internal-Secret"),
) -> None:
    if x_internal_secret != settings.jwt_secret:
        raise HTTPException(status_code=403, detail="Unauthorized internal request")
```

`Header(...)` tells FastAPI to pull the value from the `X-Internal-Secret`
request header. It becomes a normal function argument. Node always sends this
header with the shared JWT secret when calling Python — a lightweight way to
say "only my Node service should be able to hit my Python service."

## Adding a new endpoint — the checklist

Say you want to add `POST /ai/market/status` that returns whether the market
is open. Steps:

1. In `backend-python/app/routers/market.py`, add:
   ```python
   @router.get("/market/status")
   async def market_status(_: None = Depends(verify_internal_request)):
       return {"is_open": is_market_open(), "next_open_ts": ...}
   ```
2. In `backend-python/app/services/market_calendar.py` (create if needed),
   implement `is_market_open()`.
3. Uvicorn auto-reloads. Test via http://localhost:8000/docs.
4. In `backend-node/src/services/ai.service.ts`, add:
   ```typescript
   async getMarketStatus() {
       const r = await this.client.get('/ai/market/status');
       return r.data;
   }
   ```
5. In `backend-node/src/modules/market/market.controller.ts`, add a
   controller function that calls `aiService.getMarketStatus()`.
6. Add the route in `market.routes.ts`.
7. In `frontend/lib/api/market.api.ts`, add a `getStatus()` axios call to
   `/api/market/status`.

The pattern is consistent for every new AI feature: Python does the work,
Node proxies with auth, frontend calls Node.

## Files map — the routers folder

```
backend-python/app/routers/
├── rag.py               # /ai/documents/process, /ai/chat/theory, seed builtin
├── market.py            # /ai/market/candles, /ai/market/quote, /ai/market/symbols
├── analysis.py          # /ai/analysis/stock, /ai/analysis/recent
├── strategy.py          # /ai/strategy/evaluate, /ai/strategy/scan, /ai/strategy/meta
├── agent.py             # /ai/agent/trade-query — LangGraph entry point
├── backtest.py          # /ai/backtest/run
├── broker.py            # /ai/broker/account, positions, orders, holdings
└── recommendations.py   # /ai/recommendations/scan, /ai/recommendations/search
```

Each file follows the same pattern shown above. Once you can read
`recommendations.py`, you can read them all.

Head to **[Module 04 — Postgres, Prisma & pgvector](./04-postgres-and-prisma.md)** next.
