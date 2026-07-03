# Module 05 — LangChain Fundamentals

LangChain is a Python **framework for building applications powered by Large
Language Models (LLMs)**. This module is the vocabulary you need to understand
every AI file in the project.

## Why LangChain exists

If you only ever called OpenAI, you wouldn't need LangChain — one HTTP request
solves that. LangChain becomes useful when you:

- Want to swap OpenAI for Anthropic or a local model without rewriting.
- Need to chain LLM calls (query → embed → retrieve → prompt → answer).
- Want structured messages (system / user / assistant) instead of raw strings.
- Need agents that call tools and loop until done.
- Want to stream tokens as they arrive.

LangChain gives you **standard interfaces** for all of the above.

## The five things you need to know

### 1. Chat models

A **Chat Model** is a wrapper around an LLM API. Ours is `ChatOpenAI`:

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="gpt-4o-mini",
    openai_api_key=settings.openai_api_key,
    temperature=0.1,
    max_tokens=500,
)

response = await llm.ainvoke(messages)
answer = response.content
```

- `temperature=0.1` → very deterministic (good for factual retrieval).
- `temperature=0.9` → creative (good for brainstorming).
- `.ainvoke()` is the async version. `.invoke()` blocks.

Swap to Anthropic later? Replace `ChatOpenAI` with `ChatAnthropic`. Rest of
the code stays the same. That's the whole point.

### 2. Messages

A conversation is a **list of Message objects**:

```python
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

messages = [
    SystemMessage(content="You are a trading assistant. Be concise."),
    HumanMessage(content="What is RSI?"),
    AIMessage(content="RSI is Relative Strength Index..."),
    HumanMessage(content="What's a good buy signal?"),
]

response = await llm.ainvoke(messages)
```

The LLM sees the whole conversation and continues it. See how we use this in
`backend-python/app/services/rag_service.py:141-149` — we prepend a system
prompt (with the retrieved context injected), then rebuild the last 6 turns
of history, then append the new question.

### 3. Embeddings

An **embedding** is a mathematical fingerprint of text — a fixed-size vector
of floats such that texts with similar meaning end up close together.

```python
from langchain_openai import OpenAIEmbeddings

embeddings = OpenAIEmbeddings(
    model="text-embedding-3-small",      # produces 1536-float vectors
    openai_api_key=settings.openai_api_key,
)

vec = await embeddings.aembed_query("What is a bullish engulfing pattern?")
# vec is a list of 1536 floats
```

We embed:
- Every chunk of every uploaded PDF (once, at upload time).
- Every user question (once, per query).

We then find the closest chunks to the question — that's retrieval. Module 06
walks through this.

### 4. Text splitters

You can't shove a 200-page PDF into an LLM — context windows are finite. You
have to **chunk** it first.

```python
from langchain_text_splitters import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=800,
    chunk_overlap=150,
    separators=["\n\n", "\n", ". ", " "],
)
chunks = splitter.split_text(long_document)
```

The splitter tries to break at natural boundaries (double newline first,
single newline, then sentence, then word). `chunk_overlap` keeps context
continuity: chunk 2 starts 150 chars before chunk 1 ends, so a concept spanning
the boundary isn't lost.

See `backend-python/app/services/theory_seeder.py:32-41` and
`backend-python/app/services/document_processor.py:200-208`.

### 5. Prompts

A **prompt template** is a reusable string with placeholders. We use them
lightly — mostly f-strings and `.format()`:

```python
SYSTEM_PROMPT = """You are a trading theory assistant...
Context from trading theory knowledge base:
{context}"""

