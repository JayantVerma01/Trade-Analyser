# Module 04 — Postgres, Prisma & pgvector

Our app uses three data stores. This module makes each one concrete.

| Store | What lives there | How we talk to it |
|---|---|---|
| **Postgres** (with pgvector extension) | Users, documents metadata, strategies, paper trades, journal, backtests **AND** the vector chunks | Prisma from Node, raw SQL via SQLAlchemy from Python |
| **MongoDB** | Chat session history (not critical, can be replaced) | Mongo driver from Node |
| **File system / uploads folder** | The original PDFs | `multer` on upload, `fs` on read |

## Postgres 101 (for someone new to SQL)

A **relational database** stores data in **tables**. Each table has typed
**columns** and holds many **rows**. Rows in different tables link via **foreign
keys**.

Our `users` table:

```
┌─────────────────┬──────────┬─────────┬─────────────────────┐
│ id              │ email    │ name    │ created_at          │
├─────────────────┼──────────┼─────────┼─────────────────────┤
│ cmxk9a8w7000... │ a@x.com  │ Alice   │ 2026-06-25 10:00:00 │
│ cmyz32k1b000... │ b@x.com  │ Bob     │ 2026-06-27 14:22:00 │
└─────────────────┴──────────┴─────────┴─────────────────────┘
```

Our `theory_documents` table has a `user_id` column that stores an id from
`users`. That's a foreign key. When you delete a user, cascading rules can
automatically delete their documents.

To query, you write **SQL**:

```sql
SELECT id, original_name FROM theory_documents WHERE user_id = 'cmxk9a8w7000...';
```

## Prisma — an ORM

Writing SQL for every query is tedious. **Prisma** is an ORM (Object-Relational
Mapper) — you define your schema in one file, and it generates a type-safe
JavaScript client:

```typescript
const docs = await prisma.theoryDocument.findMany({
  where:   { userId: 'cmxk...' },
  orderBy: { createdAt: 'desc' },
});
```

That runs the same SELECT under the hood — but with autocomplete, type safety,
and no SQL injection risk.

## The Prisma schema file

Open `backend-node/prisma/schema.prisma`. It has three sections.

### 1. Generator

```prisma
generator client {
  provider = "prisma-client-js"
}
```

Tells Prisma to generate a JavaScript client. When you run `npx prisma
generate`, this creates `node_modules/@prisma/client/` with your typed queries.

### 2. Datasource

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Where the DB is. Reads from `.env`.

### 3. Models

Each `model` becomes a table. Example:

```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String   @map("password_hash")
  name         String
  createdAt    DateTime @default(now()) @map("created_at")

  settings    UserSettings?
  documents   TheoryDocument[]

  @@map("users")
}
```

- `@id` — primary key.
- `@default(cuid())` — auto-generate a collision-resistant ID.
- `@unique` — enforce uniqueness in the DB.
- `@map("password_hash")` — column name in Postgres (Prisma likes camelCase, Postgres likes snake_case).
- `settings UserSettings?` — a **relation** to another model (one-to-one).
- `documents TheoryDocument[]` — one-to-many relation.
- `@@map("users")` — table name in Postgres.

## The migration workflow

Whenever you change `schema.prisma`, you have to sync the DB:

```powershell
cd backend-node
npx prisma db push        # for dev — updates schema without migration files
# OR
npx prisma migrate dev    # for shared repos — creates a versioned migration file
```

`db push` is fast but doesn't create history. `migrate dev` creates a SQL file
in `prisma/migrations/` — that's the proper way for a team project.

You can always regenerate the client after schema changes:

```powershell
npx prisma generate
```

## Prisma Studio — the killer debugging tool

```powershell
cd backend-node
npx prisma studio
```

