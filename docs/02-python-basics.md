# Module 02 — Python for Node Developers

You don't need to become a Python expert to work on this project. You need
just enough to **read** the code and **change** it confidently. This module
covers the essentials, always framed against what you already know from
JavaScript/TypeScript.

## Big-picture differences from Node

| Concept | Node.js / TypeScript | Python |
|---|---|---|
| Package manager | `npm` / `package.json` | `pip` / `requirements.txt` |
| Isolated deps | `node_modules/` per project | **virtualenv** — you have to create it |
| Async | `async / await` (built into JS) | `async / await` (needs `asyncio` runtime) |
| Types | Optional (TypeScript) | Optional (type hints, not enforced) |
| Module system | `import X from './foo'` | `from .foo import X` |
| Entry point | `node index.js` | `python -m app.main` or `uvicorn ...` |
| Import errors | Show at runtime when file loads | Show at runtime when file loads |
| Compilation | `tsc` optional | None — interpreted |

## Virtualenvs — Python's `node_modules`

Node auto-creates `node_modules/` per project. Python doesn't. Without a
virtualenv, `pip install openai` installs into your system Python and pollutes
every project.

The solution is a **virtual environment** — a folder that holds an isolated
copy of Python and pip.

```powershell
python -m venv .venv                   # create the folder .venv/
.venv\Scripts\Activate.ps1             # switch this shell to use it
pip install fastapi                    # goes to .venv/, not system
deactivate                              # exit
```

The `.venv/` folder is essentially your `node_modules/` — never commit it,
never edit its contents by hand.

## `pip` and `requirements.txt`

`requirements.txt` is `package.json`'s `dependencies` section, flatter:

```
fastapi==0.115.6
uvicorn[standard]==0.32.1
langchain==0.3.13
pypdf==5.1.0
```

Install everything: `pip install -r requirements.txt`.

Add a new dep: `pip install some-package`, then manually add the line with the
version to `requirements.txt`. There's no `--save` flag.

## Imports

Python imports look weird at first. Read them as "from THIS module, get THAT
symbol":

```python
# absolute import from a package
from app.services.rag_service import answer_theory_question

# import a whole module and access attributes
import logging
logger = logging.getLogger(__name__)

# import with alias
import pandas as pd
```

The **package** is a folder containing `__init__.py`. That empty file tells
Python "this folder is importable." It's like `index.ts` in TypeScript, except
usually empty. Look inside `backend-python/app/services/` — you'll see
`__init__.py`.

## The main constructs

### Function

```python
def add(a: int, b: int) -> int:
    return a + b
```

Type hints (`: int`, `-> int`) are **not enforced** at runtime — they exist
for IDE hints and Pydantic validation. If you write `add("hello", "world")`,
Python won't complain until something breaks.

### Async function

```python
async def fetch_user(user_id: str) -> dict:
    result = await db.execute(...)
    return {"id": user_id}
```

Same as JavaScript: `async` marks the function, `await` waits for a coroutine.
Under the hood Python uses `asyncio` — FastAPI and LangChain are built on it.

### Class

```python
class MockMarketProvider(BaseMarketProvider):
    def __init__(self, seed: int = 42):
        self.seed = seed              # instance state

    def get_candles(self, symbol: str) -> list:
        return []
```

- `__init__` is the constructor.
- `self` is the equivalent of JavaScript's `this` — but you have to declare it
  as the first parameter of every method. It's not automatic.
- No `new` keyword: `provider = MockMarketProvider(seed=99)`.

### Dataclass — cleaner classes

```python
from dataclasses import dataclass

@dataclass
class Candle:
    time: int
    open: float
    high: float
    low: float
    close: float
    volume: float
```

Auto-generates `__init__`, `__repr__`, and `__eq__`. Used everywhere in
`market_data/base_provider.py`.

### Dictionary and list — everyday collections

