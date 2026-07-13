import logging
from typing import List, Dict, Any

from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.schemas import SourceChunk, TheoryChatResponse

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a trading theory assistant for an Indian stock market trader.

You answer questions based on the provided trading theory context (which includes both the user's
uploaded documents AND a built-in knowledge base of professional trading theory).

Some context chunks are derived from IMAGES in the original PDF — candlestick chart screenshots,
indicator diagrams, pattern illustrations. These are marked with [VISUAL — Page N] in the context.
Treat visual chunks as authoritative descriptions of what the trader was shown on that page; when a
visual chunk answers the question, cite it as e.g. "(see visual on page 14)".

Rules you MUST follow:
1. Only use information from the provided context chunks. Never invent rules or statistics.
2. If the answer is not found in the provided context, say exactly: "I could not find this in the available trading theory. Please upload more specific documents or ask a different question."
3. Always cite which source you are referencing (e.g., [Dow Theory], [RSI Analysis], the document name, or visual page references).
4. Keep answers clear, structured, and practical for Indian stock market traders.
5. If the question is about a specific rule (e.g., entry, stop loss, position sizing), quote the exact rule from the context.
6. If multiple sources agree on a point, mention that — it strengthens the answer.
7. When the user asks about candlestick patterns or chart setups and the visual chunks describe them, prefer the visual description over generic text — it reflects what the trader actually saw.

Context from trading theory knowledge base:
{context}"""


async def retrieve_relevant_chunks(
    db: AsyncSession,
    user_id: str,
    query: str,
    top_k: int = None,
) -> List[Dict[str, Any]]:
    """Find top-k most relevant chunks for a query using cosine similarity."""
    top_k = top_k or settings.retrieval_top_k

    embeddings_model = OpenAIEmbeddings(
        model=settings.openai_embedding_model,
        openai_api_key=settings.openai_api_key,
    )
    query_vector = await embeddings_model.aembed_query(query)
    vector_str = f"[{','.join(str(v) for v in query_vector)}]"

    result = await db.execute(
        text("""
            SELECT
                document_id,
                chunk_index,
                content,
                user_id,
                metadata,
                1 - (embedding <=> CAST(:query_vec AS vector)) AS score
            FROM document_chunks
            WHERE user_id = :user_id OR user_id = '__builtin__'
            ORDER BY embedding <=> CAST(:query_vec AS vector)
            LIMIT :top_k
        """),
        {"query_vec": vector_str, "user_id": user_id, "top_k": top_k},
    )

    rows = result.fetchall()
    chunks = []
    for row in rows:
        meta = row.metadata or {}
        chunks.append({
            "document_id": row.document_id,
            "chunk_index": row.chunk_index,
            "content":     row.content,
            "score":       float(row.score),
            "is_builtin":  row.user_id == "__builtin__",
            "source_type": meta.get("source_type", "text"),
            "page":        meta.get("page"),
        })
    return chunks


async def answer_theory_question(
    db: AsyncSession,
    user_id: str,
    message: str,
    history: List[Dict[str, str]],
    session_id: str,
) -> TheoryChatResponse:
    """RAG pipeline: retrieve chunks → build prompt → call LLM → return answer."""

    # Check if ANY searchable chunks exist (user's own docs OR builtin)
    count_result = await db.execute(
        text("SELECT COUNT(*) FROM document_chunks WHERE user_id = :uid OR user_id = '__builtin__'"),
        {"uid": user_id},
    )
    total_chunks = count_result.scalar()

    if total_chunks == 0:
        return TheoryChatResponse(
            answer=(
                "No trading theory knowledge base is available yet. "
                "Please go to the Documents page and upload your trading theory PDFs, "
                "or ask an admin to run the built-in theory seeding (POST /ai/documents/seed-builtin)."
            ),
            sources=[],
            found_in_theory=False,
            session_id=session_id,
        )

    # Retrieve relevant chunks
    chunks = await retrieve_relevant_chunks(db, user_id, message)

    if not chunks or chunks[0]["score"] < 0.3:
        return TheoryChatResponse(
            answer=(
                "I could not find this in the available trading theory knowledge base. "
                "Try rephrasing your question, or upload more specific theory documents."
            ),
            sources=[
                SourceChunk(
                    document_id=c["document_id"],
                    chunk_index=c["chunk_index"],
                    content=c["content"][:200] + "...",
                    score=c["score"],
                    is_builtin=c.get("is_builtin", False),
                    source_type=c.get("source_type", "text"),
                    page=c.get("page"),
                )
                for c in chunks
            ],
            found_in_theory=False,
            session_id=session_id,
        )

    # Build context string — distinguish visual chunks so the LLM knows which
    # ones came from images and can cite them appropriately.
    context_parts = []
    for i, chunk in enumerate(chunks):
        tag = "VISUAL — Page " + str(chunk.get("page") or "?") if chunk.get("source_type") == "image" else "TEXT"
        context_parts.append(
            f"[Chunk {i + 1} | {tag} | Score: {chunk['score']:.2f}]\n{chunk['content']}"
        )
    context = "\n\n---\n\n".join(context_parts)

    # Build LLM messages
    llm = ChatOpenAI(
        model=settings.openai_model,
        openai_api_key=settings.openai_api_key,
        temperature=0.1,       # Low temp for factual retrieval
        max_tokens=1500,        # allow rich, multi-paragraph answers with citations
    )

    messages = [SystemMessage(content=SYSTEM_PROMPT.format(context=context))]

    # Add conversation history (last 6 turns to limit tokens)
    for msg in history[-6:]:
        if msg["role"] == "user":
            messages.append(HumanMessage(content=msg["content"]))
        elif msg["role"] == "assistant":
            messages.append(AIMessage(content=msg["content"]))

    messages.append(HumanMessage(content=message))

    response = await llm.ainvoke(messages)
    answer = response.content

    return TheoryChatResponse(
        answer=answer,
        sources=[
            SourceChunk(
                document_id=c["document_id"],
                chunk_index=c["chunk_index"],
                content=c["content"][:300] + ("..." if len(c["content"]) > 300 else ""),
                score=c["score"],
                is_builtin=c.get("is_builtin", False),
                source_type=c.get("source_type", "text"),
                page=c.get("page"),
            )
            for c in chunks
        ],
        found_in_theory=True,
        session_id=session_id,
    )
