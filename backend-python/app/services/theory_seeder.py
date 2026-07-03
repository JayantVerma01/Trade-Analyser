"""
Theory Seeder — Approach 3.

Embeds the built-in trading theory knowledge base into pgvector.
Chunks are stored under user_id='__builtin__' so they are available
during RAG retrieval for all users.

Call POST /ai/documents/seed-builtin to run this once after deployment.
Idempotent: clears existing builtin chunks before re-inserting.
"""

import json
import logging
from typing import Any, Dict, List, Tuple

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.services.builtin_theory.content import BUILTIN_THEORIES

logger = logging.getLogger(__name__)

BUILTIN_USER_ID = "__builtin__"
CHUNK_SIZE      = 800
CHUNK_OVERLAP   = 150
BATCH_SIZE      = 50


def _split_theory(title: str, content: str) -> List[str]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " "],
        length_function=len,
    )
    raw = splitter.split_text(content.strip())
    # Prefix every chunk with the title so it's self-identifying in RAG results
    return [f"[{title}]\n{chunk}" for chunk in raw]


async def seed_builtin_theories(db: AsyncSession) -> Dict[str, Any]:
    """
    Delete all existing builtin chunks, then embed and store all 15 theory documents.
    Returns summary with chunk count.
    """
    # 1. Clear existing builtin data
    await db.execute(
        text("DELETE FROM document_chunks WHERE user_id = :uid"),
        {"uid": BUILTIN_USER_ID},
    )
    await db.commit()
    logger.info("Cleared existing builtin theory chunks")

    # 2. Build (doc_id, title, chunk_text) tuples
    all_items: List[Tuple[str, str, str]] = []
    for theory in BUILTIN_THEORIES:
        doc_id = f"builtin_{theory['id']}"
        chunks = _split_theory(theory["title"], theory["content"])
        for chunk in chunks:
            all_items.append((doc_id, theory["title"], chunk))

    logger.info(f"Prepared {len(all_items)} chunks across {len(BUILTIN_THEORIES)} theories")

    # 3. Embed and store in batches
    embeddings_model = OpenAIEmbeddings(
        model=settings.openai_embedding_model,
        openai_api_key=settings.openai_api_key,
    )

    stored = 0
    for batch_start in range(0, len(all_items), BATCH_SIZE):
        batch    = all_items[batch_start: batch_start + BATCH_SIZE]
        texts    = [item[2] for item in batch]
        vectors  = await embeddings_model.aembed_documents(texts)

        for idx_in_batch, ((doc_id, title, chunk), vector) in enumerate(zip(batch, vectors)):
            chunk_idx = batch_start + idx_in_batch
            metadata  = json.dumps({
                "source":  "builtin",
                "title":   title,
                "doc_id":  doc_id,
            })
            await db.execute(
                text("""
                    INSERT INTO document_chunks
                        (document_id, user_id, chunk_index, content, embedding, metadata)
                    VALUES
                        (:doc_id, :user_id, :idx, :content, :embedding, CAST(:metadata AS jsonb))
                """),
                {
                    "doc_id":    doc_id,
                    "user_id":   BUILTIN_USER_ID,
                    "idx":       chunk_idx,
                    "content":   chunk,
                    "embedding": f"[{','.join(str(v) for v in vector)}]",
                    "metadata":  metadata,
                },
            )
            stored += 1

        await db.commit()
        logger.info(f"Seeded {stored}/{len(all_items)} builtin chunks")

    return {
        "status":          "seeded",
        "theories_count":  len(BUILTIN_THEORIES),
        "chunks_stored":   stored,
    }


async def is_seeded(db: AsyncSession) -> bool:
    """Return True if builtin theories are already embedded."""
    result = await db.execute(
        text("SELECT COUNT(*) FROM document_chunks WHERE user_id = :uid"),
        {"uid": BUILTIN_USER_ID},
    )
    count = result.scalar()
    return (count or 0) > 0