```python
d = {"symbol": "RELIANCE", "price": 2920}
d["symbol"]                # "RELIANCE"
d.get("volume", 0)         # 0 (default when key missing)

nums = [1, 2, 3]
nums.append(4)             # [1,2,3,4]
[n * 2 for n in nums]      # list comprehension → [2,4,6,8]
```

List comprehensions are Python's magic — like `.map()` with concise syntax.
You'll see them everywhere.

### Decorator

```python
@router.get("/health")
async def health():
    return {"status": "ok"}
```

A **decorator** wraps a function with extra behaviour. `@router.get("/health")`
tells FastAPI "register this function as a GET handler for `/health`." Same
idea as Express's `router.get("/health", handler)`, just prettier syntax.

Another one you'll see:

```python
@dataclass                # transforms the class
@lru_cache()              # caches the return value
```

### `with` block — automatic cleanup

```python
with open("file.txt") as f:
    data = f.read()
# f is automatically closed here
```

Like a try/finally that closes the file when the block exits. You'll see this
around DB connections and file handles.

## Type hints you'll see in our code

```python
from typing import List, Dict, Optional, Any

def foo(x: List[int]) -> Dict[str, Any]:
    pass

def bar(y: Optional[str] = None):
    pass                   # y can be str or None
```

- `List[int]` = TypeScript's `number[]`.
- `Dict[str, Any]` = `Record<string, unknown>`.
- `Optional[str]` = `string | undefined`.

## `Pydantic` — TypeScript interfaces at runtime

FastAPI uses **Pydantic models** to validate request bodies. Compare:

```typescript
// zod (Node backend)
const schema = z.object({ symbol: z.string(), timeframe: z.string() });
```

```python
# Pydantic (Python backend)
class AnalysisRequest(BaseModel):
    symbol: str
    timeframe: str
    capital: float = 100_000                # default value
    risk_pct: float = Field(default=1.0, gt=0, le=10)
```

Pydantic parses the JSON body, checks types, applies defaults, and raises 422
if invalid — automatically. See `backend-python/app/models/schemas.py`.

## async, await, and asyncio in FastAPI

Every route handler in our project is `async def`. Rules:

- If the function does I/O (DB, HTTP, LLM call), use `async def` and `await` the calls.
- If it's pure CPU work (math, indicator calculation), a plain `def` is fine.
- `asyncio.gather(*tasks)` runs multiple coroutines in parallel — we use this
  heavily in the recommendation scanner.
- `asyncio.Semaphore(N)` limits concurrency — also used in the scanner and
  vision pipeline.

You'll see this pattern often:

```python
async def scan_stocks():
    semaphore = asyncio.Semaphore(20)
    async def one(sym):
        async with semaphore:
            return await analyse(sym)
    return await asyncio.gather(*[one(s) for s in symbols])
```

Same intent as `Promise.all()` in Node — but with a concurrency cap.

## Common gotchas

- **Indentation is syntax.** 4 spaces per level. No braces `{}`. If you copy-paste
  and one line has a stray tab, Python errors with `IndentationError`.
- **`None` vs `undefined`.** Python has `None`; there is no `undefined`.
- **`True` and `False` are capitalised.** `true` is a `NameError`.
- **Print debugging is `print(x)`.** Not `console.log`. Better still, use `logger.info(x)`.
- **String formatting** uses f-strings: `f"Hello {name}"` (like JavaScript's template literals).

## Reading our Python files

Try this exercise: open `backend-python/app/services/recommendation_service.py`
and see if you can now read the imports:

```python
import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.services.analysis_service import run_analysis
from app.services.stock_universe import SECTORS
```

You should be able to explain:
- What `asyncio` is for.
- Why we import from `app.services.analysis_service` (absolute path from project root).
- What `Optional[str]` means in a function signature.

If any of those still feel fuzzy, re-read that section. Otherwise: on to
**[Module 03 — FastAPI Explained](./03-fastapi.md)**.
