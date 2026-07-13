"""
LangGraph tool definitions for the Trade Analyser AI agent.

Each tool wraps an existing service. Tool outputs sent to the LLM are concise
summaries; full data is written into `shared_state` for the API response.
"""

import json
from typing import Any, Dict, List

from langchain_core.tools import tool

from app.config import settings
from app.services.analysis_service import run_analysis
from app.services.market_data import get_market_provider
from app.services.rag_service import answer_theory_question

_provider = get_market_provider()


def make_agent_tools(user_id: str, shared_state: Dict[str, Any]) -> List:
    """
    Return a list of LangChain tools scoped to this request.
    user_id is captured in closures; shared_state accumulates results.
    """

    @tool("analyse_stock")
    def analyse_stock(
        symbol: str,
        timeframe: str = "15m",
        capital: float = 100_000,
        risk_pct: float = 1.0,
        market_type: str = "intraday",
    ) -> str:
        """
        Run a complete technical analysis on an Indian stock or index symbol.
        Returns market bias, setup type, entry zone, stop loss, targets, confidence.
        ALWAYS call this tool first for any trade recommendation request.

        Args:
            symbol: NSE/BSE ticker (e.g. RELIANCE, TCS, NIFTY50, BANKNIFTY)
            timeframe: Chart timeframe — 1m, 5m, 15m, 30m, 1h, 4h, 1d
            capital: Total trading capital in INR
            risk_pct: Maximum risk per trade as percentage of capital (0.1 – 10)
            market_type: intraday | swing | positional
        """
        result = run_analysis(symbol.upper(), timeframe, capital, risk_pct, market_type)
        shared_state["analysis"] = result
        shared_state["steps"].append({
            "tool":    "analyse_stock",
            "input":   {"symbol": symbol.upper(), "timeframe": timeframe},
            "summary": (
                f"Analysed {symbol.upper()} on {timeframe} — "
                f"{result['market_bias']} bias · {result['setup_type']} · "
                f"Confidence {result['confidence_score']}% · "
                f"Entry ₹{result['entry_zone']['from']}–{result['entry_zone']['to']} · "
                f"SL ₹{result['stop_loss']} · T1 ₹{result['target1']}"
            ),
        })

        ind = result.get("indicators", {})
        return json.dumps({
            "symbol":           result["symbol"],
            "timeframe":        result["timeframe"],
            "price":            ind.get("price", 0),
            "market_bias":      result["market_bias"],
            "setup_type":       result["setup_type"],
            "entry_condition":  result["entry_condition"],
            "entry_zone":       result["entry_zone"],
            "stop_loss":        result["stop_loss"],
            "target1":          result["target1"],
            "target2":          result["target2"],
            "risk_reward":      result["risk_reward"],
            "confidence_score": result["confidence_score"],
            "position_size":    result["position_size"],
            "rules_passed":     result["rules_passed"][:4],
            "rules_failed":     result["rules_failed"][:3],
            "invalidation":     result["invalidation_condition"],
            "key_indicators": {
                "rsi":          round(ind.get("rsi", 0), 1),
                "macd_hist":    round(ind.get("macd_hist", 0), 2),
                "volume_ratio": round(ind.get("volume_ratio", 0), 2),
                "ema21":        round(ind.get("ema21", 0), 2),
                "vwap":         round(ind.get("vwap", 0), 2),
            },
        }, default=str)

    @tool("search_theory_documents")
    async def search_theory(query: str) -> str:
        """
        Search the user's uploaded trading theory documents for relevant concepts,
        strategies, or technical analysis explanations. Use this when:
        - The user explicitly asks about theory or concepts
        - You need context on a specific pattern (e.g. VWAP bounce, breakout retest)
        - The user asks 'what does my theory say about X'

        Args:
            query: Natural language question or concept to search for
        """
        result = await answer_theory_question(
            user_id=user_id,
            message=query,
            session_id=f"agent_{user_id}",
            history=[],
        )
        sources = result.get("sources", [])
        shared_state["theory_references"] = sources
        shared_state["steps"].append({
            "tool":    "search_theory_documents",
            "input":   {"query": query},
            "summary": (
                f"Searched theory for '{query}' — "
                f"found {len(sources)} relevant chunk(s)"
            ),
        })
        return result.get("answer", "No relevant theory found in the uploaded documents.")

    @tool("get_price_quote")
    def get_price_quote(symbol: str) -> str:
        """
        Get the current price quote for an Indian stock or index.
        Use this as a quick sanity check or when you need the current price
        without running the full analysis pipeline.

        Args:
            symbol: NSE/BSE ticker (e.g. RELIANCE, NIFTY50)
        """
        q = _provider.get_quote(symbol.upper())
        shared_state["steps"].append({
            "tool":    "get_price_quote",
            "input":   {"symbol": symbol.upper()},
            "summary": (
                f"{symbol.upper()} — LTP ₹{q.ltp:.2f} "
                f"({q.change_pct:+.2f}%)"
            ),
        })
        return json.dumps({
            "symbol":     q.symbol,
            "ltp":        round(q.ltp, 2),
            "open":       round(q.open, 2),
            "high":       round(q.high, 2),
            "low":        round(q.low, 2),
            "change":     round(q.change, 2),
            "change_pct": round(q.change_pct, 2),
            "volume":     int(q.volume),
        })

    @tool("search_market_news")
    def search_market_news(query: str) -> str:
        """
        Search the internet for recent news, analyst reports, market sentiment,
        and fundamental developments about an Indian stock, index, or sector.
        Use this when the user asks about:
        - Recent news or events affecting a stock/sector
        - Earnings results, management commentary, or analyst upgrades/downgrades
        - Macro events (RBI policy, budget, FII flows, global cues)
        - Why a stock is moving up or down today

        Args:
            query: Search query — be specific (e.g. "Reliance Industries Q4 2024 results NSE")
        """
        if not settings.tavily_api_key:
            shared_state["steps"].append({
                "tool":    "search_market_news",
                "input":   {"query": query},
                "summary": "Web search unavailable (TAVILY_API_KEY not configured)",
            })
            return (
                "Real-time web search is not available in this deployment. "
                "Configure TAVILY_API_KEY in your .env to enable live market news search. "
                "Please check NSE/BSE website, moneycontrol.com, or economic times for latest news."
            )

        try:
            from tavily import TavilyClient
            client = TavilyClient(api_key=settings.tavily_api_key)
            result = client.search(
                f"{query} NSE BSE Indian stock market",
                max_results=5,
                search_depth="advanced",
            )

            formatted = []
            for r in result.get("results", []):
                title   = r.get("title", "")
                url     = r.get("url", "")
                content = r.get("content", "")[:300]
                formatted.append(f"- **{title}**\n  {content}\n  Source: {url}")

            summary = f"Found {len(formatted)} news results for '{query}':\n\n" + "\n\n".join(formatted)

            shared_state["steps"].append({
                "tool":    "search_market_news",
                "input":   {"query": query},
                "summary": f"Web search: {len(formatted)} results for '{query}'",
            })
            return summary or "No relevant news found."

        except Exception as e:
            shared_state["steps"].append({
                "tool":    "search_market_news",
                "input":   {"query": query},
                "summary": f"Web search failed: {str(e)[:100]}",
            })
            return f"News search encountered an error: {str(e)[:200]}. Try moneycontrol.com or NSE website directly."

    return [analyse_stock, search_theory, get_price_quote, search_market_news]
