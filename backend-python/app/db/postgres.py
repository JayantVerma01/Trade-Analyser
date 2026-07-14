import logging
from urllib.parse import urlsplit, urlunsplit, parse_qs, urlencode

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text

from app.config import settings

logger = logging.getLogger(__name__)


def _prepare_asyncpg_url(raw_url: str) -> tuple[str, dict]:
    """
    Normalize a Postgres URL for SQLAlchemy + asyncpg.

    Neon, Supabase, and libpq-style connection strings put SSL config in the
    query as `?sslmode=require`. asyncpg does not accept `sslmode` — it uses
    the `ssl` parameter passed via connect_args. We strip `sslmode` (and a
    few other libpq-only params) from the URL and translate them into
    connect_args so the URL works either way.
    """
    # Force the asyncpg driver
    url = raw_url.replace("postgres://", "postgresql://")
    if url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://"):]

    parts = urlsplit(url)
    query = parse_qs(parts.query, keep_blank_values=False)

    connect_args: dict = {}
    sslmode = (query.pop("sslmode", [None])[0] or "").lower()
    if sslmode in ("require", "verify-ca", "verify-full", "prefer", "allow"):
        connect_args["ssl"] = True   # asyncpg validates certs by default
    elif sslmode == "disable":
        connect_args["ssl"] = False

    # Drop other libpq-only params asyncpg doesn't understand
    for libpq_only in ("channel_binding", "application_name", "options"):
        query.pop(libpq_only, None)

    new_query = urlencode({k: v[0] for k, v in query.items()})
    cleaned = urlunsplit((parts.scheme, parts.netloc, parts.path, new_query, parts.fragment))
    return cleaned, connect_args


DATABASE_URL, _CONNECT_ARGS = _prepare_asyncpg_url(settings.database_url)

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_size=10,
    max_overflow=20,
    connect_args=_CONNECT_ARGS,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def create_tables():
    """Create document_chunks table with pgvector support."""
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS document_chunks (
                id          SERIAL PRIMARY KEY,
                document_id TEXT NOT NULL,
                user_id     TEXT NOT NULL,
                chunk_index INTEGER NOT NULL,
                content     TEXT NOT NULL,
                embedding   vector(1536),
                metadata    JSONB DEFAULT '{}',
                created_at  TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_doc_chunks_document_id
            ON document_chunks (document_id)
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_doc_chunks_user_id
            ON document_chunks (user_id)
        """))
        # IVFFlat index for fast ANN search (build after inserting enough data)
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_doc_chunks_embedding
            ON document_chunks USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = 10)
        """))
    logger.info("document_chunks table and indexes ready")
