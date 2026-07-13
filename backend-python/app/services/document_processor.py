"""
Document Processor — vision-aware PDF understanding.

Pipeline per uploaded PDF:
  1. Extract text page-by-page (pypdf)
  2. Extract embedded images page-by-page (PyMuPDF / fitz)
  3. Filter out tiny images (logos, icons) by pixel area
  4. Run each surviving image through GPT-4 Vision with a trading-focused prompt
     so candlestick patterns, indicator screenshots, and chart diagrams become
     searchable narrative
  5. Concatenate all text chunks + image descriptions, embed, store in pgvector

A TXT upload skips steps 2-4 cleanly.
A scanned PDF (no extractable text) is rescued by step 2 — the page itself is
rendered to an image and described by vision.

Image-derived chunks are tagged in `metadata` with source_type='image' so the
RAG layer can surface them as visual references when relevant.
"""

import asyncio
import base64
import io
import json
import logging
import os
from typing import Any, Dict, List, Optional, Tuple

import fitz  # PyMuPDF
from PIL import Image
from pypdf import PdfReader

from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings

logger = logging.getLogger(__name__)

# ─── Vision prompt — engineered for trading-theory PDFs ──────────────────────
VISION_PROMPT = """You are analysing an image from a trading theory document.

Describe what the image contains in 2-4 concise sentences, optimised for a
trader searching this knowledge base later. Cover whichever of these apply:

  • Candlestick pattern name (e.g. "bullish engulfing", "morning star",
    "hammer", "doji") — name it explicitly if visible
  • Chart structure: support / resistance levels, trendlines, breakouts,
    consolidation zones
  • Indicators shown (RSI, MACD, Bollinger Bands, moving averages, VWAP)
    and what they signal
  • The setup or signal the diagram is illustrating (entry trigger, stop loss
    placement, target zone, invalidation point)
  • If the image is a diagram or formula (e.g. position sizing math), state
    the concept and the takeaway

Do NOT describe colours, fonts, or visual styling. Do NOT mention "the image
shows" or "this picture" — just state the content directly so it reads like
trading theory text. If the image is a logo, watermark, or has no trading
content, reply with exactly: "NO_TRADING_CONTENT"."""

VISION_SKIP_MARKER = "NO_TRADING_CONTENT"


# ─── Text extraction ─────────────────────────────────────────────────────────

def extract_text_from_file(file_path: str) -> str:
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".pdf":
        reader = PdfReader(file_path)
        pages: List[str] = []
        for i, page in enumerate(reader.pages):
            page_text = page.extract_text()
            if page_text and page_text.strip():
                pages.append(f"[Page {i + 1}]\n{page_text.strip()}")
        return "\n\n".join(pages)  # empty string OK — vision may still rescue

    if ext == ".txt":
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            return f.read()

    raise ValueError(f"Unsupported file type: {ext}")


# ─── Image extraction ────────────────────────────────────────────────────────

def _extract_images_from_pdf(file_path: str) -> List[Tuple[int, bytes, Tuple[int, int]]]:
    """
    Return [(page_number_1based, png_bytes, (width, height)), ...]
    Filters out duplicates (same hash) and tiny images (likely icons/logos).
    """
    out: List[Tuple[int, bytes, Tuple[int, int]]] = []
    seen_hashes: set = set()

    doc = fitz.open(file_path)
    try:
        for page_idx, page in enumerate(doc):
            for img_meta in page.get_images(full=True):
                xref = img_meta[0]
                try:
                    pix = fitz.Pixmap(doc, xref)
                    # Convert CMYK / alpha to RGB
                    if pix.n - pix.alpha >= 4:
                        pix = fitz.Pixmap(fitz.csRGB, pix)
                    if pix.width * pix.height < settings.vision_min_image_pixels:
                        pix = None
                        continue

                    png_bytes = pix.tobytes("png")
                    dims = (pix.width, pix.height)
                    pix = None

                    h = hash(png_bytes[:512])  # cheap dedup — first 512 bytes
                    if h in seen_hashes:
                        continue
                    seen_hashes.add(h)

                    out.append((page_idx + 1, png_bytes, dims))
                except Exception as exc:
                    logger.debug(f"Image xref {xref} skipped on page {page_idx + 1}: {exc}")

            # Hard cap so a 200-page PDF doesn't blow up
            if len(out) >= settings.vision_max_images_per_pdf:
                logger.info(f"Reached vision_max_images_per_pdf={settings.vision_max_images_per_pdf}, stopping image scan")
                return out
    finally:
        doc.close()

    return out


