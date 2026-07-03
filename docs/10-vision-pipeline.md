# Module 10 — Vision Pipeline for PDFs

You upload a trading PDF full of candlestick screenshots. Text extraction
alone would miss all of them. The vision pipeline solves that: GPT-4o-mini
looks at every embedded image and produces a text description that goes into
the same RAG index as the raw text.

This module walks through every step.

## The moving parts

```
backend-python/
├── app/config.py                        # vision-related settings
├── app/services/document_processor.py   # the whole pipeline lives here
└── requirements.txt                     # pymupdf, Pillow — image handling
```

Nothing else in the codebase needs to know vision exists — retrieval treats
image-derived chunks identically to text chunks, with a `metadata.source_type`
tag for cosmetics.

## Config knobs

```python
# app/config.py
openai_vision_model:       str  = "gpt-4o-mini"
enable_pdf_vision:         bool = True
vision_max_images_per_pdf: int  = 60
vision_min_image_pixels:   int  = 40_000   # 200 × 200
vision_concurrency:        int  = 4
```

Override any via environment variable of the same name (uppercased) in `.env`.

## Step 1 — Extract images from PDF

`_extract_images_from_pdf()` uses **PyMuPDF** (`fitz`), which is faster and
more reliable than pypdf for image work:

```python
doc = fitz.open(file_path)
for page_idx, page in enumerate(doc):
    for img_meta in page.get_images(full=True):
        xref = img_meta[0]
        pix = fitz.Pixmap(doc, xref)

        if pix.n - pix.alpha >= 4:                    # CMYK? → RGB
            pix = fitz.Pixmap(fitz.csRGB, pix)

        if pix.width * pix.height < 40_000:           # too small → skip
            continue

        png_bytes = pix.tobytes("png")
        # dedup by hash of first 512 bytes — cheap and effective
        ...
```

Three filters keep our costs sane:

1. **Size**: <200×200 → skipped (logos, icons, page decorations).
2. **Deduplication**: same watermark on every page? Hash matches → keep only first.
3. **Hard cap**: 60 images total. A 200-page PDF won't burn 200 vision calls.

## Step 2 — Rescue path for scanned PDFs

If a PDF has neither extractable text nor embedded images (fully scanned
document), we fall back to `_rasterise_scanned_pdf_pages()`:

```python
for page_idx, page in enumerate(doc):
    pix = page.get_pixmap(dpi=110)
    out.append((page_idx + 1, pix.tobytes("png"), (pix.width, pix.height)))
```

Each page becomes a PNG. Vision reads it as if it were a chart image. The
same pipeline handles it end-to-end.

## Step 3 — Compress before sending

Vision APIs care about token cost, not just quality. We downscale to max
1024px and re-encode as JPEG q82:

```python
def _compress_for_vision(png_bytes, max_dim=1024):
    img = Image.open(io.BytesIO(png_bytes)).convert("RGB")
    if max(img.size) > max_dim:
        scale = max_dim / max(img.size)
        img = img.resize((int(w*scale), int(h*scale)), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=82, optimize=True)
    return buf.getvalue()
```

Original 4MB PNG → 60KB JPEG. Same descriptive quality for trading diagrams,
90%+ cost reduction.

## Step 4 — The vision prompt

`VISION_PROMPT` is the single most important string in this pipeline. Read it
carefully:

```
You are analysing an image from a trading theory document.

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
content, reply with exactly: "NO_TRADING_CONTENT".
```

Three design choices that took iterations to land on:

1. **"Do NOT mention 'the image shows'"** — otherwise every RAG chunk starts
   with "The image shows a candlestick chart" which reads awkwardly and hurts
   embedding quality.
2. **"NO_TRADING_CONTENT" skip marker** — for pages with just publisher logos,
   the model returns this literal string, and we filter it out.
3. **Explicit list of patterns to name** — LLMs are much better when the
   examples are visible. Without them the model gives generic descriptions.

## Step 5 — Concurrent vision calls

`_describe_images_concurrently()` fires up to `vision_concurrency=4`
requests in parallel:

```python
semaphore = asyncio.Semaphore(4)

async def _bound(idx, page, blob):
    async with semaphore:
        desc = await _describe_image(llm, blob)
        return idx, page, desc

tasks = [_bound(i, page, blob) for i, (page, blob, _) in enumerate(images)]
raw   = await asyncio.gather(*tasks)
```

