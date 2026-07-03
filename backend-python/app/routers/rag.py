from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres import get_db
from app.models.schemas import (
    ProcessDocumentRequest,
    ProcessDocumentResponse,
    TheoryChatRequest,
    TheoryChatResponse,
)
from app.services.document_processor import process_document, delete_document_chunks
from app.services.rag_service import answer_theory_question
from app.services.theory_seeder import seed_builtin_theories, is_seeded
from app.middleware.auth import verify_internal_request

router = APIRouter()


@router.post("/documents/process", response_model=ProcessDocumentResponse)
async def process_document_endpoint(
    request: ProcessDocumentRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_internal_request),
):
    """
    Called by Node.js backend to process a newly uploaded document.
    Extracts text, chunks it, generates embeddings, stores in pgvector.
    """
    try:
        result = await process_document(
            db=db,
            document_id=request.document_id,
            user_id=request.user_id,
            file_path=request.file_path,
        )
        return ProcessDocumentResponse(
            document_id=result["document_id"],
            chunk_count=result["chunk_count"],
            text_chunk_count=result.get("text_chunk_count", 0),
            image_chunk_count=result.get("image_chunk_count", 0),
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")


@router.delete("/documents/{document_id}/chunks")
async def delete_chunks_endpoint(
    document_id: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_internal_request),
):
    """Remove all pgvector chunks for a document (called on delete/reprocess)."""
    await delete_document_chunks(db, document_id)
    return {"status": "deleted", "document_id": document_id}


@router.post("/documents/seed-builtin")
async def seed_builtin_endpoint(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_internal_request),
):
    """
    Embed all 15 built-in trading theory documents into pgvector.
    Idempotent — safe to call multiple times (re-seeds from scratch).
    Run once after first deployment or after theory content is updated.
    """
    try:
        result = await seed_builtin_theories(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Seeding failed: {str(e)}")


@router.get("/documents/seed-builtin/status")
async def seed_builtin_status(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_internal_request),
):
    """Check whether the built-in theory knowledge base has been seeded."""
    seeded = await is_seeded(db)
    return {"is_seeded": seeded}


@router.post("/chat/theory", response_model=TheoryChatResponse)
async def theory_chat_endpoint(
    request: TheoryChatRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_internal_request),
):
    """
    RAG-powered theory Q&A.
    Retrieves relevant chunks from user's uploaded documents and answers strictly from them.
    """
    try:
        return await answer_theory_question(
            db=db,
            user_id=request.user_id,
            message=request.message,
            history=[m.model_dump() for m in request.history],
            session_id=request.session_id,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")
