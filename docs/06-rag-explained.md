# Module 06 — RAG Explained

**RAG = Retrieval-Augmented Generation.** It's how the "Theory Chat" page
answers questions about your uploaded PDFs (and the built-in knowledge base).

## Why RAG exists

LLMs like GPT-4 know a lot, but they don't know:

- Your uploaded PDFs
- Facts published after their training cutoff
- Private data (your trading rules, your strategy notes)

Fine-tuning is expensive and slow. RAG solves this differently: at **query
time**, we search your data for chunks relevant to the question, stuff them
into the prompt, and let the LLM answer using them.

Two phases:

1. **Ingest** (happens at upload / seed time) — turn documents into vectors.
2. **Query** (happens every chat message) — find relevant chunks, ask the LLM.

## Phase 1 — Ingest: file → vectors

Trace through what happens when you upload `TradingInTheZone.pdf`:

### Step 1: Node accepts the upload

```
POST /api/documents/upload
```

Multer saves the file to `backend-node/uploads/doc-...pdf`. Node writes a
row in `theory_documents` with status `PENDING`, then kicks off async
processing:

```typescript
processDocumentAsync(doc.id, userId, path.resolve(file.path)).catch(...);
```

Node returns 201 immediately. The heavy work happens in the background.

### Step 2: Node calls Python

```typescript
const result = await aiService.processDocument(docId, userId, filePath);
```

That's a POST to `http://localhost:8000/ai/documents/process` with
`{document_id, user_id, file_path}`.

### Step 3: Python extracts text

`backend-python/app/services/document_processor.py:extract_text_from_file()`
opens the PDF with `pypdf`, page by page:

```python
reader = PdfReader(file_path)
for i, page in enumerate(reader.pages):
    page_text = page.extract_text()
    if page_text and page_text.strip():
        pages.append(f"[Page {i + 1}]\n{page_text.strip()}")
```

Each page gets a `[Page N]` prefix. That prefix survives chunking and gives
us page-level attribution later.

### Step 4: Python extracts images (vision pipeline)

`_extract_images_from_pdf()` uses PyMuPDF (`fitz`) to pull every embedded
image, filters out tiny ones (< 200×200 px, likely icons), and deduplicates
by hash.

Then each surviving image goes through `_describe_image()`:

```python
message = HumanMessage(content=[
    {"type": "text", "text": VISION_PROMPT},
    {"type": "image_url", "image_url": {
        "url": f"data:image/jpeg;base64,{b64}",
        "detail": "low",
    }},
])
response = await llm.ainvoke([message])
```

GPT-4o-mini looks at the image and returns something like:
*"Bullish engulfing pattern — a large green candle fully engulfs a prior
small red candle at a support level, suggesting a reversal to the upside."*

Full details in Module 10.

### Step 5: Chunk everything

`split_into_chunks()` uses LangChain's `RecursiveCharacterTextSplitter`:

```python
splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
    separators=["\n\n", "\n", ".", "!", "?", " "],
)
```

If the PDF has 50,000 characters of text, you might get ~60 chunks. Each
image description becomes one chunk of its own, tagged with `source_type="image"`.

### Step 6: Embed each chunk

```python
embeddings_model = OpenAIEmbeddings(model=settings.openai_embedding_model)
vectors = await embeddings_model.aembed_documents(texts)
```

OpenAI returns a 1,536-float vector per chunk. Batched — 100 chunks per API
call for efficiency.

### Step 7: Store in pgvector

```python
INSERT INTO document_chunks
  (document_id, user_id, chunk_index, content, embedding, metadata)
VALUES
  (:doc_id, :user_id, :idx, :content, :embedding, CAST(:metadata AS jsonb))
```

The embedding column is `vector(1536)` from pgvector. Metadata is JSON:
`{"source": document_id, "chunk": N, "source_type": "text"|"image", "page": N}`.

### Step 8: Mark ready

Node's async job returns to `documents.service.ts` and updates the row:

```typescript
await prisma.theoryDocument.update({
    where: { id: docId },
    data: { status: 'READY', chunkCount, textChunkCount, imageChunkCount },
});
```

That's ingest. All future queries will search these chunks.

## Phase 2 — Query: question → answer

Now you ask "What does the PDF say about bullish engulfing patterns?" in the
Theory Chat.

### Step 1: Node passes through to Python

```
POST /api/chat/theory
{"user_id": "abc", "message": "What does...", "session_id": "chat-1", "history": [...]}
```

Node forwards to `POST /ai/chat/theory`.

### Step 2: Python checks if any KB exists

`backend-python/app/services/rag_service.py:answer_theory_question()`:

```python
count_result = await db.execute(
    text("SELECT COUNT(*) FROM document_chunks WHERE user_id = :uid OR user_id = '__builtin__'"),
    {"uid": user_id},
)
```

If zero rows exist (no uploads AND no built-in seeding), return an early
message. Otherwise continue.

### Step 3: Embed the question

Same embedding model as ingest — critical: **the query and the chunks must
use the same model or the vectors are meaningless**.

```python
query_vector = await embeddings_model.aembed_query(query)
vector_str = f"[{','.join(str(v) for v in query_vector)}]"
```

### Step 4: Vector search in Postgres

```sql
SELECT document_id, chunk_index, content, user_id, metadata,
       1 - (embedding <=> CAST(:query_vec AS vector)) AS score
FROM document_chunks
WHERE user_id = :user_id OR user_id = '__builtin__'
ORDER BY embedding <=> CAST(:query_vec AS vector)
LIMIT :top_k
```