messages = [SystemMessage(content=SYSTEM_PROMPT.format(context=retrieved_text))]
```

For fancier apps you'd use `ChatPromptTemplate` from LangChain but we
deliberately keep it simple.

## How each of these appears in our project

### `rag_service.py` — uses all five

- `ChatOpenAI` (for answering questions).
- `OpenAIEmbeddings` (to embed the user's question).
- `SystemMessage`, `HumanMessage`, `AIMessage` (message construction).
- Prompt template as an f-string.
- No text splitter — that runs at upload time in `document_processor.py`.

### `document_processor.py` — chunking + embedding + vision

- `RecursiveCharacterTextSplitter` (chunk the PDF text).
- `OpenAIEmbeddings` (embed each chunk).
- `ChatOpenAI(model="gpt-4o-mini")` with vision (describe each image).
- `HumanMessage(content=[{"type": "text", ...}, {"type": "image_url", ...}])` — LangChain's format for multimodal messages.

### `theory_seeder.py` — same recipe as document processor, for our built-in KB

- Splits 15 hardcoded theory documents.
- Embeds every chunk.
- Stores under `user_id = "__builtin__"` so every user gets them for free.

### `agent/tools.py` — tools for the LangGraph agent

- Uses `@tool` decorator to declare functions the agent can call.
- Doesn't directly instantiate LLMs — the agent's LLM is set up separately
  in `agent.py` and given these tools.

### `analysis_service.py` — mostly indicator math, no LLM

- Pure Python + pandas. LangChain only enters when we ask the LLM to explain
  the analysis in prose — for that we use a small `ChatOpenAI` call.

## Sync vs async — pick the right method

Every LangChain object has both:

- `.invoke(...)` — synchronous. Blocks the thread.
- `.ainvoke(...)` — async. Returns a coroutine you `await`.

In FastAPI, always use `ainvoke`. Blocking calls freeze the whole event loop
and every user waits.

Batch operations have their own async version too: `.aembed_documents([...])`
sends a batched request. We use this for efficiency in
`document_processor.py:65-70`.

## Streaming — future work

LangChain also supports token-by-token streaming with `.astream()`. We don't
use it yet because our LLM calls are short — but if you build a "long
explanation" feature, this is how you'd get ChatGPT-style typing effects.

## The three OpenAI models we use

| Model | Purpose | Location in code |
|---|---|---|
| `text-embedding-3-small` | Turns text into 1536-dim vectors | `rag_service.py`, `document_processor.py`, `theory_seeder.py` |
| `gpt-4o-mini` (chat) | Answers questions, runs the agent, explains analyses | Everywhere `ChatOpenAI` appears |
| `gpt-4o-mini` (vision) | Describes images from PDFs | `document_processor.py:135` |

`gpt-4o-mini` is our default because it's ~25× cheaper than `gpt-4o` and
still very capable for trading-theory tasks.

## Cost intuition

The pricing that matters (as of my knowledge cutoff — check current OpenAI docs):

| Operation | Cost |
|---|---|
| One embedding call for a 500-word chunk | ~$0.00002 |
| One chat call answering a question with context | ~$0.001 |
| One vision call describing an image (detail=low) | ~$0.00015 |
| One agent turn with 3 tool calls | ~$0.005 |

Our `enable_pdf_vision=True` default costs ~₹0.60 per uploaded PDF. Uploading
100 books = ₹60. Reasonable.

## Where LangChain ends and OpenAI begins

Under the hood, every `ChatOpenAI` call becomes an HTTP request to
`https://api.openai.com/v1/chat/completions`. LangChain is a wrapper that:

- Formats your messages into the JSON OpenAI expects.
- Parses the response.
- Retries on rate limits (with tenacity — see `requirements.txt`).
- Standardises the interface so `ChatAnthropic` behaves the same way.

If you ever want to see the raw request, set an environment variable:

```
LANGCHAIN_DEBUG=true
```

Or just add `import logging; logging.getLogger("openai").setLevel(logging.DEBUG)`
in `main.py` temporarily.

## Read this next: RAG

You now know every LangChain concept the app uses. The next module puts them
together into a working retrieval system.

**[Module 06 — RAG Explained](./06-rag-explained.md)**.
