import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.postgres import create_tables
from app.routers import rag, market, analysis, strategy, agent, backtest, broker, recommendations

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Python AI service...")
    await create_tables()
    logger.info("✅ Database ready")
    yield
    logger.info("Shutting down Python AI service")


app = FastAPI(
    title="Trade Analyser — AI Service",
    description="RAG, indicators, strategy engine, and LangGraph agent backend",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(rag.router,      prefix="/ai", tags=["RAG & Documents"])
app.include_router(market.router,   prefix="/ai", tags=["Market Data"])
app.include_router(analysis.router, prefix="/ai", tags=["Analysis"])
app.include_router(strategy.router, prefix="/ai", tags=["Strategy Engine"])
app.include_router(agent.router,    prefix="/ai", tags=["AI Agent"])
app.include_router(backtest.router, prefix="/ai", tags=["Backtesting"])
app.include_router(broker.router,           prefix="/ai", tags=["Broker"])
app.include_router(recommendations.router,  prefix="/ai", tags=["Recommendations"])


# ─── Health ───────────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health():
    return {
        "status": "ok",
        "service": "trade-analyser-python",
    }