Opens a browser UI (http://localhost:5555) where you can:

- Browse every table
- Inspect rows
- Edit values inline (be careful — writes go straight to the DB)
- Add rows manually

Learn this now. It's the fastest way to answer "does this row actually exist?"
when debugging.

## Python's DB layer — SQLAlchemy

Node uses Prisma. Python uses **SQLAlchemy** — a different ORM, but for our
use case we mostly use raw SQL because we do vector operations that Prisma
doesn't support.

Open `backend-python/app/db/postgres.py`:

```python
engine = create_async_engine(settings.database_url, echo=False, future=True)
AsyncSessionLocal = async_sessionmaker(engine, ...)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
```

That's the pattern. `get_db` is a dependency — routes use `Depends(get_db)` to
receive a session, and it gets cleaned up automatically.

Actual queries look like:

```python
await db.execute(
    text("SELECT * FROM document_chunks WHERE user_id = :uid"),
    {"uid": user_id},
)
```

`text(...)` marks a raw SQL string. The `:uid` becomes a parameter — never
concatenate strings, or you invite SQL injection.

## pgvector — the vector extension

Postgres by itself can't do "find the 5 rows most similar to this vector."
The **pgvector** extension adds:

- A `vector(N)` column type — stores an array of `N` floats.
- Distance operators: `<->` (Euclidean), `<=>` (cosine), `<#>` (dot product).
- An index type (HNSW / IVFFlat) for fast nearest-neighbour search.

Look at `docker/postgres/init.sql`. Postgres runs it on first startup:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS document_chunks (
    id           BIGSERIAL PRIMARY KEY,
    document_id  TEXT NOT NULL,
    user_id      TEXT NOT NULL,
    chunk_index  INT  NOT NULL,
    content      TEXT NOT NULL,
    embedding    vector(1536) NOT NULL,
    metadata     JSONB DEFAULT '{}'
);

CREATE INDEX ... ON document_chunks USING hnsw (embedding vector_cosine_ops);
```

- `vector(1536)` — every embedding is 1,536 floats (that's the size of
  OpenAI's `text-embedding-3-small`).
- The HNSW index makes cosine-similarity searches over millions of rows near-instant.

The RAG retrieval query in `rag_service.py`:

```sql
SELECT ..., 1 - (embedding <=> CAST(:query_vec AS vector)) AS score
FROM document_chunks
WHERE user_id = :user_id OR user_id = '__builtin__'
ORDER BY embedding <=> CAST(:query_vec AS vector)
LIMIT :top_k
```

`<=>` is cosine distance (0 = identical, 2 = opposite). We invert it into a
score `1 - distance` so higher = more similar.

## The `document_chunks` table — read a row

Let's open Prisma Studio and look. Or run raw SQL from the Postgres container:

```powershell
docker exec -it trade_postgres psql -U postgres -d trade_analyser
```

Inside psql:

```sql
\d document_chunks              -- describe schema
SELECT document_id, chunk_index, LEFT(content, 60), metadata->>'source_type'
  FROM document_chunks LIMIT 10;
```

You'll see something like:

```
     document_id     | chunk_index |                     left                     | ?column?
---------------------+-------------+----------------------------------------------+----------
 builtin_dow_theory  |           0 | [Dow Theory & Market Structure]              | text
 builtin_rsi         |           4 | [RSI Analysis] Overbought > 70, oversold ... | text
 cmr0za0gu0003fx...  |          17 | [Page 12 — Visual] Bullish engulfing pat...  | image
```

That's the entire vector store, in raw form. The vectors themselves are hidden
because they're 1,536 numbers wide — but you can select `LENGTH(embedding::text)`
to confirm they're there.

Common commands inside `psql`:

| Command | What it does |
|---|---|
| `\l` | List all databases |
| `\c dbname` | Connect to a database |
| `\dt` | List tables |
| `\d table_name` | Show table structure |
| `\q` | Quit |

## Debugging DB issues — a checklist

- **"Column does not exist"**: schema is out of sync. Run `npx prisma db push`.
- **"Relation does not exist"**: the table isn't created. Same fix.
- **"Extension vector does not exist"**: you started a fresh Postgres without pgvector. Use the image `pgvector/pgvector:pg15` from docker-compose, not vanilla `postgres`.
- **Slow vector search**: HNSW index missing. Check `\d document_chunks` — you should see an entry like `document_chunks_embedding_hnsw`.
- **"Duplicate key" on insert**: existing row conflicts on a unique field.

## Two databases, one .env — the URL gotcha

Python uses **asyncpg** (async driver). Prisma uses the regular **libpq**
driver. They need different URL prefixes:

```
DATABASE_URL=postgresql+asyncpg://postgres:trade_pass@localhost:5433/trade_analyser
                        ^^^^^^^^^^ Python

DATABASE_URL=postgresql://postgres:trade_pass@localhost:5433/trade_analyser
                        ^^^^^ Node/Prisma
```

That's why `backend-node/.env` has its own `DATABASE_URL` without the
`+asyncpg` — see module 01 for the full explanation.

## MongoDB — chat history

Chat sessions live in Mongo because they're semi-structured JSON documents.
This is optional infrastructure — if MongoDB is down the app still runs, you
just don't see prior chat turns.

Open Mongo shell:

```powershell
docker exec -it trade_mongodb mongosh -u mongo_user -p mongo_pass
```

Then:

```javascript
use trade_analyser
db.chat_sessions.find().pretty().limit(5)
```

## The upload folder

PDF binaries live at `backend-node/uploads/`. On production you'd move these
to S3 or Cloudflare R2 — but for local dev they're just files.

Never delete the folder while the DB thinks docs still exist there — you'll
end up with orphaned rows that fail on reprocess.

## Cheat sheet

- Look at rows without writing code: `npx prisma studio`.
- Read raw SQL responses: `docker exec -it trade_postgres psql -U postgres -d trade_analyser`.
- Sync schema: `npx prisma db push`.
- Reset schema completely (dev only, DESTROYS DATA): `npx prisma db push --force-reset`.
- See migration history: `\dt _prisma_migrations` (only after `migrate dev`).

Head to **[Module 05 — LangChain Fundamentals](./05-langchain-fundamentals.md)**.