def _rasterise_scanned_pdf_pages(file_path: str, dpi: int = 110) -> List[Tuple[int, bytes, Tuple[int, int]]]:
    """
    Fallback for scanned PDFs (no extractable text and no embedded images we
    could grab): render each page as a PNG so vision can read it.
    Capped at vision_max_images_per_pdf pages.
    """
    out: List[Tuple[int, bytes, Tuple[int, int]]] = []
    doc = fitz.open(file_path)
    try:
        for page_idx, page in enumerate(doc):
            if len(out) >= settings.vision_max_images_per_pdf:
                break
            pix = page.get_pixmap(dpi=dpi)
            png_bytes = pix.tobytes("png")
            out.append((page_idx + 1, png_bytes, (pix.width, pix.height)))
    finally:
        doc.close()
    return out


def _compress_for_vision(png_bytes: bytes, max_dim: int = 1024) -> bytes:
    """Downscale + recompress so we don't ship 5MB PNGs to the vision API."""
    try:
        img = Image.open(io.BytesIO(png_bytes))
        img = img.convert("RGB")
        w, h = img.size
        if max(w, h) > max_dim:
            scale = max_dim / max(w, h)
            img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=82, optimize=True)
        return buf.getvalue()
    except Exception:
        return png_bytes  # send original if compression breaks


# ─── Vision describer ────────────────────────────────────────────────────────

async def _describe_image(llm: ChatOpenAI, png_bytes: bytes) -> Optional[str]:
    """Call vision model. Return description, or None if image has no trading content."""
    try:
        compressed = _compress_for_vision(png_bytes)
        b64 = base64.b64encode(compressed).decode("utf-8")

        message = HumanMessage(content=[
            {"type": "text", "text": VISION_PROMPT},
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{b64}",
                    "detail": "low",  # cheap & fast — good enough for theory diagrams
                },
            },
        ])

        response = await llm.ainvoke([message])
        desc = (response.content or "").strip()
        if not desc or desc.upper().startswith(VISION_SKIP_MARKER):
            return None
        return desc

    except Exception as exc:
        logger.warning(f"Vision describe failed: {exc}")
        return None


async def _describe_images_concurrently(
    images: List[Tuple[int, bytes, Tuple[int, int]]],
) -> List[Tuple[int, str]]:
    """Return [(page_num, description), ...] — preserves order; skips None results."""
    if not images:
        return []

    llm = ChatOpenAI(
        model=settings.openai_vision_model,
        openai_api_key=settings.openai_api_key,
        temperature=0.0,
        max_tokens=500,   # bumped from 220 for richer image descriptions
    )
    semaphore = asyncio.Semaphore(settings.vision_concurrency)

    async def _bound(idx: int, page: int, blob: bytes) -> Tuple[int, int, Optional[str]]:
        async with semaphore:
            desc = await _describe_image(llm, blob)
            return idx, page, desc

    tasks = [_bound(i, page, blob) for i, (page, blob, _dims) in enumerate(images)]
    raw = await asyncio.gather(*tasks)

    raw.sort(key=lambda r: r[0])  # preserve input order
    return [(page, desc) for (_idx, page, desc) in raw if desc]


# ─── Chunking ────────────────────────────────────────────────────────────────

def split_into_chunks(content: str) -> List[str]:
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
        separators=["\n\n", "\n", ".", "!", "?", " "],
        length_function=len,
    )
    return splitter.split_text(content)


# ─── Embedding + storage ─────────────────────────────────────────────────────

