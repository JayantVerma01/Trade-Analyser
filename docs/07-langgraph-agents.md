# Module 07 — LangGraph & AI Agents

RAG answers questions from documents. An **agent** does more: it can decide
"I need to run an analysis first, then search the theory docs, then look up
today's news, then combine everything into an answer." That's what
the AI Agent page in our product does.

## The idea in one sentence

An agent is an LLM that can call **tools** (regular Python functions) in a
loop until it decides it has enough information to answer.

## ReAct — the pattern our agent uses

**ReAct** = "Reasoning + Acting". The loop:

```
1. LLM sees the user's question + list of available tools.
2. LLM thinks: "I need X. I'll call tool_A."
3. Framework calls tool_A with the LLM's chosen arguments.
4. Tool_A returns data.
5. LLM sees the tool output. Decides: "Now I need Y — call tool_B."
6. Repeat...
7. LLM decides: "I have enough. Here's the final answer."
```

Under the hood this is powered by OpenAI's **function calling** feature — the
LLM emits structured JSON like `{"tool": "analyse_stock", "args": {"symbol":
"RELIANCE"}}` instead of prose, and the framework parses and dispatches.

## LangGraph vs LangChain

- **LangChain** gives you chains — linear pipelines (like `question → embed → retrieve → prompt → answer`).
- **LangGraph** gives you **state machines** — cyclic graphs where the LLM can loop back to a step, retry, or branch.

For agents specifically, LangGraph is the successor to LangChain's older
`AgentExecutor`. It's cleaner and easier to debug.

We use LangGraph's `create_react_agent()` — a one-liner that builds the entire
ReAct loop for you.

## Our agent — file by file

### `backend-python/app/services/agent/tools.py`

This file **defines the tools** the agent can use. Each tool is a plain
Python function wrapped with LangChain's `@tool` decorator:

```python
from langchain_core.tools import tool

@tool("analyse_stock")
def analyse_stock(symbol: str, timeframe: str = "15m", ...) -> str:
    """
    Run a complete technical analysis on an Indian stock or index symbol.
    Returns market bias, setup type, entry zone, stop loss, targets, confidence.
    """
    result = run_analysis(symbol.upper(), timeframe, ...)
    return json.dumps({...})
```

The `@tool` decorator does three things:

1. Registers the function in LangChain's tool registry.
2. Extracts the docstring as the tool's description (the LLM reads this to
   decide when to call it — so **write good docstrings**).
3. Infers arguments and their types from the function signature — that becomes
   the tool's schema, exposed to the LLM as JSON.

The four tools we expose:

| Tool name | What it does |
|---|---|
| `analyse_stock` | Runs the full analysis pipeline (indicators + setup + confidence). |
| `search_theory_documents` | Runs RAG against the user's docs + built-in KB. |
| `get_price_quote` | Returns current LTP without a full analysis. |
| `search_market_news` | Searches Tavily for real-time news (only if `TAVILY_API_KEY` is set). |

Each tool also writes to a `shared_state` dict — a per-request bag where we
collect all the intermediate data. The final API response includes everything
in `shared_state`, so the frontend can render step-by-step logs of what the
agent did.

### `backend-python/app/services/agent/graph.py`

This is where the tools become an agent:

```python
from langgraph.prebuilt import create_react_agent
from langchain_openai import ChatOpenAI

def build_agent(user_id: str, shared_state: dict):
    llm   = ChatOpenAI(model=settings.openai_model, temperature=0.2)
    tools = make_agent_tools(user_id, shared_state)
    return create_react_agent(llm, tools)
```

`create_react_agent()` returns a compiled graph that you invoke like this:

```python
result = await agent.ainvoke({"messages": [HumanMessage(content=question)]})
final_answer = result["messages"][-1].content
```

Internally LangGraph runs the ReAct loop for you.

### `backend-python/app/routers/agent.py`

The HTTP layer:

```python
@router.post("/agent/trade-query")
async def trade_query(req: TradeQueryRequest, _: None = Depends(...)):
    shared_state = {"steps": [], "analysis": None, "theory_references": []}
    agent  = build_agent(req.user_id, shared_state)
    result = await agent.ainvoke({"messages": [HumanMessage(content=req.query)]})

    return {
        "answer":  result["messages"][-1].content,
        "steps":   shared_state["steps"],
        "analysis": shared_state["analysis"],
        "theory_references": shared_state["theory_references"],
    }
```

