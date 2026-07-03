"""
Strategy Rule Engine.

Evaluates a strategy's `conditions` JSON against a live `indicators` dict.

Rule format (one rule object):
  {
    "id":         "r1",
    "label":      "Price above EMA21",
    "indicator":  "price",          # key in indicators dict
    "operator":   "above",          # above | below | between | crossover | equal
    "value":      null,             # numeric threshold (mutually exclusive with compare_to)
    "compare_to": "ema21",          # another indicator key  (mutually exclusive with value)
    "value_min":  null,             # for 'between' operator
    "value_max":  null              # for 'between' operator
  }

Strategy conditions format:
  {
    "rules":    [...],   # list of rule objects above
    "logic":    "AND",   # AND | OR (default AND)
    "min_rr":   1.5      # optional minimum risk-reward (checked separately)
  }
"""

from typing import Any, Dict, List, Tuple


# Indicators that carry list values — cannot be used directly in comparisons
_LIST_INDICATORS = {"support_levels", "resistance_levels"}

# Allowlist of valid indicator keys (guards against injection via conditions JSON)
VALID_INDICATORS = {
    "price", "ema9", "ema21", "ema50", "ema200",
    "sma20", "sma50", "sma200",
    "rsi", "macd", "macd_signal", "macd_hist",
    "atr", "bb_upper", "bb_mid", "bb_lower",
    "volume_ratio", "vwap", "pdh", "pdl",
    "volume", "avg_volume",
}

VALID_OPERATORS = {"above", "below", "between", "crossover", "equal"}


def _get_val(indicators: Dict[str, Any], key: str) -> float:
    """Safely fetch a numeric indicator value; returns 0.0 if missing / list type."""
    if key not in VALID_INDICATORS:
        raise ValueError(f"Unknown indicator: {key!r}")
    v = indicators.get(key, 0.0)
    if isinstance(v, (list, dict)):
        return 0.0
    return float(v)


def _evaluate_rule(rule: Dict[str, Any], indicators: Dict[str, Any]) -> Tuple[bool, str]:
    """
    Evaluate a single rule against the indicators dict.
    Returns (passed: bool, message: str).
    """
    indicator  = rule.get("indicator", "")
    operator   = rule.get("operator", "above")
    label      = rule.get("label", f"{indicator} {operator}")
    value      = rule.get("value")
    compare_to = rule.get("compare_to")
    value_min  = rule.get("value_min")
    value_max  = rule.get("value_max")

    if indicator not in VALID_INDICATORS:
        return False, f"[SKIP] Unknown indicator {indicator!r}"
    if operator not in VALID_OPERATORS:
        return False, f"[SKIP] Unknown operator {operator!r}"

    lhs = _get_val(indicators, indicator)

    if operator == "between":
        if value_min is None or value_max is None:
            return False, f"{label} — missing value_min/value_max"
        passed = float(value_min) <= lhs <= float(value_max)
        msg = (
            f"{label}: {lhs:.2f} {'✓' if passed else '✗'} "
            f"[{value_min}–{value_max}]"
        )
        return passed, msg

    # Determine the right-hand side
    if compare_to is not None:
        if compare_to not in VALID_INDICATORS:
            return False, f"[SKIP] Unknown compare_to {compare_to!r}"
        rhs = _get_val(indicators, compare_to)
        rhs_label = compare_to
    elif value is not None:
        rhs = float(value)
        rhs_label = str(value)
    else:
        return False, f"{label} — missing value or compare_to"

    if operator in ("above", "crossover"):
        passed = lhs > rhs
    elif operator == "below":
        passed = lhs < rhs
    elif operator == "equal":
        passed = abs(lhs - rhs) < 1e-6
    else:
        passed = False

    msg = f"{label}: {lhs:.2f} {'>' if operator in ('above','crossover') else '<'} {rhs:.2f} ({rhs_label}) {'✓' if passed else '✗'}"
    return passed, msg


def evaluate_strategy(
    conditions: Dict[str, Any],
    indicators: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Evaluate all rules in a strategy's conditions dict.

    Returns:
      {
        "matches":          bool,
        "rules_matched":    [str, ...],
        "rules_failed":     [str, ...],
        "score":            float,   # 0.0–1.0 (fraction of rules passed)
        "confidence_bonus": int,     # extra confidence points if strategy matches
        "logic":            "AND"|"OR"
      }
    """
    rules  = conditions.get("rules", [])
    logic  = conditions.get("logic", "AND").upper()

    if not rules:
        return {
            "matches": False,
            "rules_matched": [],
            "rules_failed": ["No rules defined in strategy"],
            "score": 0.0,
            "confidence_bonus": 0,
            "logic": logic,
        }

    rules_matched: List[str] = []
    rules_failed:  List[str] = []

    for rule in rules:
        try:
            passed, msg = _evaluate_rule(rule, indicators)
        except Exception as exc:
            rules_failed.append(f"{rule.get('label', '?')} — error: {exc}")
            continue

        if passed:
            rules_matched.append(msg)
        else:
            rules_failed.append(msg)

    total   = len(rules_matched) + len(rules_failed)
    score   = len(rules_matched) / total if total > 0 else 0.0
    matches = (score == 1.0) if logic == "AND" else (score > 0.0)

    # Confidence bonus: up to 15 points when strategy fully matches
    confidence_bonus = int(score * 15) if matches else 0

    return {
        "matches":          matches,
        "rules_matched":    rules_matched,
        "rules_failed":     rules_failed,
        "score":            round(score, 3),
        "confidence_bonus": confidence_bonus,
        "logic":            logic,
    }