Same pattern as the recommendation scanner. Prevents rate-limit hits while
keeping the total wall time low (60 images ÷ 4 concurrent × ~2s each = ~30s).

Each `_describe_image()` call:

```python
compressed = _compress_for_vision(png_bytes)
b64 = base64.b64encode(compressed).decode()

message = HumanMessage(content=[
    {"type": "text", "text": VISION_PROMPT},
    {"type": "image_url", "image_url": {
        "url": f"data:image/jpeg;base64,{b64}",
        "detail": "low",     # cheap fast path; sufficient for diagrams
    }},
])

response = await llm.ainvoke([message])
desc = (response.content or "").strip()
if not desc or desc.upper().startswith("NO_TRADING_CONTENT"):
    return None
return desc
```

Note the LangChain multimodal message format: `content` is a **list** of
parts, not a plain string. Text and image parts sit side by side.

## Step 6 — Fold descriptions into the chunk stream

Once we have `[(page_num, description), ...]`, each becomes a chunk:

```python
image_chunks = [
    {
        "content":     f"[Page {page} — Visual] {desc}",
        "source_type": "image",
        "page":        page,
    }
    for page, desc in image_descriptions
]

all_chunks = text_chunks + image_chunks
```

Then `embed_and_store_chunks()` embeds and stores them exactly like text
chunks — one `document_chunks` row per chunk, with `metadata.source_type`
set to `"image"` for visuals.

## Step 7 — Retrieval treats them equally

Look at `rag_service.retrieve_relevant_chunks()` — the SQL query doesn't
distinguish text from image chunks:

```sql
SELECT ..., metadata, 1 - (embedding <=> :query_vec::vector) AS score
FROM document_chunks
WHERE user_id = :user_id OR user_id = '__builtin__'
ORDER BY embedding <=> :query_vec::vector
LIMIT :top_k
```

The cosine similarity ranks them together. If the user asks "what's a bullish
engulfing look like?" and one of your PDF images had that pattern described,
the image chunk usually wins.

## Step 8 — Context labelling

Before the LLM sees them, `rag_service.answer_theory_question()` labels each:

```python
tag = "VISUAL — Page " + str(page) if source_type == "image" else "TEXT"
context_parts.append(f"[Chunk {i+1} | {tag} | Score: {score:.2f}]\n{content}")
```

And the system prompt tells the LLM:

> "Some context chunks are derived from IMAGES in the original PDF... Treat
> visual chunks as authoritative descriptions of what the trader was shown
> on that page; when a visual chunk answers the question, cite it as
> '(see visual on page 14)'."

That's how you get citations like *"On page 14, the visual shows a bullish
engulfing at support..."* even though the LLM never saw the actual pixels
during answering — only the description we generated at upload time.

## Cost intuition

- Vision call with `detail=low`: ~700 tokens in, ~120 tokens out → ~$0.00015.
- Typical trading PDF has ~30 chart images.
- Per PDF: ~₹0.40.
- Embedding these descriptions: ~$0.00001 per chunk. Negligible.

Compared to fine-tuning or human labelling: essentially free.

## When to turn it off

- **Just text-heavy PDFs** (like books with almost no charts): set
  `enable_pdf_vision=false` in `.env`. Saves a bit of upload time and cost.
- **Bulk seeding on tight budgets**: same flag.

## Debugging

- Uvicorn logs the pipeline step by step:
  ```
  Extracted 12500 characters of text
  Extracted 34 embedded images for vision analysis
  Vision produced 28 trading-relevant descriptions
  Embedding 91 chunks (text: 63, image-derived: 28)
  ```
- To see individual failures: search logs for `Vision describe failed:` — each failure logs the exception.
- To confirm chunks landed: `SELECT metadata->>'source_type', COUNT(*)  FROM document_chunks WHERE document_id = '<id>' GROUP BY 1;` in psql.

## Extension ideas

- **Store the image itself** as S3/R2 attachment, expose a "view original image" link in the source panel.
- **Cross-encoder rerank** between text and image chunks so the two never fight for the same top-5 slot inconsistently.
- **Per-page thumbnail render** in the source card — click to zoom.
- **Batch descriptor** — one vision call per page instead of per image (cheaper for image-dense pages).

Head to **[Module 11 — Docker & Nginx Basics](./11-docker-and-nginx.md)**.
