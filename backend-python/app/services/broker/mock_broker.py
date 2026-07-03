"""
MockBrokerProvider — simulates a broker API for paper trading / UI demonstration.

All data is deterministic per (user_id + calendar-date) so it remains stable
across page refreshes within the same day.  No real orders are ever placed.
"""

import hashlib
import random
from datetime import datetime, timedelta

_SYMBOLS = [
    "NIFTY", "BANKNIFTY", "RELIANCE", "TCS", "INFY",
    "HDFCBANK", "ICICIBANK", "TATAMOTORS", "SBIN", "AXISBANK",
]
_PRODUCTS  = ["MIS", "CNC", "NRML"]
_EXCHANGES = {"NIFTY": "NSE", "BANKNIFTY": "NSE"}


def _rng(seed_str: str) -> random.Random:
    key  = f"{seed_str}-{datetime.now().date()}"
    seed = int(hashlib.md5(key.encode()).hexdigest()[:8], 16)
    return random.Random(seed)


class MockBrokerProvider:
    """Deterministic paper-trading account simulation."""

    BROKER_NAME = "MockBroker (Paper Trading)"

    def get_profile(self, user_id: str) -> dict:
        return {
            "client_id":   f"MOCK{user_id[:6].upper()}",
            "full_name":   "Paper Trader",
            "broker":      self.BROKER_NAME,
            "exchange":    ["NSE", "BSE", "NFO"],
            "products":    ["MIS", "CNC", "NRML"],
            "is_mock":     True,
            "disclaimer":  (
                "Simulated account for paper trading only. "
                "No real money or orders are involved."
            ),
        }

    def get_margins(self, user_id: str) -> dict:
        rng   = _rng(f"{user_id}:margins")
        total = round(rng.uniform(150_000, 500_000), 2)
        used  = round(total * rng.uniform(0.08, 0.35), 2)
        avail = round(total - used, 2)
        return {
            "equity": {
                "available": {"cash": avail, "collateral": 0.0, "intraday_payin": 0.0},
                "used":      {"debits": used, "m2m":        round(rng.uniform(-3000, 3000), 2)},
                "net":       avail,
                "total":     total,
            },
            "commodity": {"available": {"cash": 0.0}, "used": {"debits": 0.0}, "net": 0.0},
            "currency":  "INR",
        }

    def get_positions(self, user_id: str) -> list:
        rng  = _rng(f"{user_id}:positions")
        n    = rng.randint(0, 3)
        syms = rng.sample(_SYMBOLS, min(n, len(_SYMBOLS)))
        out  = []
        for sym in syms:
            is_index = sym in ("NIFTY", "BANKNIFTY")
            lot      = 50 if sym == "NIFTY" else (15 if sym == "BANKNIFTY" else 1)
            entry    = round(rng.uniform(200, 800) * (25 if is_index else 1), 2)
            qty      = lot * rng.choice([1, 2, 3])
            ltp      = round(entry * rng.uniform(0.975, 1.025), 2)
            pnl      = round((ltp - entry) * qty, 2)
            out.append({
                "tradingsymbol":  sym,
                "exchange":       _EXCHANGES.get(sym, "NSE"),
                "product":        rng.choice(["MIS", "NRML"]),
                "quantity":       qty,
                "buy_quantity":   qty,
                "sell_quantity":  0,
                "average_price":  entry,
                "last_price":     ltp,
                "pnl":            pnl,
                "value":          round(ltp * qty, 2),
                "day_change_pct": round((ltp - entry) / entry * 100, 2),
                "multiplier":     1,
            })
        return out

    def get_orders(self, user_id: str) -> list:
        rng      = _rng(f"{user_id}:orders")
        n        = rng.randint(2, 6)
        statuses = ["COMPLETE", "COMPLETE", "COMPLETE", "REJECTED", "CANCELLED", "OPEN"]
        out      = []
        for i in range(n):
            sym        = rng.choice(_SYMBOLS)
            price      = round(rng.uniform(100, 2500), 2)
            status     = rng.choice(statuses)
            order_type = rng.choice(["LIMIT", "MARKET", "SL", "SL-M"])
            out.append({
                "order_id":        f"MOCK{rng.randint(1_000_000, 9_999_999)}",
                "tradingsymbol":   sym,
                "exchange":        _EXCHANGES.get(sym, "NSE"),
                "transaction_type": rng.choice(["BUY", "SELL"]),
                "order_type":      order_type,
                "product":         rng.choice(_PRODUCTS),
                "quantity":        rng.choice([1, 25, 50, 75, 100]),
                "price":           price,
                "trigger_price":   round(price * 0.995, 2) if "SL" in order_type else 0,
                "status":          status,
                "filled_quantity":  (rng.randint(1, 50) if status == "COMPLETE" else 0),
                "placed_at":       (datetime.now() - timedelta(minutes=rng.randint(5, 240))).strftime("%Y-%m-%dT%H:%M:%S"),
                "tag":             "PAPER_TRADE",
            })
        return sorted(out, key=lambda x: x["placed_at"], reverse=True)

    def get_holdings(self, user_id: str) -> list:
        rng  = _rng(f"{user_id}:holdings")
        n    = rng.randint(0, 5)
        syms = rng.sample(_SYMBOLS[2:], min(n, len(_SYMBOLS) - 2))  # skip indices
        out  = []
        for sym in syms:
            avg    = round(rng.uniform(300, 3500), 2)
            qty    = rng.choice([5, 10, 15, 20, 25, 50])
            ltp    = round(avg * rng.uniform(0.85, 1.25), 2)
            pnl    = round((ltp - avg) * qty, 2)
            out.append({
                "tradingsymbol": sym,
                "exchange":      "NSE",
                "isin":          f"INE{rng.randint(10000, 99999)}K01{rng.randint(10,99)}",
                "quantity":      qty,
                "average_price": avg,
                "last_price":    ltp,
                "pnl":           pnl,
                "pnl_pct":       round((ltp - avg) / avg * 100, 2),
                "close_price":   round(ltp * rng.uniform(0.998, 1.002), 2),
                "day_change":    round(ltp - round(ltp * rng.uniform(0.998, 1.002), 2), 2),
            })
        return out


_provider = MockBrokerProvider()
