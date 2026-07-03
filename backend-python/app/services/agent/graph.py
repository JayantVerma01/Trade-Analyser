"""
LangGraph ReAct agent for Trade Analyser AI.

Flow:  User query → agent node → tool node (loop) → agent node → END
Uses langgraph.prebuilt.create_react_agent for the standard ReAct loop.
"""

from typing import Any, Dict, Optional

from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent

from app.config import get_settings
from app.services.agent.tools import make_agent_tools

SYSTEM_PROMPT = """You are a professional AI trading analyst specialising in Indian stock markets (NSE/BSE).
Your role is to provide technical analysis and trade setup recommendations — NOT to execute trades.

## Workflow
1. ALWAYS call `analyse_stock` first for any stock/trade recommendation query.
2. If the user asks about trading theory, concepts, or patterns — also call `search_theory_documents`.
3. Use `get_price_quote` only for a quick price check without full analysis.
4. After gathering data with tools, write your final recommendation.

## Output format (final response)
Structure your final answer as:

**[SYMBOL] [TIMEFRAME] — [BIAS] Setup: [SETUP_TYPE]**

**Recommendation:** [1-2 sentences on what to do]

**Trade Setup:**
- Entry Zone: ₹X – ₹Y
- Stop Loss: ₹Z (invalidation: [condition])
- Target 1: ₹A | Target 2: ₹B
- Risk/Reward: 1:X
- Position Size: N shares (₹X risk)
- Confidence: X%

**Key Signals:** [3-4 bullet points on what the indicators are saying]

**Wait for:** [Entry trigger — e.g. bullish candle close above EMA21]

**Risk Warning:** This is educational analysis only. Do NOT place any orders solely based on this output.
Always apply your own judgement and confirm the setup manually before trading.

## Hard Rules
- NEVER suggest placing, executing, or automating orders
- NEVER give a confidence score above 92%
- Always include the risk warning in every response
- Be specific with price levels (₹ notation)
- Keep the response concise and actionable"""


async def run_agent_query(
    user_id: str,
    query: str,
    symbol: str,
    timeframe: str = "15m",
    capital: float = 100_000,
    risk_pct: float = 1.0,
    market_type: str = "intraday",
    strategy_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Run the LangGraph ReAct agent and return structured results.

    Returns:
      {
        "query":             str,
        "steps":             list[dict],   # tool calls with summaries
        "analysis":          dict | None,  # full analysis result (for chart/cards)
        "theory_references": list[dict],   # RAG chunks
        "recommendation":    str,          # agent's final markdown text
      }
    """
    settings = get_settings()

    shared_state: Dict[str, Any] = {
        "steps":             [],
        "analysis":          None,
        "theory_references": [],
    }

    tools = make_agent_tools(user_id, shared_state)

    llm = ChatOpenAI(
        model="gpt-4o-mini",
        temperature=0,
        openai_api_key=settings.openai_api_key,
    )

    agent = create_react_agent(llm, tools, state_modifier=SYSTEM_PROMPT)

    strategy_line = f"\n- Active Strategy: {strategy_name}" if strategy_name else ""
    user_message = (
        f"User Question: {query}\n\n"
        f"Context:\n"
        f"- Symbol: {symbol.upper()}\n"
        f"- Timeframe: {timeframe}\n"
        f"- Capital: ₹{capital:,.0f}\n"
        f"- Risk per trade: {risk_pct}%\n"
        f"- Market type: {market_type}"
        f"{strategy_line}\n\n"
        f"Please analyse {symbol.upper()} and provide a comprehensive trade setup recommendation."
    )

    result = await agent.ainvoke(
        {"messages": [HumanMessage(content=user_message)]},
        config={"recursion_limit": 12},   # max 12 LLM + tool steps to prevent runaway costs
    )

    # Final message is the last AIMessage from the agent
    final_message = result["messages"][-1].content

    return {
        "query":             query,
        "symbol":            symbol.upper(),
        "timeframe":         timeframe,
        "steps":             shared_state["steps"],
        "analysis":          shared_state["analysis"],
        "theory_references": shared_state["theory_references"],
        "recommendation":    final_message,
    }