- `<=>` is pgvector's cosine distance operator.
- `1 - distance` = similarity score, 0..1 (higher = more similar).
- `LIMIT :top_k` = default 5.

We union the user's chunks with the built-in KB (`user_id = '__builtin__'`)
so the user gets access to both.

The HNSW index makes this millisecond-fast even with millions of rows.

### Step 5: Sanity-check the top hit

```python
if not chunks or chunks[0]["score"] < 0.3:
    return TheoryChatResponse(
        answer="I could not find this in the available trading theory...",
        found_in_theory=False,
    )
```

If even the best chunk has cosine similarity < 0.3, we consider it a miss.
Better to say "I don't know" than hallucinate. **Don't skip this check** —
it's what keeps the assistant honest.

### Step 6: Build the context string

We label each chunk as `TEXT` or `VISUAL — Page N`:

```python
for i, chunk in enumerate(chunks):
    tag = "VISUAL — Page " + str(chunk.get("page") or "?") \
          if chunk.get("source_type") == "image" else "TEXT"
    context_parts.append(f"[Chunk {i+1} | {tag} | Score: {chunk['score']:.2f}]\n{chunk['content']}")
context = "\n\n---\n\n".join(context_parts)
```

The LLM now sees which chunks came from images and can cite them.

### Step 7: Build the messages

```python
messages = [SystemMessage(content=SYSTEM_PROMPT.format(context=context))]

for msg in history[-6:]:
    if msg["role"] == "user":       messages.append(HumanMessage(content=msg["content"]))
    elif msg["role"] == "assistant": messages.append(AIMessage(content=msg["content"]))

messages.append(HumanMessage(content=message))
```

The system prompt tells the LLM strict rules:

> "Only use information from the provided context chunks. Never invent rules
> or statistics. If the answer is not found in the context, say exactly: 'I
> could not find this in the available trading theory.'"

That's what keeps hallucinations rare. The LLM will still occasionally embellish
— no prompt is bulletproof — but this dramatically reduces it.

### Step 8: Call the LLM

```python
llm = ChatOpenAI(model=settings.openai_model, temperature=0.1)
response = await llm.ainvoke(messages)
answer = response.content
```

`temperature=0.1` because we want factual retrieval, not creativity.

### Step 9: Return with sources

```python
return TheoryChatResponse(
    answer=answer,
    sources=[SourceChunk(...) for c in chunks],
    found_in_theory=True,
    session_id=session_id,
)
```

The frontend's `MessageBubble.tsx` shows the answer plus a collapsible source
list — with special styling for visual chunks (violet chip with page number).

## The whole picture

```
UPLOAD FLOW                            QUERY FLOW
───────────                            ──────────

PDF file                               "What is engulfing?"
   │                                        │
   ▼                                        ▼
Extract text (pypdf)                   Embed the question
Extract images (fitz)                  (OpenAI embeddings API)
   │                                        │
   ▼                                        ▼
Vision describes images                Vector search
(GPT-4o-mini vision)                   (Postgres + pgvector <=> op)
   │                                        │
   ▼                                        ▼
Chunk everything                       Top-5 most similar chunks
(RecursiveCharacterTextSplitter)          │
   │                                        │
   ▼                                        ▼
Embed each chunk                       Build system prompt with chunks
(OpenAI embeddings API)                as context
   │                                        │
   ▼                                        ▼
Insert into document_chunks            Call ChatOpenAI
(with metadata)                        with system + history + question
                                            │
                                            ▼
                                       Return answer + citations
```

## Why RAG works

The LLM answering the question **doesn't know your PDFs exist**. It just sees:

> System: "Here's some trading theory context. Only use this.
> [Chunk 1]... [Chunk 2]... [Chunk 3]..."
> User: "What does the PDF say about bullish engulfing?"

Because the context was retrieved *specifically for that question*, it's
usually the exact information needed. The LLM's job reduces to synthesizing
and citing — which it does well.

## Why RAG can fail

- **Bad embedding**: If the question phrase is very different from the chunk
  phrase, cosine similarity misses. Rewording the question often fixes it.
- **Chunk too small**: A definition split across two chunks won't be found
  cleanly. Our 1000-char chunks with 200-char overlap balance this.
- **Chunk too big**: A 5000-char chunk contains too much noise; the vector
  averages out.
- **Off-topic PDF**: You uploaded a novel and asked about candlesticks. Even
  the top chunk will score low. That's why the 0.3 threshold exists.

## Improvements you can make

- **Reranking** — after vector search returns 20 chunks, use a cheaper
  cross-encoder (like `ms-marco-TinyBERT-L-2`) to rerank to top-5. Much
  higher precision, small cost.
- **HyDE (Hypothetical Document Embeddings)** — before searching, ask the LLM
  to "write what a good answer would look like," then embed THAT and search.
  Often more robust for short questions.
- **Metadata filtering** — the `metadata` JSONB column lets you filter by
  page, source_type, doc_id, tags. Add UI for "search only in visuals" or
  "search only in this PDF."
- **Cross-encoder scoring for images** — right now image and text chunks
  compete in the same cosine space. Splitting them and merging by rank could
  help.

Head to **[Module 07 — LangGraph & AI Agents](./07-langgraph-agents.md)** to see how the LLM starts *deciding* which tools to call instead of just answering.