The response gives the frontend both the human-readable answer and the raw
trace of tool calls.

## A concrete example

User types: *"Should I buy Reliance for a swing trade tomorrow?"*

Agent trace (this is real behaviour, not made up):

```
Turn 1
  LLM decides: call analyse_stock(symbol="RELIANCE", timeframe="1h",
                                  market_type="swing")
  Tool runs → returns JSON with bias=Bullish, confidence=68, EMA21 pullback
  shared_state.steps.append({"tool": "analyse_stock", "summary": "..."})

Turn 2
  LLM decides: call search_theory_documents(query="EMA21 pullback rules")
  Tool runs → RAG returns 3 chunks about EMA pullback setups
  shared_state.steps.append({"tool": "search_theory_documents", ...})

Turn 3
  LLM decides: call search_market_news(query="Reliance latest news")
  Tool runs → Tavily returns 5 news snippets
  shared_state.steps.append({"tool": "search_market_news", ...})

Turn 4
  LLM decides: no more tool calls needed.
  Emits final answer: "Reliance is showing a bullish EMA21 pullback on the
  1H chart with confidence 68%. Entry zone ₹2915-2925, stop at ₹2895, target
  ₹2965. This matches Chapter 4 of your theory doc which requires..."
```

The frontend gets:
- The human answer
- The 3-step trace (so users see WHAT the agent did)
- The underlying analysis object (so we can render the same
  `TradeSetupCard` component the Analysis page uses)

## Where the LLM's decisions live

The magic isn't in our code — it's in the LLM. LangGraph passes:

- The system prompt (built by `create_react_agent`).
- The user question.
- The tool schemas (auto-generated from `@tool` docstrings).

The LLM responds with either:
- `content: "final answer text"` — done.
- `tool_calls: [{name, arguments}, ...]` — call these tools first, then let
  me see the results.

LangGraph loops until it sees a final answer.

## Why we cap turns

Left unchecked, an agent could loop forever ("let me check one more thing…").
LangGraph has a built-in max iteration count (default 25). If the agent hasn't
finished by then, it force-terminates with a partial answer. In production
you'd tune this: 8-10 turns is usually plenty and keeps latency bounded.

## Streaming and tracing

Two ways to see what's happening while the agent runs:

1. **Logs** — each tool writes to `logger.info()`. Watch uvicorn output.
2. **LangSmith** (paid) — Anthropic's / LangChain's hosted tracing. Add three
   env vars and every LLM call + tool call gets a beautiful timeline UI. Not
   set up in this project but a great next step.

## The safety rule the agent respects

You'll notice `analyse_stock` doesn't have a `place_order` tool. That's
deliberate — the agent can analyse, retrieve theory, and search news, but
**cannot execute a trade**. That's our safety constraint in action. Even if the
LLM invented a "place order" call, no such tool exists and the framework
would error out.

If you ever add real broker integration (see `GOING_LIVE.md`), the
`place_order` step **must live outside the agent** — in the frontend,
gated by explicit user confirmation.

## When to use an agent vs plain RAG

| Situation | Use |
|---|---|
| "What does my PDF say about X?" | Plain RAG (Theory Chat). |
| "Analyse Reliance" | Plain analysis endpoint. No LLM at all. |
| "Should I buy X? What's the setup? What does theory say? Any news?" | **Agent** — combines all three. |
| "Given today's news + my theory, what's the smart move?" | Agent. |

RAG is fast and cheap (~1 LLM call). Agent is slow and 3-10× more expensive
(multiple LLM calls). Use it where combining information matters.

## Reading order in code

To read the agent code, go in this sequence:

1. `services/agent/tools.py` — understand what capabilities exist.
2. `services/agent/graph.py` — see how they're wired to an LLM.
3. `routers/agent.py` — see the HTTP entry point.
4. Frontend: `components/agent/AgentInterface.tsx` — see the step-by-step UI.

Head to **[Module 08 — The Analysis Engine](./08-analysis-engine.md)**.
