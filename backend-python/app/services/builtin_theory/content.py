"""
Built-in Trading Theory Knowledge Base — Approach 3.

15 comprehensive trading theory documents covering all major concepts
used by the Trade Analyser AI. These are embedded into pgvector so
the RAG system works even before the user uploads any documents.

Each entry:  { "id": str, "title": str, "content": str }
"""

BUILTIN_THEORIES = [

    {
        "id": "dow_theory",
        "title": "Dow Theory & Market Structure",
        "content": """
DOW THEORY & MARKET STRUCTURE

Dow Theory is the foundation of technical analysis, developed by Charles Dow in the late 1800s.
It describes how markets trend and identifies the stages through which prices move.

THE SIX TENETS OF DOW THEORY:
1. The market discounts everything — all known and anticipated information is already reflected in price.
2. There are three types of trends: Primary (months to years), Secondary (weeks to months), Minor (days to weeks).
3. Primary trends have three phases:
   - Accumulation Phase: Smart money buys while the public is unaware.
   - Public Participation Phase: Trend becomes obvious; majority starts participating.
   - Distribution Phase: Smart money sells to the late-arriving crowd.
4. Stock market indices must confirm each other — a bull market in NIFTY should be confirmed by BANKNIFTY.
5. Volume must confirm the trend — rising price on rising volume is healthy; rising price on falling volume is suspect.
6. A trend is assumed to be in force until it gives a definite reversal signal.

IDENTIFYING TREND DIRECTION:
- Uptrend (Bullish): Series of Higher Highs (HH) and Higher Lows (HL). Each new swing high exceeds the previous high; each pullback holds above the previous low.
- Downtrend (Bearish): Series of Lower Highs (LH) and Lower Lows (LL). Each bounce fails to reach the previous high; each selloff makes a new low.
- Sideways/Range: Price oscillates between a defined support and resistance without making new HH or LL.

TREND CHANGE SIGNALS:
- Bullish-to-Bearish reversal: Price makes a new higher high but the subsequent pullback breaks below the most recent higher low (HL violation). This signals potential trend reversal.
- Bearish-to-Bullish reversal: Price makes a new lower low but the subsequent rally exceeds the most recent lower high (LH violation). This signals potential trend reversal.

SUPPORT AND RESISTANCE:
- Support: A price level where buying interest is strong enough to prevent further decline. Previous lows, HLs in an uptrend, and areas of prior consolidation act as support.
- Resistance: A price level where selling pressure prevents further advance. Previous highs, LHs in a downtrend, and breakout levels act as resistance.
- Role reversal: A broken resistance becomes support; a broken support becomes resistance.

APPLICATION IN INDIAN MARKETS:
- NIFTY 50 and BANKNIFTY trends should ideally confirm each other for high-confidence directional trades.
- Weekly and monthly trend determines the primary direction; daily and intraday charts are used for entries.
- Major S/R levels on weekly/monthly charts (round numbers, previous year highs/lows) attract institutional attention.
- The Nifty 50 All-Time High (ATH) and major swing highs (e.g., pre-COVID, post-COVID) serve as critical resistance zones.

PRACTICAL RULES:
- Only trade in the direction of the primary trend; countertrend trades have lower probability.
- Wait for a confirmed HL in uptrend before entering long — don't try to buy at the exact low.
- A series of 3 consecutive lower closes below a key moving average (e.g., 50-EMA) often confirms a trend shift.
- Volume spike at support confirms buying interest; volume dry-up near resistance confirms selling pressure.
"""
    },

    {
        "id": "moving_averages",
        "title": "Moving Average Systems — EMA & SMA",
        "content": """
MOVING AVERAGE SYSTEMS — EMA & SMA

Moving averages smooth price action and identify the direction of the trend.
They are the most widely used indicators in technical analysis.

TYPES OF MOVING AVERAGES:
- Simple Moving Average (SMA): Equally weights all candles in the lookback period.
  - SMA20: Short-term trend. Used in Bollinger Bands.
  - SMA50: Medium-term trend. Widely watched by institutional traders.
  - SMA200: Long-term trend. The "bull market" line — price above SMA200 = bull, below = bear.
- Exponential Moving Average (EMA): Gives more weight to recent candles. Reacts faster than SMA.
  - EMA9: Fastest signal; good for momentum and intraday triggers.
  - EMA21: Short-term trend; key dynamic support in trending markets.
  - EMA50: Medium-term trend filter; widely used by swing traders.
  - EMA200: Long-term trend; institutional benchmark.

THE EMA STACK (Golden Arrangement):
- Bullish Stack: EMA9 > EMA21 > EMA50 > EMA200. All EMAs in order from fastest to slowest with each above the next. This is the ideal uptrend condition.
- Bearish Stack: EMA9 < EMA21 < EMA50 < EMA200. All EMAs in inverse order. Ideal downtrend condition.
- Mixed/Choppy: EMAs criss-crossing each other. Avoid trading in this condition.

GOLDEN CROSS AND DEATH CROSS:
- Golden Cross: 50-SMA crosses above 200-SMA. Long-term bullish signal. In NIFTY, golden crosses on weekly charts have preceded significant bull runs.
- Death Cross: 50-SMA crosses below 200-SMA. Long-term bearish signal. Less reliable in isolation but powerful with other confirmation.
- Note (Bulkowski stats): Golden Cross has ~65% success rate for producing a further 10% gain within 6 months; Death Cross has ~60% accuracy.

EMA AS DYNAMIC SUPPORT AND RESISTANCE:
- In a strong uptrend, price repeatedly bounces off EMA21 or EMA50 during pullbacks.
- The EMA21 Pullback is one of the most reliable intraday and swing setups:
  1. Market in clear uptrend (EMA9 > EMA21 > EMA50).
  2. Price pulls back to EMA21 (within 1x ATR of EMA21).
  3. RSI pulls back but stays above 43 (trend intact).
  4. A bullish reversal candle (hammer, bullish engulfing) forms at EMA21.
  5. Enter long; SL below EMA21 or nearest swing low.
- In downtrend, price bounces up to EMA21 then fails — this is the EMA21 short entry.

PRACTICAL ENTRY RULES:
- Do not buy when price is extended 3+ ATR above EMA21 — wait for the pullback.
- EMA50 acts as the "last line of defense" for the trend; a close below EMA50 shifts bias to neutral/bearish.
- EMA200 crossovers are slow signals but have high significance for medium-term traders.
- For intraday trades, use EMA9 as the momentum indicator and EMA21 as the trend filter.

INDIAN MARKET APPLICATION:
- BANKNIFTY trends are faster (use EMA9/EMA21 on 5-min or 15-min charts).
- NIFTY 50 daily EMA50 is one of the most-watched levels by institutions and fund managers.
- Many mutual funds rebalance when NIFTY crosses above/below the 200-DMA, creating self-reinforcing price action.
- Pre-budget and pre-event: EMAs compress (prices consolidate); post-event: sharp expansion above or below EMA stack.
"""
    },

    {
        "id": "rsi",
        "title": "RSI Analysis — Relative Strength Index",
        "content": """
RSI ANALYSIS — RELATIVE STRENGTH INDEX

The RSI (Relative Strength Index), developed by J. Welles Wilder Jr., measures the speed and change
of price movements. It oscillates between 0 and 100.

FORMULA AND INTERPRETATION:
- RSI = 100 – (100 / (1 + RS)), where RS = Average Gain / Average Loss over 14 periods.
- RSI > 70: Overbought — price has risen rapidly; may be due for pullback.
- RSI < 30: Oversold — price has fallen rapidly; may be due for bounce.
- RSI 40-60: Neutral zone — no strong momentum signal.

RSI IN TRENDING MARKETS (Trend Following Interpretation):
- In a STRONG UPTREND, RSI oscillates between 40 and 80:
  - RSI pulling back to 40-50 = healthy correction; potential buy zone.
  - RSI reaching 80+ in a very strong trend = extreme momentum; expect mini-pullback.
- In a STRONG DOWNTREND, RSI oscillates between 20 and 60:
  - RSI bouncing to 50-60 = dead-cat bounce; potential sell zone.
  - RSI reaching 20 = extreme panic selling; potential short-term bounce.

RSI DIVERGENCE (High-Probability Reversal Signal):
- Bullish Divergence: Price makes a new Lower Low, but RSI makes a Higher Low. Indicates exhaustion of selling pressure. Best when RSI is below 40.
- Bearish Divergence: Price makes a new Higher High, but RSI makes a Lower High. Indicates exhaustion of buying pressure. Best when RSI is above 60.
- Hidden Bullish Divergence: Price makes a Higher Low, RSI makes a Lower Low. Trend continuation signal in an uptrend.
- Hidden Bearish Divergence: Price makes a Lower High, RSI makes a Higher High. Trend continuation signal in a downtrend.
- Note: Divergences are early warning signals, not immediate triggers. Wait for price confirmation before entering.

RSI FAILURE SWINGS (Reversal Confirmation):
- Bullish Failure Swing: RSI falls below 30, bounces above 30, pulls back (but stays above 30), then surges above the prior bounce high. This is a strong bullish signal.
- Bearish Failure Swing: RSI rises above 70, drops below 70, bounces (but stays below 70), then falls below the prior low. Strong bearish signal.

BULKOWSKI STATISTICS FOR RSI:
- RSI Bullish Divergence (with price confirmation): ~66% accuracy for a reversal.
- RSI Overbought reversal from >70: Only ~28% of the time does price immediately reverse; often price stays overbought in strong trends.
- RSI Oversold bounce from <30: ~63% accuracy for at least a 5% bounce within 2 weeks.
- RSI crossing 50 upward from below: ~58% accuracy for trend continuation.

RSI PRACTICAL RULES:
1. Use RSI as a FILTER, not a trigger. RSI overbought alone is not a sell signal in a bull market.
2. In an uptrend: only take long trades when RSI > 45; avoid longs when RSI > 75.
3. In a downtrend: only take short trades when RSI < 55; avoid shorts when RSI < 25.
4. Divergence + reversal candle + volume confirmation = high-probability trade setup.
5. 14-period RSI is standard; 9-period RSI is faster and more sensitive (use for intraday).

INDIAN MARKET NOTES:
- BANKNIFTY RSI is more volatile than NIFTY due to sector concentration.
- On weekly NIFTY charts, RSI > 75 has historically preceded significant corrections (15-25%).
- F&O expiry weeks often create false RSI signals due to gamma effects — be cautious of extremes near expiry.
- When FII buying is intense (visible from FII/DII data), RSI can stay overbought (70-80) for weeks.
"""
    },

    {
        "id": "macd",
        "title": "MACD — Moving Average Convergence Divergence",
        "content": """
MACD — MOVING AVERAGE CONVERGENCE DIVERGENCE

MACD, developed by Gerald Appel, is a trend-following momentum indicator that shows the relationship
between two exponential moving averages. Standard settings: Fast EMA 12, Slow EMA 26, Signal 9.

COMPONENTS:
1. MACD Line: EMA12 – EMA26. Positive when short-term momentum is above long-term (bullish).
2. Signal Line: 9-period EMA of the MACD line. Used for crossover signals.
3. Histogram: MACD Line – Signal Line. Visual representation of momentum.
   - Positive histogram: MACD above Signal = bullish momentum building.
   - Negative histogram: MACD below Signal = bearish momentum building.
   - Histogram shrinking toward zero: momentum is fading — potential crossover approaching.

MACD SIGNALS:
1. Signal Line Crossover:
   - Bullish: MACD crosses above Signal Line. Entry signal when combined with trend confirmation.
   - Bearish: MACD crosses below Signal Line. Short entry when combined with downtrend.
2. Zero Line Crossover:
   - MACD crossing above zero: confirms bullish trend (EMA12 > EMA26).
   - MACD crossing below zero: confirms bearish trend (EMA12 < EMA26).
   - Zero line crossovers are STRONGER signals than signal line crossovers.
3. Histogram Analysis:
   - Increasing histogram bars (in positive territory): momentum is strengthening — hold or add to longs.
   - Decreasing histogram bars (from positive): momentum fading — tighten SL, consider partial exits.
   - First negative histogram bar after positive: early warning of possible trend reversal.

MACD DIVERGENCE (Highly Reliable):
- Bullish Divergence: Price makes new LL but MACD histogram makes a higher low. Powerful when occurring below zero line. Entry: first bullish candle after divergence confirms.
- Bearish Divergence: Price makes new HH but MACD histogram makes a lower high. Powerful when occurring above zero line. Entry: first bearish candle after divergence confirms.
- Bulkowski notes: MACD Divergence has ~60% success rate for producing a meaningful reversal; success rate increases to ~72% when combined with a trend line break.

PRACTICAL RULES:
1. Never use MACD crossovers alone — they lag significantly. Always combine with RSI and price structure.
2. Use the HISTOGRAM to time entries, not the crossover (histogram turns positive before MACD crosses signal).
3. In a strong uptrend, MACD may stay above zero for weeks — don't fight the trend because MACD looks "extended."
4. The best MACD setups are zero-line crossovers WITH divergence — both signals confirm together.
5. On weekly charts, zero-line crossovers have very high significance for swing/positional traders.

SETTINGS FOR DIFFERENT TIMEFRAMES:
- Intraday (5m/15m): Standard 12,26,9 works well. Some traders use 5,13,1 for faster signals.
- Swing (Daily): Standard 12,26,9 is widely used. Also try 8,21,5.
- Positional (Weekly): Consider 8,21,5 for earlier signals.

INDIAN MARKET APPLICATION:
- NIFTY weekly MACD zero-line crossover has been a reliable tool for identifying major bull/bear market regimes.
- BANKNIFTY 15-min MACD is popular among intraday traders for quick momentum entries.
- Around F&O expiry, MACD on short timeframes can give false signals due to gamma-driven volatility — use daily charts for confirmation.
- When NIFTY and BANKNIFTY both have positive MACD histograms on daily charts, market internals are healthy for long trades.
"""
    },

    {
        "id": "volume_vsa",
        "title": "Volume Analysis & VSA (Volume Spread Analysis)",
        "content": """
VOLUME ANALYSIS & VSA (VOLUME SPREAD ANALYSIS)

Volume is the number of shares or contracts traded in a given period. It is the fuel for price movement.
Volume Spread Analysis (VSA), developed by Tom Williams based on Richard Wyckoff's work, uses the
relationship between volume, price spread, and closing position to identify institutional activity.

BASIC VOLUME PRINCIPLES:
1. Volume confirms price movement:
   - Rising price + Rising volume = Strong, healthy trend. Institutions are buying.
   - Rising price + Falling volume = Weak rally, likely to fail. No institutional support.
   - Falling price + Rising volume = Strong selling. Distribution or panic.
   - Falling price + Falling volume = Low conviction selling. Often precedes a bounce.
2. High volume at key levels signals institutional participation (accumulation or distribution).
3. Volume drying up (extremely low volume) signals that the prevailing trend is losing participants — often precedes reversal.

VOLUME RATIO:
- Volume Ratio = Current bar volume / 20-period average volume.
- Ratio > 1.5x: Above-average activity — significant institutional move.
- Ratio > 2.0x: Very high — potential climactic buying or selling. Key VSA event.
- Ratio < 0.7x: Very low — lack of interest; breakouts on low volume are unreliable.

VSA KEY PATTERNS:
1. STOPPING VOLUME (Bullish):
   - Occurs after a prolonged downtrend.
   - Very high volume bar with the close in the upper half of the bar's range.
   - Signals that demand is overwhelming supply — institutions are absorbing selling.
   - Follow-up: if the next bar is an up-bar with moderate volume, the low is likely set.

2. NO SUPPLY (Bullish Setup):
   - A narrow-range down bar with below-average volume.
   - Signals that sellers have dried up — the market is ready to move up if demand enters.
   - Best seen after a brief pullback in an uptrend.

3. UPTHRUST (Bearish):
   - Price pushes above a resistance level (making a new high) but closes near the low of the bar.
   - High volume. Signals that institutions are selling into the breakout — trapping buyers.
   - The close near the low despite a new high is the key reversal signal.

4. NO DEMAND (Bearish Setup):
   - A narrow-range up bar with below-average volume in a downtrend.
   - Sellers still in control; weak buyers unable to generate sustained rally.

5. CLIMACTIC BUYING (Distribution):
   - Extremely high volume up bar (2x+ average) with a close in the middle or lower half of the bar.
   - Smart money distributing (selling) to eager buyers. Often marks a medium-term top.

6. CLIMACTIC SELLING (Potential Bottom):
   - Extremely high volume down bar with a wide spread, but close in the upper half.
   - Panic selling being absorbed by smart money. Often marks a medium-term bottom.

VOLUME AND BREAKOUTS:
- A valid breakout above resistance should be accompanied by volume ≥ 1.5x average.
- A breakout on low volume (<0.8x average) is likely a false breakout — fade it or wait for retest.
- The FIRST pullback after a high-volume breakout (to the breakout level, with low volume) is the highest-probability re-entry.

INDIAN MARKET NOTES:
- NSE provides daily FII and DII data. When FIIs are net buyers + volume is high in NIFTY heavyweights (Reliance, HDFC Bank, Infosys), the trend is sustainable.
- Muhurat trading session (Diwali) often has low volume but ceremonial buying — VSA signals on this day are unreliable.
- Block deals and bulk deals on NSE/BSE are high-volume institutional signals. A large block deal at key support confirms accumulation.
- Around result season (Q1: July, Q2: October, Q3: January, Q4: April), individual stocks have extremely high volume — use VSA to gauge whether the move is genuine or manipulated.
"""
    },

    {
        "id": "candlesticks",
        "title": "Candlestick Patterns with Reliability Rates",
        "content": """
CANDLESTICK PATTERNS WITH RELIABILITY RATES

Japanese candlestick patterns identify short-term reversal and continuation signals.
Reliability stats below are based on Thomas Bulkowski's Encyclopedia of Candlestick Charts
(testing on thousands of occurrences, measuring frequency of a 10-bar continuation).

SINGLE-BAR REVERSAL PATTERNS:

1. HAMMER (Bullish Reversal):
   - Criteria: Small body at the top, long lower shadow ≥ 2x body, little/no upper shadow.
   - Occurs after a downtrend. Wick shows sellers pushed price down but buyers reclaimed control.
   - Reliability (Bulkowski): 60-65% accuracy for a reversal, best with volume confirmation.
   - Entry: Buy above the hammer's high. SL below the hammer's low.

2. SHOOTING STAR (Bearish Reversal):
   - Criteria: Small body at the bottom, long upper shadow ≥ 2x body, little/no lower shadow.
   - Occurs after an uptrend. Shows buyers pushed price up but sellers reclaimed control.
   - Reliability: 59% accuracy. Best at resistance levels with high volume.
   - Entry: Sell below shooting star's low. SL above the high.

3. DOJI (Indecision):
   - Criteria: Open ≈ Close; equal-length wicks. Signals balanced supply and demand.
   - Standalone doji has low predictive value; context matters (at support in uptrend = bullish; at resistance in downtrend = bearish).
   - Gravestone Doji (long upper wick): 51% reversal rate (weak).
   - Dragonfly Doji (long lower wick): 61% reversal rate in downtrend (stronger).

4. SPINNING TOP:
   - Small body with roughly equal upper and lower shadows. Pure indecision.
   - Reliability: Very low in isolation. Use only at key S/R levels.

TWO-BAR PATTERNS:

5. BULLISH ENGULFING (Bullish Reversal):
   - Criteria: A bearish candle followed by a bullish candle whose body completely engulfs the prior bar's body.
   - One of the most reliable reversal patterns. Reliability: 63% (Bulkowski). Higher at major support.
   - Entry: Buy above the engulfing candle's high. SL below the pattern's low.

6. BEARISH ENGULFING (Bearish Reversal):
   - Criteria: A bullish candle followed by a bearish candle whose body engulfs the prior bullish body.
   - Reliability: 61%. Best at major resistance or after extended uptrend.

7. TWEEZER TOPS / BOTTOMS:
   - Two candles with identical (or near-identical) highs (top) or lows (bottom).
   - Tweezer Top: 57% reversal accuracy. Tweezer Bottom: 62% reversal accuracy.

THREE-BAR PATTERNS:

8. MORNING STAR (Bullish Reversal):
   - Three candles: bearish candle, small-body candle (star) gapping lower, bullish candle closing into first candle's body.
   - High reliability: 68% (Bulkowski). Best at support or after long downtrend.
   - Entry: Buy above third candle's close. SL below the star's low.

9. EVENING STAR (Bearish Reversal):
   - Three candles: bullish candle, small-body star gapping higher, bearish candle closing into first candle's body.
   - Reliability: 66%. Best at resistance or after long uptrend.

10. THREE WHITE SOLDIERS (Bullish Continuation):
    - Three consecutive bullish candles, each opening within the prior candle's body and closing near the high.
    - Reliability for continuation: 62%. Often precedes strong trending moves.

11. THREE BLACK CROWS (Bearish Continuation):
    - Three consecutive bearish candles, each opening within the prior candle's body and closing near the low.
    - Reliability: 64%. Powerful after topping patterns.

RULES FOR TRADING CANDLESTICK PATTERNS:
1. Always confirm with volume — a reversal candle with 2x+ average volume has significantly higher reliability.
2. Context is everything: a hammer at major weekly support is far more meaningful than a hammer in the middle of a range.
3. Use candlestick patterns as TRIGGERS, not as standalone signals. The trend, S/R, and indicators must align.
4. The larger the candle (relative to recent ATR), the more significant the signal.
5. After a reversal pattern, if price fails to follow through within 2 bars, the pattern is invalidated.

INDIAN MARKET NOTES:
- BANKNIFTY 15-min and 1-hour candlestick patterns at VWAP are highly reliable due to liquidity.
- Opening candle (9:15-9:30 IST) is often volatile and unreliable; wait for 9:30 AM confirmation candle.
- Evening star patterns on weekly NIFTY charts near round numbers (18000, 17000, 22000) have historically preceded corrections.
"""
    },

    {
        "id": "vwap",
        "title": "VWAP Trading — Volume Weighted Average Price",
        "content": """
VWAP TRADING — VOLUME WEIGHTED AVERAGE PRICE

VWAP (Volume Weighted Average Price) is the average price a security has traded at throughout the day,
weighted by volume. It is the benchmark price used by institutional traders to assess trade execution quality.

FORMULA:
VWAP = Σ(Typical Price × Volume) / Σ(Volume)
where Typical Price = (High + Low + Close) / 3

VWAP INTERPRETATION:
1. If price is above VWAP: Buyers are in control of the day's trade. Bullish intraday bias.
2. If price is below VWAP: Sellers are in control. Bearish intraday bias.
3. VWAP is a magnet: price constantly tries to revert to VWAP, especially in low-momentum sessions.

INSTITUTIONAL USAGE:
- Institutions buy "at or below VWAP" and sell "at or above VWAP" to ensure favorable execution.
- A large institutional buy order will push price above VWAP momentarily; the institution's own selling to cover the order then brings price back to VWAP.
- When FIIs are aggressively buying, the stock stays above VWAP all day and makes successive VWAP re-tests as support.

STANDARD DEVIATION BANDS:
- VWAP ± 1 Standard Deviation contains ~68% of price action for the day.
- VWAP ± 2 Standard Deviations contains ~95%.
- Price reaching +2 SD above VWAP is statistically extended and has ~62% chance of reverting to at least +1 SD (Bulkowski-style stats for mean reversion).
- Price reaching -2 SD below VWAP has ~63% chance of reverting to -1 SD in a normal session.

VWAP TRADING STRATEGIES:
1. VWAP BOUNCE (Long):
   - Prerequisite: Overall market bias is bullish; stock above VWAP earlier in the day.
   - Wait for price to pull back to VWAP.
   - Entry: First bullish candle bouncing off VWAP with volume ≥ 1.2x average.
   - SL: Below VWAP (typically 0.3-0.5 ATR below).
   - Target: VWAP + 1 ATR, or prior session high.

2. VWAP BREAKDOWN RETEST (Short):
   - Price was above VWAP, then broke below with high volume.
   - Rally back to VWAP (now resistance) with low volume.
   - Entry: Sell at VWAP resistance. SL above VWAP.
   - Target: -1 ATR from VWAP.

3. VWAP BREAKOUT (Long/Short):
   - Price consolidating below VWAP (bearish drift) then surges above VWAP with volume > 2x.
   - Signals institutional buying overwhelming supply.
   - Entry: Buy above VWAP high of breakout candle. SL: re-entry below VWAP.

ANCHORED VWAP:
- Anchor VWAP to significant dates: IPO date, earnings announcement, major correction low.
- Anchored VWAP acts as a running average of all activity since that reference point.
- Price recovering above anchored VWAP after a correction = bullish signal; below = bearish.

RULES:
1. VWAP resets at 9:15 AM IST for Indian markets (NSE open). Use fresh daily VWAP for intraday.
2. Avoid VWAP trades in the first 15 minutes (9:15–9:30 AM) — VWAP is distorted by opening volatility.
3. Best VWAP bounces occur between 10:00 AM and 12:00 PM and again from 2:00 PM to 3:30 PM (power hour).
4. VWAP signals are INTRADAY signals only. Do not use daily VWAP for swing trade decisions.
5. In trending days (gap up or gap down), price may not return to VWAP at all — recognizing trend days early is crucial.

INDIAN MARKET SPECIFICS:
- NSE/BSE trading hours: 9:15 AM to 3:30 PM IST.
- Pre-market session: 9:00 AM to 9:15 AM (order matching). Pre-open prices can indicate gap direction.
- GIFT NIFTY (formerly SGX NIFTY): Traded from 6:30 AM IST. Used to gauge early morning sentiment; a leading indicator for NIFTY open.
- BANKNIFTY VWAP is more reliable than NIFTY VWAP for intraday due to lower noise from individual bank stocks.
"""
    },

    {
        "id": "bollinger_bands",
        "title": "Bollinger Bands — Volatility & Mean Reversion",
        "content": """
BOLLINGER BANDS — VOLATILITY & MEAN REVERSION

Bollinger Bands, developed by John Bollinger in the 1980s, consist of a middle band (20-period SMA)
and two outer bands set at 2 standard deviations above and below the middle band.

COMPONENTS:
- Upper Band: SMA20 + (2 × Standard Deviation)
- Middle Band: SMA20 (also acts as dynamic support/resistance)
- Lower Band: SMA20 – (2 × Standard Deviation)
- %B: (Price – Lower Band) / (Upper Band – Lower Band). Shows where price is within the bands.
  - %B > 1.0: Price above upper band. %B < 0.0: Price below lower band.
- Bandwidth: (Upper Band – Lower Band) / Middle Band. Measures volatility expansion/contraction.

INTERPRETATION:
1. TOUCHING THE BANDS:
   - Touching the upper band is NOT a sell signal — in a strong uptrend, price walks up the upper band.
   - Touching the lower band is NOT a buy signal — in a downtrend, price walks down the lower band.
   - These extremes only become reversal signals with confirming indicators (RSI divergence, reversal candle).

2. BOLLINGER BAND SQUEEZE (Low Bandwidth):
   - When bands contract to their narrowest in 6 months, a major move is imminent.
   - The squeeze itself doesn't tell direction — wait for price to close outside the bands.
   - Bulkowski: After a squeeze, price moves at least 3.5% on average before reversing.
   - Strategy: Buy when price closes above upper band after a squeeze. Sell when it closes below lower band.

3. BOLLINGER BAND BREAKOUT:
   - A close above the upper band signals strong upside momentum.
   - Follow-up entry: If price pulls back to middle band and then bounces, that is the second entry.
   - If price closes back inside after breaking above: false breakout — close long position.

4. W-BOTTOM (Double Bottom at Lower Band) — Reliable Bullish Pattern:
   - First touch of lower band with high volume (panic selling).
   - Bounce to middle band.
   - Second test of lower band (or nearby) with LOWER volume (selling exhaustion).
   - Second low does not need to be lower than first low.
   - %B makes a higher low while price makes a lower low = bullish divergence.
   - Reliability: 67% for a rally back to at least the middle band (Bulkowski).

5. M-TOP (Double Top at Upper Band) — Reliable Bearish Pattern:
   - Mirror image of W-bottom. Two touches of upper band; second touch with lower volume.
   - %B makes a lower high while price makes a higher high = bearish divergence.
   - Reliability: 65% for a decline to at least the middle band.

PRACTICAL RULES:
1. Use Bollinger Bands WITH RSI: Band extreme + RSI divergence = highest probability mean-reversion setup.
2. In a trending market (EMA9 > EMA21 > EMA50), price can stay at/above the upper band for long stretches. Use the middle band as support for adding to positions.
3. Bandwidth below its 6-month average = squeeze = impending breakout. Prepare straddle or watch for breakout direction.
4. The middle band (SMA20) is a strong dynamic support in uptrends; often aligns with EMA21 area.
5. For mean-reversion trades: only take them when the overall market is in a range (sideways phase).

SETTINGS:
- Standard: 20 periods, 2 standard deviations. Works well for swing trading on daily charts.
- Intraday: 20 periods, 2 SD on 15-min or 1-hour charts. Or use 10 periods, 1.5 SD on 5-min.
- Tighter bands (1.5 SD) give more touches; wider bands (2.5 SD) fewer, more significant touches.

INDIAN MARKET NOTES:
- NIFTY and BANKNIFTY Bollinger Band squeezes on daily charts often precede budget-related moves or major events.
- After budget day, Bollinger Bands expand dramatically. The first pullback to the SMA20 post-expansion is a high-quality entry.
- Individual stocks often have Bollinger Band squeezes before earnings announcements. Trade the post-result breakout.
"""
    },

    {
        "id": "atr_volatility",
        "title": "ATR & Volatility — Position Sizing and Stop Placement",
        "content": """
ATR & VOLATILITY — POSITION SIZING AND STOP PLACEMENT

The Average True Range (ATR), developed by Welles Wilder, measures market volatility.
It is essential for setting intelligent stop losses and sizing positions.

FORMULA:
- True Range = MAX(High – Low, |High – Previous Close|, |Low – Previous Close|)
- ATR(14) = 14-period Wilder smoothed average of True Range

INTERPRETATION:
- ATR measures the average movement per bar, accounting for gaps.
- Higher ATR = more volatile market/stock = wider stop losses needed.
- Lower ATR = quieter market = tighter stops are safer.
- ATR does NOT indicate direction — it only measures volatility magnitude.

ATR-BASED STOP LOSS PLACEMENT:
The most robust stop-loss placement uses ATR to adapt to current market volatility:
- Conservative SL: Entry – (1.0 × ATR) for longs; Entry + (1.0 × ATR) for shorts.
- Standard SL:     Entry – (1.5 × ATR) for longs; Entry + (1.5 × ATR) for shorts.
- Loose SL:        Entry – (2.0 × ATR) for longs; Entry + (2.0 × ATR) for shorts. (For swing trades.)
- The 1.5x ATR stop ensures you're not stopped out by normal market noise while limiting risk.
- Never set SL tighter than 0.5x ATR — you'll be stopped out by routine volatility.

ATR IN POSITION SIZING (KEY RULE):
Position Size = Risk Amount / (ATR × ATR Multiplier)
Example: Capital = ₹1,00,000. Risk 1% = ₹1,000. ATR on RELIANCE = ₹25. Stop = 1.5x ATR = ₹37.50.
Position Size = ₹1,000 / ₹37.50 = 26 shares.
This ensures: if stopped out, you lose exactly ₹975 (slightly under 1% of capital).

ATR AND TARGETS:
- Minimum Target = Entry ± 1.5x Risk (where Risk = ATR × multiplier). This gives 1:1 R:R.
- Preferred Target = Entry ± 2.0–2.5x Risk for 1:2 to 1:2.5 R:R.
- For intraday: a 3x ATR move in one day is unusual (>90th percentile). Use as ambitious target.
- For swing: a 5-7x ATR move in a week is achievable in strong trending stocks.

VOLATILITY REGIMES:
- LOW VOLATILITY (ATR contracting for 5+ sessions): Consolidation / squeeze. Small positions; anticipate breakout.
- NORMAL VOLATILITY (ATR near 20-day average): Normal trading conditions. Standard position sizes.
- HIGH VOLATILITY (ATR 2x+ above 20-day average): Reduce position size proportionally. Wide stops, wider targets.
- EXTREME VOLATILITY (post-event, crash, or earnings): Use ≤50% normal position size. Markets are unpredictable.

CHANDELIER EXIT (Trailing Stop using ATR):
- Dynamic trailing stop that moves up as price moves up (for longs).
- Stop = Highest High (last N bars) – (ATR × multiplier).
- Common settings: 3x ATR lookback 22 bars.
- Lets profits run while protecting against sharp reversals.

VOLATILITY INDICATORS DERIVED FROM ATR:
1. Keltner Channels: EMA20 ± 2x ATR. When Bollinger Bands are inside Keltner Channels = Squeeze (high probability breakout pending).
2. ATR Bands: EMA + n×ATR. Used to identify extended moves.
3. Normalized ATR (NATR): ATR / Close × 100. Percentage volatility. Useful for comparing volatility across stocks with different prices.

INDIAN MARKET NOTES:
- NIFTY 50 normal daily ATR is approximately 50-100 points on normal days; can spike to 200-400 points on event days (budget, Fed meetings, RBI policy).
- BANKNIFTY daily ATR is typically 150-300 points; spikes to 500-1000+ on high-volatility days.
- Before F&O expiry Thursday, ATR on near-month options can be 30-50% above weekly average due to gamma effects.
- After RBI Monetary Policy announcements, ATR on banking stocks spikes for 1-2 sessions before normalizing.
- Position sizing rule for F&O (options/futures): Always calculate ATR-based risk on the underlying, then translate to lot sizes.
"""
    },

    {
        "id": "risk_management",
        "title": "Risk Management — Position Sizing, R-Multiples, and Kelly Criterion",
        "content": """
RISK MANAGEMENT — POSITION SIZING, R-MULTIPLES, AND KELLY CRITERION

Risk management is the single most important skill for long-term trading survival.
A trader with a mediocre strategy but excellent risk management will outlast
a trader with a great strategy but poor risk management.

THE 1% RULE:
- Never risk more than 1-2% of total trading capital on any single trade.
- Example: ₹5,00,000 capital × 1% = ₹5,000 maximum risk per trade.
- This ensures that even 10 consecutive losses (0.1% probability with a 60% win rate) only reduce capital by 10%.
- New traders: Use 0.5% per trade until consistently profitable.

R-MULTIPLES (Risk Units):
- R = The amount risked on a single trade (distance from entry to SL × position size).
- Every trade is measured in multiples of R:
  - Win 1.5x the risk = +1.5R win.
  - Loss of full stop = -1R loss.
- Expectancy = (Win Rate × Average Win in R) – (Loss Rate × Average Loss in R)
  - A strategy with 50% win rate and 1.5R wins : 1R losses has expectancy = (0.5 × 1.5) – (0.5 × 1.0) = +0.25R per trade.
  - This means on average, you gain 0.25R per trade. With 100 trades at ₹5,000 risk each = ₹1,25,000 profit.
- To be profitable long-term, your average win (in R) must exceed your average loss (in R) when adjusted for win rate.

MINIMUM ACCEPTABLE R:R RATIOS:
- Minimum for any trade: 1:1.5 (risk ₹1 to make ₹1.50).
- Preferred: 1:2 or better.
- For lower win-rate strategies (30-40% win rate): need 1:3+ R:R to be profitable.
- Formula: Minimum R:R = (1 – Win Rate) / Win Rate. At 40% win rate: 0.6/0.4 = 1:1.5 minimum.

EXPECTANCY AND SYSTEM QUALITY:
- Track your last 50 trades. Calculate: Average win (in ₹) × Win% – Average loss (in ₹) × Loss%.
- Positive expectancy: long-term profitable system.
- System Quality Number (SQN, by Van Tharp): SQN = (Average R / StdDev of R) × √N.
  - SQN > 2.0: Good system. SQN > 3.0: Excellent. SQN > 5.0: World-class.

KELLY CRITERION:
- Kelly % = (Win Rate × Average Win / Average Loss – Loss Rate) / (Average Win / Average Loss)
- Kelly tells you the MAXIMUM fraction of capital to risk per trade for maximum geometric growth.
- In practice, use HALF-Kelly (50% of Kelly output) to reduce volatility of returns.
- Example: 60% win rate, 1.5:1 average win/loss ratio.
  - Kelly = (0.6 × 1.5 – 0.4) / 1.5 = (0.9 – 0.4) / 1.5 = 0.5/1.5 = 33%.
  - Half-Kelly = 16.5% per trade. (Very aggressive even at half — most traders cap at 2-5%.)

POSITION SIZING METHODS:
1. Fixed Fractional (% Risk): Risk fixed % of account. Position grows as account grows, shrinks after losses. Best method for consistent compounding.
2. Fixed Lot: Trade same quantity each time. Simple but doesn't adapt to volatility or account size changes.
3. ATR-Based: Position Size = (Account × Risk%) / (ATR × ATR Multiplier). Adapts to volatility.
4. Volatility-Adjusted: Normalize risk across all trades so each trade has the same "volatility risk." Ideal for trading multiple instruments.

DRAWDOWN MANAGEMENT:
- Maximum Drawdown rule: If account drops 10% from peak, reduce position sizes by 25%. If 20% drawdown, reduce by 50%. If 30%, stop trading and review.
- Never try to "make back" losses with larger position sizes — this is how accounts blow up.
- A 50% drawdown requires a 100% gain just to return to breakeven.

COMMON RISK MISTAKES:
1. Moving Stop Losses wider after entry — turns a small loss into a large one.
2. Adding to a losing position (averaging down without a plan) — increases risk.
3. Not taking partial profits — holding winners too long and letting profits evaporate.
4. Overtrading after a win (feeling invincible) or after a loss (trying to recover).
5. Risking 5-10% on single trades — a streak of 5 losses can wipe out 30-50% of capital.

INDIAN MARKET SPECIFIC RULES:
- F&O traders: Calculate margin usage vs. capital carefully. Don't use >50% of capital as margin in high-volatility periods.
- Options buyers: Limit options premium to 2-5% of capital per position. Options can go to zero.
- Circuit limits: 5%, 10%, 20% upper/lower circuits on individual stocks mean you may not be able to exit. Size small in illiquid stocks.
- Use Good Till Triggered (GTT) orders on NSE to automate stop losses — don't rely on watching screens.
"""
    },

    {
        "id": "indian_market",
        "title": "Indian Market Specifics — NIFTY, BANKNIFTY, F&O, FII/DII",
        "content": """
INDIAN MARKET SPECIFICS — NIFTY, BANKNIFTY, F&O, FII/DII

Understanding the structure of Indian financial markets is essential for trading NSE/BSE instruments effectively.

MAJOR INDICES:
- NIFTY 50: Benchmark index of top 50 large-cap stocks listed on NSE. Weighted by free-float market cap.
  - Sector weights (approximate 2024): Financial Services 35%, IT 13%, Oil & Gas 12%, Consumer 10%.
  - Key drivers: FII flows, global market cues (Dow Jones, S&P 500, Nasdaq), RBI policy, USD/INR, crude oil.
- BANKNIFTY: Index of 12 most liquid and large-cap banking stocks on NSE.
  - Components: HDFC Bank (largest weight), ICICI Bank, SBI, Kotak Mahindra, Axis Bank, IndusInd Bank.
  - More volatile than NIFTY; moves 1.5-2x NIFTY on most days.
  - FII activity in HDFC Bank and ICICI Bank largely drives BANKNIFTY direction.
- MIDCAP NIFTY 50 / SMALLCAP 50: Higher beta; used for momentum trades.
- INDIA VIX: Volatility index for NIFTY. >20 = high fear; <15 = complacency.
  - India VIX spikes ahead of major events (elections, budget, RBI policy).
  - High VIX = higher option premiums = better for option sellers.

F&O (FUTURES AND OPTIONS) MARKET:
- Derivatives trading on NSE is one of the largest in the world by volume.
- F&O Expiry: Index options (NIFTY, BANKNIFTY) expire every Thursday.
  - Weekly expiry: NIFTY on Thursday, BANKNIFTY on Wednesday (effective 2023; verify current schedule).
  - Monthly expiry: Last Thursday of the month for monthly contracts.
- Expiry Effects on Price:
  - Near expiry, option sellers (who are dominant) try to pin price near maximum pain (strike where most options expire worthless).
  - Large open interest at a specific strike acts as a magnet for price (gamma effect).
  - Tuesday–Wednesday before expiry: highest gamma. Price moves can be sharp and unpredictable.
  - Avoid taking large directional positions near expiry unless you understand gamma exposure.
- Premium Decay (Theta): Options lose time value rapidly in the last 3-5 days. Buy options early; option sellers profit from holding near expiry.

FII AND DII DATA:
- FII (Foreign Institutional Investors): Major drivers of large-cap and index movement.
  - Net FII buying (positive) → NIFTY tends to rise; net selling → NIFTY tends to fall.
  - FII data is published daily by NSE; available on NSE website and moneycontrol.com.
  - USD/INR correlation: Rupee weakening vs. dollar can cause FII selling (lower returns when converted back to USD).
- DII (Domestic Institutional Investors): Mutual funds, insurance companies (LIC), banks.
  - DII buying provides support when FIIs sell; strong DII flows can absorb FII selling.
  - SIP (Systematic Investment Plan) flows into equity mutual funds: ~₹20,000+ crore/month (2024). Creates steady demand.

KEY MARKET TIMINGS (IST — UTC+5:30):
- Pre-open: 9:00 AM – 9:15 AM (order collection and price discovery).
- Regular trading: 9:15 AM – 3:30 PM.
- Post-market: 3:40 PM – 4:00 PM (block deals, portfolio balancing).
- GIFT NIFTY (formerly SGX NIFTY): Trades from 6:30 AM; use for pre-market direction.
- US markets impact: Nasdaq/S&P 500 futures and overnight moves in US markets heavily influence NIFTY opening.

CIRCUIT LIMITS:
- Individual stocks: 5%, 10%, or 20% circuit filter based on stock category.
- NIFTY 50 stocks have circuit limits but typically require >20% move before applying.
- F&O stocks: No intraday circuit limits, but exchange-level market halts if index moves 10%/15%/20%.

INTRADAY TRADING RULES FOR INDIA:
1. No carry forward of intraday positions — square off by 3:20 PM to avoid broker auto-square-off.
2. SEBI's Peak Margin rules (effective 2021): Require 100% margin upfront for F&O. Cannot use leverage for intraday beyond broker-defined limits.
3. STT (Securities Transaction Tax): Payable on options sell side. For futures: 0.01% on turnover. Factor this into P&L calculations.
4. Charges: STT + Exchange transaction charges + SEBI fee + Stamp duty + GST. Total can be 0.05-0.15% of turnover for F&O.
5. Settlement: T+1 for equities, daily mark-to-market for futures.

SEASONAL PATTERNS IN INDIA:
- Budget (February 1): High volatility. Last 5 years: market has moved ±2-5% on budget day.
- Election results: Extremely high volatility. Nifty has moved ±5-10% on result day historically.
- RBI Monetary Policy (every 2 months): BANKNIFTY moves 1-3% on announcement day.
- Q4 Results (April-May): Result season for March year-end companies. High individual stock volatility.
- Diwali/Muhurat Trading: Symbolic 1-hour session; traditionally bullish but low volume.
"""
    },

    {
        "id": "intraday_strategies",
        "title": "Intraday Trading Strategies — ORB, VWAP, Opening Rules",
        "content": """
INTRADAY TRADING STRATEGIES — ORB, VWAP, AND KEY RULES

Intraday trading (buying and selling within the same trading session) requires specific strategies
suited to the fast-moving nature of intraday price action.

CRITICAL INTRADAY RULES:
1. AVOID FIRST 15 MINUTES (9:15–9:30 AM): The opening is chaotic. Gap fills, fake breakouts, and institutional positioning create unreliable signals. Let the market settle.
2. BEST INTRADAY HOURS:
   - Power Hour 1: 9:30 AM – 12:00 PM (trend establishment, ORB trades).
   - Lunchtime (12:00–1:00 PM): Often low volume, choppy. Reduce exposure.
   - Power Hour 2: 1:30 PM – 3:30 PM (trend continuation or reversal with volume).
3. RESPECT THE TREND: The first 30-60 minutes often establish the day's trend. Trading against a strong early trend is low probability.

STRATEGY 1: OPENING RANGE BREAKOUT (ORB)
Opening Range: The high-low range of the first 15 minutes (or 30 minutes) after 9:15 AM.
- ORB High: The highest price in the first 15/30 minutes.
- ORB Low: The lowest price in the first 15/30 minutes.

Trade Rules:
- Long Entry: When price closes above ORB High with volume ≥ 1.5x average.
- Short Entry: When price closes below ORB Low with volume ≥ 1.5x average.
- Stop Loss: Below ORB Low (for long), above ORB High (for short).
- Target: ORB width × 1.5 to 2 projected from the breakout point.
- Filter: Only trade ORB breakouts when the premarket indication (GIFT NIFTY) aligns with direction.
- Avoid: ORB breakout against the previous day's trend on low volume (likely false breakout).
- Statistics: 15-min ORB has ~58% success rate when confirmed by volume; 30-min ORB has ~62%.

STRATEGY 2: VWAP MEAN REVERSION
(Covered in detail in VWAP document)
Key points:
- Effective in sideways/range-bound markets.
- Enter when price reaches VWAP ± 1.5 ATR with confirming RSI.
- Target: Return to VWAP. Exit at VWAP + small profit.
- Does NOT work on trend days (price stays away from VWAP all day).

STRATEGY 3: EMA PULLBACK INTRADAY
Using EMA21 on 5-min or 15-min charts:
- In an uptrend (price above EMA21, EMA9 > EMA21): Wait for price to pull back to EMA21.
- Entry: Bullish reversal candle at EMA21 with RSI > 45.
- Stop: Below EMA21 (0.5 ATR below).
- Target: Next resistance level or 1.5x the SL distance.

STRATEGY 4: GAP FILL
- A stock or index opens with a gap (up or down) from previous close.
- Gap Fill Trade: When gap is <1% and market is not in strong trend, gaps tend to fill within the first 2 hours.
- Long entry: On a gap-down open that shows reversal signal (bullish candle + volume) at support.
- Short entry: On a gap-up open that shows rejection (bearish candle) at resistance.
- Note: Only take gap-fill trades if the gap is < 0.5 ATR; larger gaps often don't fill intraday.

IDENTIFYING TREND VS. RANGE DAYS:
- TREND DAY (80% of the move in one direction):
  - Signs: Gap in trend direction, price staying above/below VWAP all day, volume steady throughout.
  - Strategy: Breakout trades in trend direction; avoid mean reversion.
- RANGE DAY (price oscillates between support and resistance):
  - Signs: Opening gap fills back, price crosses VWAP multiple times.
  - Strategy: VWAP bounces, S/R fades.
- VOLATILE/NEWS DAY: Large gap, spike, reversal. Reduce size; avoid first hour.

MANAGING INTRADAY POSITIONS:
1. Scale out: Take 50% profit at 1x R, let 50% run to 2x R.
2. Trail stop after 1x R: Move stop to breakeven.
3. Hard exit time: Exit ALL positions by 3:15 PM regardless of P&L to avoid late-day volatility.
4. Max loss per day: Set a daily loss limit (e.g., 3% of capital). If hit, stop trading for the day.
5. Max trades per day: Limit to 3-5 trades. More trades = more chances for mistakes.

INTRADAY PSYCHOLOGY:
- The best intraday traders WAIT for setups rather than forcing trades.
- Missing a trade is better than taking a bad trade.
- Do not trade during the first 15 minutes, or right before/after major news events (RBI, FOMC, earnings).
- Record every trade with entry reason, exit, and emotions. Review weekly.
"""
    },

    {
        "id": "mtf_analysis",
        "title": "Multi-Timeframe Analysis — Top-Down Approach",
        "content": """
MULTI-TIMEFRAME ANALYSIS — TOP-DOWN APPROACH

Multi-timeframe analysis (MTF) involves examining the same security across multiple timeframes
to align the trading decision with the broader market structure.

THE TOP-DOWN APPROACH:
1. Start with the HIGHEST timeframe (Weekly or Daily) to determine the PRIMARY trend.
2. Drop to the INTERMEDIATE timeframe (4-hour or 1-hour) to find trade direction.
3. Use the LOWEST timeframe (15-min or 5-min) for precise entry timing.

The rule: Only take trades in the direction of the higher timeframe trend.

STANDARD TIMEFRAME HIERARCHY:
| Trading Style   | Higher TF  | Intermediate TF | Entry TF    |
|-----------------|------------|-----------------|-------------|
| Scalping        | 15 min     | 5 min           | 1 min       |
| Intraday        | 1 hour     | 15 min          | 5 min       |
| Swing           | Daily      | 4 hour          | 1 hour      |
| Positional      | Weekly     | Daily           | 4 hour      |

MTF CONFLUENCE:
- When all three timeframes show the same bias (all Bullish or all Bearish), the trade has maximum confluence.
- Score: 3/3 alignment = Strong signal. 2/3 alignment = Moderate. 1/3 = Weak. 0/3 = Conflicting, no trade.

HOW TO USE MTF ANALYSIS:
Step 1: Check DAILY chart. Is NIFTY/stock above or below EMA50 and EMA200? Is the structure Bullish (HH+HL) or Bearish (LH+LL)?
Step 2: Check 1-HOUR chart. Is the trend aligned with the daily? Are you seeing an EMA pullback or setup forming?
Step 3: Check 15-MIN chart. Look for entry trigger: reversal candle, VWAP bounce, ORB breakout.
Step 4: Enter only if ALL three timeframes agree. Use the 15-min setup for entry, with daily/1h target.

MTF DIVERGENCE:
- If daily is Bullish but 15-min and 1-hour are both Bearish, the overall analysis is Conflicting.
- This means: The daily uptrend is at risk, or the lower TF is undergoing a normal correction.
- Action: Wait for the lower TF to turn bullish before entering long.

SPECIFIC MTF RULES:
1. A WEEKLY support level carries more weight than a DAILY support level, which carries more than an HOURLY support level. Use the highest timeframe S/R for key levels.
2. Entering on a 15-min setup that aligns with the daily trend gives 2-3x better win rate than a setup against the daily trend.
3. If the daily trend is strongly bullish (price well above EMA200 and EMA50), even a daily bearish candle is just a pullback — buy on 1h/15m setups.
4. When 1-hour and daily are both in transition (crossing EMAs), reduce position size and wait for clarity.

MTF FOR SETTING TARGETS:
- Use the higher timeframe S/R levels as targets for lower timeframe entries.
  - Example: Enter on 15-min EMA pullback; set target at 1-hour resistance level.
  - This ensures you don't exit too early (at a 15-min resistance that the 1-hour trend blows through).

MTF EXAMPLE (NIFTY INTRADAY):
1. Daily chart: NIFTY above EMA50 and EMA200. Bullish structure (recent HH at 22,500). Primary bias: Bullish.
2. 1-hour chart: EMA9 > EMA21 > EMA50. RSI at 58. Bullish bias confirmed.
3. 15-min chart: Price pulled back to EMA21 (1-hour EMA pullback visible). RSI at 47. Reversal hammer forming.
4. Action: Enter long at 15-min setup trigger. Target: Previous 1-hour high. SL: Below 15-min swing low.
5. MTF confluence score: 3/3. Confidence: High.

COMMON MTF MISTAKES:
1. Only using one timeframe and missing the bigger picture (entering against the daily trend).
2. Over-analysis: Using 5+ timeframes creates analysis paralysis. Stick to 3.
3. Ignoring HTF S/R: Entering a long trade right at a weekly resistance level ignoring the weekly chart.
4. Not adjusting targets to the HTF: Setting targets at 15-min resistance when the 1-hour has clear path to a higher target.
"""
    },

    {
        "id": "wyckoff",
        "title": "Wyckoff Method — Accumulation, Distribution, and Market Phases",
        "content": """
WYCKOFF METHOD — ACCUMULATION, DISTRIBUTION, AND MARKET PHASES

The Wyckoff Method, developed by Richard D. Wyckoff in the early 20th century, is a methodology
for reading market intent through price and volume. It is foundational to understanding smart
money (institutional) behavior.

THE COMPOSITE OPERATOR (CO):
Wyckoff introduced the concept of the "Composite Operator" — a hypothetical entity that represents
all institutional market participants acting in a coordinated fashion. Understanding the CO's behavior
allows retail traders to align with institutional activity.

THE FOUR PHASES OF THE MARKET CYCLE:
1. ACCUMULATION: Smart money buys while the public is unaware. Occurs after a downtrend.
2. MARKUP: Price rises as the public begins to participate. Trend is up.
3. DISTRIBUTION: Smart money sells to the public near the top. Occurs after an uptrend.
4. MARKDOWN: Price falls as selling overwhelms demand. Trend is down.

ACCUMULATION SCHEMATIC (Bullish Setup):
- PS (Preliminary Support): Initial large-volume buying that arrests the downtrend temporarily.
- SC (Selling Climax): High-volume panic selloff. Wide spread down bar closing on its high. This is where smart money aggressively absorbs supply.
- AR (Automatic Rally): Bounce after SC. Establishes the top of the accumulation range.
- ST (Secondary Test): Price re-tests the SC low on lower volume. Confirms supply has been absorbed.
- SPRING: Price briefly dips below the accumulation range (false breakdown) then recovers quickly. This shakes out weak hands (retail stop-losses triggered) and allows smart money to accumulate remaining supply at the lowest price.
  - The Spring is the highest-probability long entry in Wyckoff analysis.
  - Signs of a Spring: Very high volume on the breakdown (SC), close back within the range by end of bar.
- SOS (Sign of Strength): Strong up-move with high volume breaking above the range after the spring.
- LPS (Last Point of Support): Pullback to prior resistance (now support) after SOS. Second entry opportunity.
- Breakout: Price moves above the accumulation range with high volume. Full confirmation of markup phase.

DISTRIBUTION SCHEMATIC (Bearish Setup):
- PSY (Preliminary Supply): First sign of supply as price makes new highs.
- BC (Buying Climax): Final surge to a new high on extremely high volume but weak close. Smart money distributes (sells) to eager buyers.
- AR (Automatic Reaction): Sharp selloff after BC.
- ST (Secondary Test): Price re-tests the BC high on low volume, failing to reach it.
- SOW (Sign of Weakness): Rapid decline breaking below the distribution range with high volume.
- LPSY (Last Point of Supply): Weak rally back to prior support (now resistance). Shorting opportunity.
- UTAD (Upthrust After Distribution): False breakout above the distribution range. Opposite of Spring — traps buyers before the markdown.
- Breakdown: Price falls below the distribution range. Markdown confirmed.

VOLUME IN WYCKOFF:
- Wyckoff emphasized that VOLUME is the cause; price is the EFFECT.
- High volume at lows = accumulation. High volume at highs = distribution.
- Narrow spread + high volume in a range = absorption (smart money is absorbing retail supply/demand).
- Low volume as price approaches key level = no interest; expect bounce/rejection.

CAUSE AND EFFECT:
- Wyckoff's law: The size of the subsequent move (effect) is proportional to the time spent in accumulation or distribution (cause).
- A 3-week accumulation range produces a smaller markup than a 3-month accumulation range.
- Point & Figure (P&F) charts are used to count the "cause" and project the "effect."

APPLYING WYCKOFF IN INDIAN MARKETS:
- NIFTY monthly charts often show clear accumulation and distribution phases over 6-18 months.
- BANKNIFTY weekly: Look for springs at multi-month support levels for high-conviction swing entries.
- Individual large-cap stocks (Reliance, HDFC Bank): Institutional accumulation visible as sideways range with declining volume + high-volume buying days at lows.
- The "spring" pattern on the daily chart of quality stocks at key support levels has ~65% accuracy for producing at least a 5% rally (when confirmed by high volume).
"""
    },

    {
        "id": "price_action",
        "title": "Price Action Patterns — Inside Bars, Pin Bars, Breakout & Retest",
        "content": """
PRICE ACTION PATTERNS — INSIDE BARS, PIN BARS, AND BREAKOUT & RETEST

Price action trading focuses on reading pure price structure and patterns without relying
heavily on lagging indicators. These patterns are universally applicable across timeframes and markets.

INSIDE BAR:
Definition: A bar whose high is lower than the previous bar's high AND whose low is higher than the previous bar's low. The inside bar is "contained within" the mother bar.

Interpretation: The market is in a state of equilibrium/consolidation. Energy is building for a move.

Trading Rules:
- Breakout of the MOTHER BAR defines the direction:
  - Long: Buy when price closes above the mother bar's high. SL: Below mother bar's low (or inside bar's low for tighter stop).
  - Short: Sell when price closes below the mother bar's low.
- Best inside bars: Occur at key S/R levels or after a strong trending move.
- Multiple inside bars (2-3 consecutive): Signal of extreme consolidation; breakout can be very powerful.
- Bulkowski stats: Inside bar breakouts succeed (continue in breakout direction) ~57% upward and 54% downward. Odds improve to 65%+ when confirmed by trend direction and volume.
- False inside bar breakout: When price breaks above the mother bar's high but closes back inside — this is a sell signal (trapped buyers).

PIN BAR (HAMMER/SHOOTING STAR FAMILY):
Definition: A candle with a small body (≤30% of total range) and a long shadow (≥60% of total range) in one direction.
- Bullish Pin Bar: Long lower shadow, small body near the top. Shows rejection of lower prices.
- Bearish Pin Bar: Long upper shadow, small body near the bottom. Shows rejection of higher prices.

Context Rules:
- Bullish pin bar is only valid if it occurs at support (key S/R, EMA, round number, Fibonacci level).
- Bearish pin bar is only valid at resistance.
- The longer the shadow relative to the range, the more powerful the rejection.
- Volume: High volume on the pin bar's extreme confirms strong institutional reaction.

Bulkowski stats for Pin Bar:
- Bullish pin bar at support: 64% accuracy for a minimum 5% rally.
- Bearish pin bar at resistance: 61% accuracy for a minimum 5% decline.
- Combined with trend alignment: Accuracy improves to 70%+.

BREAKOUT AND RETEST (B&R):
The B&R is one of the highest-probability setups in all of technical analysis.
Structure:
1. Price consolidates at a resistance level (builds S/R level over multiple touches).
2. Price BREAKS OUT above resistance with strong volume (≥1.5x average).
3. Price pulls back to test the breakout level (now support) — the RETEST.
4. At the retest level: Low volume (supply has dried up) + bullish reversal candle.
5. Entry: Above the retest candle's high. SL: Below the retest candle's low or the breakout level.
6. Target: Height of the base pattern projected upward (minimum), or next major resistance.

Why B&R works: The breakout forces shorts to cover and stop-losses to trigger (creating demand). The retest allows price to "digest" the move and gives late buyers a second entry while weak buyers are shaken out.

Reliability (Bulkowski): Breakout retests have ~68% success rate for continuation when:
- Original breakout was on high volume.
- Retest is on low volume (supply dried up).
- Retest closes above the breakout level (no close-below).

FALSE BREAKOUTS:
- Price breaks above resistance (triggering B&R buyers) but then closes back below resistance.
- This traps longs and forces selling; the resulting move is often violent to the downside.
- False breakout from a major range (weekly level): The reversal can be 3-5x the height of the range.
- Identification: Breakout candle closes back inside range by end of bar. Volume can be high or low.
- Strategy: Trade false breakouts by entering in the OPPOSITE direction once price closes back inside the range.

INSIDE BAR + PIN BAR COMBINATION:
- When an inside bar is also a pin bar (inside bar + long shadow), the pattern has very high predictive value.
- The setup signals both consolidation (inside bar) and rejection (pin bar).
- This combination at key S/R levels has ~70%+ success rate for the anticipated move.

PRACTICAL PRICE ACTION FRAMEWORK:
1. Mark key S/R levels on daily and weekly charts.
2. Wait for price to reach a key level.
3. Look for a pin bar, inside bar, or engulfing candle at that level.
4. Confirm with volume, RSI, and timeframe alignment.
5. Enter with a tight, well-defined stop loss.
6. Target the next key level.
"""
    },

]