async def embed_and_store_chunks(
    db: AsyncSession,
    document_id: str,
    user_id: str,
    chunks: List[Dict[str, Any]],
    start_index: int = 0,
) -> int:
    """
    chunks: list of {"content": str, "source_type": "text"|"image", "page": int|None}
    """
    if not chunks:
        return 0

    embeddings_model = OpenAIEmbeddings(
        model=settings.openai_embedding_model,
        openai_api_key=settings.openai_api_key,
    )

    batch_size   = 100
    stored_count = 0

    for batch_start in range(0, len(chunks), batch_size):
        batch     = chunks[batch_start: batch_start + batch_size]
        texts     = [c["content"] for c in batch]
        vectors   = await embeddings_model.aembed_documents(texts)

        for i, (c, vector) in enumerate(zip(batch, vectors)):
            chunk_index = start_index + batch_start + i
            metadata = json.dumps({
                "source":      document_id,
                "chunk":       chunk_index,
                "source_type": c.get("source_type", "text"),
                "page":        c.get("page"),
            })
            await db.execute(
                text("""
                    INSERT INTO document_chunks
                        (document_id, user_id, chunk_index, content, embedding, metadata)
                    VALUES
                        (:doc_id, :user_id, :idx, :content, :embedding, CAST(:metadata AS jsonb))
                """),
                {
                    "doc_id":    document_id,
                    "user_id":   user_id,
                    "idx":       chunk_index,
                    "content":   c["content"],
                    "embedding": f"[{','.join(str(v) for v in vector)}]",
                    "metadata":  metadata,
                },
            )
            stored_count += 1

        await db.commit()
        logger.info(f"Stored embed batch {batch_start // batch_size + 1} ({stored_count}/{len(chunks)})")

    return stored_count


async def delete_document_chunks(db: AsyncSession, document_id: str) -> None:
    await db.execute(
        text("DELETE FROM document_chunks WHERE document_id = :doc_id"),
        {"doc_id": document_id},
    )
    await db.commit()


# ─── Top-level pipeline ──────────────────────────────────────────────────────

async def process_document(
    db: AsyncSession,
    document_id: str,
    user_id: str,
    file_path: str,
) -> Dict[str, Any]:
    """
    Full pipeline:
      text  → chunks → embedded
      images → vision → described → chunks → embedded
    Both kinds end up in the same pgvector table; metadata.source_type tells
    them apart.
    """
    logger.info(f"Processing document {document_id} for user {user_id} | vision={settings.enable_pdf_vision}")

    ext      = os.path.splitext(file_path)[1].lower()
    raw_text = extract_text_from_file(file_path)
    logger.info(f"Extracted {len(raw_text)} characters of text")

    text_chunks: List[Dict[str, Any]] = [
        {"content": c, "source_type": "text", "page": None}
        for c in (split_into_chunks(raw_text) if raw_text.strip() else [])
    ]

    image_descriptions: List[Tuple[int, str]] = []
    if ext == ".pdf" and settings.enable_pdf_vision:
        images = _extract_images_from_pdf(file_path)
        logger.info(f"Extracted {len(images)} embedded images for vision analysis")

        # Scanned-PDF rescue: no text and no embedded images? Rasterise pages.
        if not text_chunks and not images:
            logger.info("No text and no embedded images — rasterising pages for vision (scanned PDF)")
            images = _rasterise_scanned_pdf_pages(file_path)

        if images:
            image_descriptions = await _describe_images_concurrently(images)
            logger.info(f"Vision produced {len(image_descriptions)} trading-relevant descriptions")

    image_chunks: List[Dict[str, Any]] = []
    for page, desc in image_descriptions:
        image_chunks.append({
            "content":     f"[Page {page} — Visual] {desc}",
            "source_type": "image",
            "page":        page,
        })

    if not text_chunks and not image_chunks:
        raise ValueError(
            "PDF contains no extractable text and no trading content was detected in its images."
        )

    all_chunks = text_chunks + image_chunks
    logger.info(
        f"Embedding {len(all_chunks)} chunks "
        f"(text: {len(text_chunks)}, image-derived: {len(image_chunks)})"
    )
    stored = await embed_and_store_chunks(db, document_id, user_id, all_chunks)

    return {
        "document_id":      document_id,
        "chunk_count":      stored,
        "text_chunk_count": len(text_chunks),
        "image_chunk_count": len(image_chunks),
    }
